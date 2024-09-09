import * as path from "path";
import * as fs from "fs";
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cforigins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as autoscaling from "aws-cdk-lib/aws-autoscaling";
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as waf from 'aws-cdk-lib/aws-wafv2';
import { AwsCustomResource, PhysicalResourceId, AwsCustomResourcePolicy } from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import { createHash } from 'crypto';
import { products, defaultUser, comments } from './ddb-data';
import { wafRules } from './waf-rules';
import { stackConfig } from './stack-config';
import { getOriginShieldRegion } from './originshield';


export class StoreInfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const secretKey = createHash('md5').update(this.node.addr).digest('hex');

    const customResourcePolicy = AwsCustomResourcePolicy.fromSdkCalls({
      resources: AwsCustomResourcePolicy.ANY_RESOURCE, // TODO: make it more restrictive
    });

    // DynamoDB tables to store users and prodcts data
    const usersTable = new dynamodb.Table(this, "usersTable", {
      partitionKey: {
        name: "username",
        type: dynamodb.AttributeType.STRING
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    const productsTable = new dynamodb.Table(this, "productsTable", {
      partitionKey: {
        name: "id",
        type: dynamodb.AttributeType.STRING
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    const commentsTable = new dynamodb.Table(this, "commentsTable", {
      partitionKey: {
        name: "productid",
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.NUMBER
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    // fill tables with initial data
    new AwsCustomResource(this, 'fillDbTableData', {
      onCreate: {
        service: 'DynamoDB',
        action: 'BatchWriteItem',
        parameters: {
          RequestItems: {
            [productsTable.tableName]: products.map(product => ({
              PutRequest: {
                Item: {
                  id: { S: product.id },
                  name: { S: product.name },
                  description: { S: product.description },
                  price: { N: `${product.price}` },
                  image: { S: product.image },
                }
              }
            })),
            [commentsTable.tableName]: comments.map(comment => ({
              PutRequest: {
                Item: {
                  productid: { S: comment.productid },
                  timestamp: { N: `${comment.timestamp}` },
                  username: { S: comment.username },
                  text: { S: comment.text },
                }
              }
            })),
            [usersTable.tableName]: [
              {
                PutRequest: {
                  Item: defaultUser,
                }
              }
            ]
          }
        },
        physicalResourceId: PhysicalResourceId.of('fillDbTableData'),
      },
      policy: customResourcePolicy,
    });

    // S3 bucket holding original sample images
    const originalImageBucket = new cdk.aws_s3.Bucket(this, 's3-sample-original-image-bucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      autoDeleteObjects: true,
    });

    // Upload sample product images to S3
    new cdk.aws_s3_deployment.BucketDeployment(this, 'ProductImages', {
      sources: [cdk.aws_s3_deployment.Source.asset('../store-app/public/images')],
      destinationBucket: originalImageBucket,
      destinationKeyPrefix: 'images/',
    });

    // Create identity pool for CloudWatch RUM
    const cwRumIdentityPool = new cognito.CfnIdentityPool(this, 'cw-rum-identity-pool', {
      allowUnauthenticatedIdentities: true,
    });

    const cwRumUnauthenticatedRole = new iam.Role(this, 'cw-rum-unauthenticated-role', {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          "StringEquals": {
            "cognito-identity.amazonaws.com:aud": cwRumIdentityPool.ref
          },
          "ForAnyValue:StringLike": {
            "cognito-identity.amazonaws.com:amr": "unauthenticated"
          }
        },
        "sts:AssumeRoleWithWebIdentity"
      )
    });

    const rumApplicationName = 'EcommerceDemoRUM';

    cwRumUnauthenticatedRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "rum:PutRumEvents"
      ],
      resources: [
        `arn:aws:rum:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:appmonitor/${rumApplicationName}`
      ]
    }));

    new cognito.CfnIdentityPoolRoleAttachment(this,
      'cw-rum-identity-pool-role-attachment',
      {
        identityPoolId: cwRumIdentityPool.ref,
        roles: {
          "unauthenticated": cwRumUnauthenticatedRole.roleArn
        }
      });

    new cdk.aws_rum.CfnAppMonitor(this, 'MyCfnAppMonitor', {
      domain: 'www.dummy.com',
      name: rumApplicationName,
      appMonitorConfiguration: {
        allowCookies: true,
        enableXRay: false,
        sessionSampleRate: 1,
        telemetries: ['errors', 'performance', 'http'],
        identityPoolId: cwRumIdentityPool.ref,
        guestRoleArn: cwRumUnauthenticatedRole.roleArn
      },
    });

    // S3 bucket holding trasnformed images (resized and reformatted)
    const transformedImageBucket = new s3.Bucket(this, 's3-transformed-image-bucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(stackConfig.S3_TRANSFORMED_IMAGE_EXPIRATION_DURATION),
        },
      ],
    });

    // Create Lambda URL for image processing
    var imageProcessing = new lambda.Function(this, 'image-optimization-lambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('functions/image-processing-lambda'),
      timeout: cdk.Duration.seconds(stackConfig.LAMBDA_TIMEOUT),
      memorySize: stackConfig.LAMBDA_MEMORY,
      environment: {
        originalImageBucketName: originalImageBucket.bucketName,
        transformedImageCacheTTL: stackConfig.S3_TRANSFORMED_IMAGE_CACHE_TTL,
        transformedImageBucketName: transformedImageBucket.bucketName
      },
      logRetention: cdk.aws_logs.RetentionDays.ONE_DAY,
    });
    // IAM policy to allow this lambda to read/write images from the relevant buckets
    const s3ReadOriginalImagesPolicy = new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      resources: ['arn:aws:s3:::' + originalImageBucket.bucketName + '/*'],
    });

    var s3WriteTransformedImagesPolicy = new iam.PolicyStatement({
      actions: ['s3:PutObject'],
      resources: ['arn:aws:s3:::' + transformedImageBucket.bucketName + '/*'],
    });
    var iamPolicyStatements = [s3ReadOriginalImagesPolicy, s3WriteTransformedImagesPolicy];

    imageProcessing.role?.attachInlinePolicy(
      new iam.Policy(this, 'read-write-bucket-policy', {
        statements: iamPolicyStatements,
      }),
    );
    const imageProcessingURL = imageProcessing.addFunctionUrl();
    const imageProcessingDomainName = cdk.Fn.parseDomainName(imageProcessingURL.url);

    // Create a CloudFront Function for detecting optimal format, validating inputs and rewriting url
    const imageURLformatting = new cloudfront.Function(this, 'imageURLformatting', {
      code: cloudfront.FunctionCode.fromFile({ filePath: 'functions/cloudfront-function-image-url-formatting/index.js' }),
      functionName: `imageURLformatting${this.node.addr}`,
      runtime: cloudfront.FunctionRuntime.JS_2_0,
    });

    // Create a VPC
    const vpc = new ec2.Vpc(this, 'store_vpc', {
      maxAzs: 3,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        }
      ]
    });


    // Create a security group locking the LB to CloudFront IPs
    // by getting the CloudFront prefix list in the CDK deployment region using a custom resource
    const prefixListId = new AwsCustomResource(this, 'GetPrefixListId', {
      onCreate: {
        service: 'EC2',
        action: 'DescribeManagedPrefixListsCommand',
        parameters: {
          Filters: [
            {
              Name: 'prefix-list-name',
              Values: ['com.amazonaws.global.cloudfront.origin-facing'],
            },
          ],
        },
        physicalResourceId: PhysicalResourceId.of('GetPrefixListId'),
      },
      policy: customResourcePolicy,
    }).getResponseField('PrefixLists.0.PrefixListId');

    const lbSecurityGroup = new ec2.SecurityGroup(this, 'LBSecurityGroup', {
      vpc,
      description: 'Allow access from CloudFront IPs',
      allowAllOutbound: true
    });
    lbSecurityGroup.addIngressRule(
      ec2.Peer.prefixList(prefixListId),
      ec2.Port.tcp(80),
      'Allow port 80 on IPv4 from CloudFront '
    );
    // create SG for the EC2 isntance
    const ec2SecurityGroup = new ec2.SecurityGroup(this, 'EC2SecurityGroup', {
      vpc,
      description: 'SGs for EC2s',
      allowAllOutbound: true
    });
    ec2SecurityGroup.addIngressRule(
      ec2.Peer.securityGroupId(lbSecurityGroup.securityGroupId),
      ec2.Port.tcp(3000),
      'Accept traffic from LB'
    );

    // For troubleshooting, allow myIP address
    (async () => {
      try {
        const res = await fetch('https://api.ipify.org/?format=json');
        const data = await res.json();
        console.log(`Your IP address is ${data.ip}`);
        ec2SecurityGroup.addIngressRule(
          ec2.Peer.ipv4(`${data.ip}/32`),
          ec2.Port.tcp(22),
          'Allow SSH from myIP'
        );
        lbSecurityGroup.addIngressRule(
          ec2.Peer.ipv4(`${data.ip}/32`),
          ec2.Port.tcp(80),
          'Allow port 80 from myIP'
        );
      } catch (err) {
        console.log("error fetching IP");
      }
    })()

    // Create an IAM role for the EC2 instance with DynamoDB read/write permissions to the role
    const role = new iam.Role(this, 'MyEC2Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    });
    productsTable.grantReadWriteData(role);
    usersTable.grantReadWriteData(role);
    commentsTable.grantReadWriteData(role);

    // Create Autoscaling group
    const asg = new autoscaling.AutoScalingGroup(this, 'scalingGroup', {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      vpc,
      role: role,
      securityGroup: ec2SecurityGroup,
      minCapacity: 2,
      maxCapacity: 4,
    });

    const alb = new elbv2.ApplicationLoadBalancer(this, 'LB', {
      vpc,
      internetFacing: true,
      securityGroup: lbSecurityGroup,
    });

    const listener = alb.addListener('Listener', {
      port: 80,
      open: false
    });

    listener.addTargets('ASGTarget', {
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [asg],
      healthCheck: {
        path: '/',
        unhealthyThresholdCount: 2,
        healthyThresholdCount: 3,
        interval: cdk.Duration.seconds(5),
        timeout: cdk.Duration.seconds(2),
      }
    });


    // Create the WebACL in us-east-1 to associate it with CloudFront
    const webACLName = `EcommerceDemoACL${this.node.addr}`;
    const wafWebaclCreateCR = new AwsCustomResource(this, 'createWAFWebACL', {
      onCreate: {
        service: 'WAFv2',
        action: 'CreateWebACL',
        region: 'us-east-1',
        parameters: {
          Name: webACLName,
          Scope: 'CLOUDFRONT',
          DefaultAction: { Allow: {} },
          Rules: wafRules,
          VisibilityConfig: {
            CloudWatchMetricsEnabled: true,
            MetricName: "EcommerceDemoACL",
            SampledRequestsEnabled: true,
          },
        },
        outputPaths: ['Summary'],
        physicalResourceId: PhysicalResourceId.of('createWAFWebACL'),
      },
      policy: customResourcePolicy,
    });
    const webAclID = wafWebaclCreateCR.getResponseField('Summary.Id');
    const webAclARN = wafWebaclCreateCR.getResponseField('Summary.ARN');


    const webAclLogGroup = new logs.LogGroup(this, "awsWafLogs", {
      logGroupName: 'aws-waf-logs-recycle-bin',
      retention: logs.RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create logging configuration with log group as destination
    new waf.CfnLoggingConfiguration(this, "webAclLoggingConfiguration", {
      logDestinationConfigs: [
        // Construct the different ARN format from the logGroupName
        cdk.Stack.of(this).formatArn({
          arnFormat: cdk.ArnFormat.COLON_RESOURCE_NAME,
          service: "logs",
          resource: "log-group",
          resourceName: webAclLogGroup.logGroupName,
        })
      ],
      resourceArn: webAclARN
    });

    // Get the url used for the Client side javascript integration
    const wafWebaclIntegrationURLCR = new AwsCustomResource(this, 'WAFWebACLproperties', {
      onUpdate: {
        service: 'WAFv2',
        action: 'GetWebACL',
        region: 'us-east-1',
        parameters: {
          Id: webAclID,
          Name: webACLName,
          Scope: 'CLOUDFRONT'
        },
        outputPaths: ['ApplicationIntegrationURL', 'LockToken'],
        physicalResourceId: PhysicalResourceId.of(`WAFWebACLproperties${Date.now().toString()}`),
      },
      policy: customResourcePolicy,
    });
    const wafIntegrationURL = wafWebaclIntegrationURLCR.getResponseField('ApplicationIntegrationURL');
    const wafLocktoken = wafWebaclIntegrationURLCR.getResponseField('LockToken');

    // create a custom resoruce to delete WAFWebaCL
    const deleteWafCR = new AwsCustomResource(this, 'DeleteWAFWebACL', {
      onDelete: {
        service: 'WAFv2',
        action: 'DeleteWebACL',
        region: 'us-east-1',
        parameters: {
          Id: webAclID,
          Name: webACLName,
          LockToken: wafLocktoken,
          Scope: 'CLOUDFRONT'
        },
        physicalResourceId: PhysicalResourceId.of('DeleteWAFWebACL'),
      },
      policy: customResourcePolicy,
    });

    // get the paramters of the RUM script tag
    const rumParameters = new AwsCustomResource(this, 'RumParameters', {
      onCreate: {
        service: 'RUM',
        action: 'GetAppMonitor',
        parameters: {
          Name: rumApplicationName,
        },
        physicalResourceId: PhysicalResourceId.of('RumParameters'),
      },
      policy: customResourcePolicy,
    });
    const rumMonitorId = rumParameters.getResponseField('AppMonitor.Id');
    const rumMonitorIdentityPoolId = rumParameters.getResponseField('AppMonitor.AppMonitorConfiguration.IdentityPoolId');

    const aws_config = `{"products_ddb_table" : "${productsTable.tableName}", "users_ddb_table": "${usersTable.tableName}", "comments_ddb_table": "${commentsTable.tableName}","login_secret_key": "${secretKey}","aws_region": "${this.region}", "waf_url": "${wafIntegrationURL}challenge.compact.js", "rumMonitorId": "${rumMonitorId}", "rumMonitorIdentityPoolId": "${rumMonitorIdentityPoolId}"}`;

    // Script to bootstrap the Nextjs app on EC2
    asg.addUserData(
      '#!/bin/bash',
      'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash',
      'export NVM_DIR="$HOME/.nvm"',
      '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"',
      'nvm install --lts',
      'yum -y update',
      'yum -y install git',
      'npm install -g pm2',
      `git clone ${stackConfig.GITHUB_REPO}`,
      'cd /fast-secure-ecommerce-demo/store-app',
      `echo '${aws_config}' > aws-backend-config.json`,
      'npm install',
      'npm run build',
      'pm2 start npm --name nextjs-app -- run start -- -p 3000'
    );

    // **************************
    // Content delivery with Amazon CloudFront below
    // **************************

    // Create CloudFront KeyValueStore that will store the engine rules
    const kvs = new cloudfront.KeyValueStore(this, 'HtmlKeyValueStore', {
      keyValueStoreName: 'kvs-html-rules',
      source: cloudfront.ImportSource.fromInline(JSON.stringify({
        data: [{ key: "_secretkey", value: secretKey }],
      })),
    });

    // Replace KVS id in the CloudFront Function code, then minify the code
    let htmlRulesRequestFunctionCode = fs.readFileSync(path.join(__dirname, "../functions/cloudfront-function-html-rules/request-index.js"), 'utf-8');
    htmlRulesRequestFunctionCode = htmlRulesRequestFunctionCode.replace(/__KVS_ID__/g, kvs.keyValueStoreId);

    const htmlRulesRequestFunction = new cloudfront.Function(this, 'htmlRulesRequestFunction', {
      code: cloudfront.FunctionCode.fromInline(htmlRulesRequestFunctionCode),
      functionName: `htmlRulesReqCFF${this.node.addr}`,
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      keyValueStore: kvs,
    });

    const htmlRulesResponseFunction = new cloudfront.Function(this, 'htmlRulesResponseFunction', {
      code: cloudfront.FunctionCode.fromFile({ filePath: 'functions/cloudfront-function-html-rules/response-index.js' }),
      functionName: `htmlRulesRespCFF${this.node.addr}`,
      runtime: cloudfront.FunctionRuntime.JS_2_0,
    });
    const originShieldRegion = getOriginShieldRegion(process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION || 'us-east-1');

    const backendOrigin = new cforigins.HttpOrigin(alb.loadBalancerDnsName, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
      originShieldEnabled: true,
      originShieldRegion: originShieldRegion,
    });

    const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(this, 'ResponseHeadersPolicy', {
      responseHeadersPolicyName: 'EcommerceDemoRHP',
      comment: 'A default policy for the fast-secure-ecommerce-demo',
      securityHeadersBehavior: {
        // contentSecurityPolicy: { contentSecurityPolicy: 'default-src https:;', override: true }, TBD
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
        referrerPolicy: { referrerPolicy: cloudfront.HeadersReferrerPolicy.NO_REFERRER, override: true },
        strictTransportSecurity: { accessControlMaxAge: cdk.Duration.seconds(600), includeSubdomains: true, override: true },
        xssProtection: { protection: true, modeBlock: true, override: true },
      },
      serverTimingSamplingRate: 100,
    });

    const cdn = new cloudfront.Distribution(this, 'store-cdn', {
      comment: 'CloudFront to serve the fast-secure-ecommerce-demo',
      webAclId: webAclARN,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      publishAdditionalMetrics: true,
      defaultBehavior: {
        origin: backendOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: new cloudfront.CachePolicy(this, "dynamicCachePolicy", {
          defaultTtl: cdk.Duration.seconds(0),
          minTtl: cdk.Duration.seconds(0),
          maxTtl: cdk.Duration.days(365),
          queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
          cookieBehavior: cloudfront.CacheCookieBehavior.allowList('token'),
          enableAcceptEncodingBrotli: true,
          enableAcceptEncodingGzip: true,
        }),
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_AND_CLOUDFRONT_2022, //TODO could break with ALB
        responseHeadersPolicy: responseHeadersPolicy,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        functionAssociations: [{
          eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          function: htmlRulesRequestFunction,
        },
        {
          eventType: cloudfront.FunctionEventType.VIEWER_RESPONSE,
          function: htmlRulesResponseFunction,
        },
        ],
      },
      additionalBehaviors: {
        '*.css': {
          origin: backendOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_AND_CLOUDFRONT_2022, //TODO could break with ALB
          responseHeadersPolicy: responseHeadersPolicy
        },
        '*.js': {
          origin: backendOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_AND_CLOUDFRONT_2022, //TODO could break with ALB
          responseHeadersPolicy: responseHeadersPolicy
        },
        '/images/*': {
          origin: new cforigins.OriginGroup({
            primaryOrigin: new cforigins.S3Origin(transformedImageBucket, {
              originShieldEnabled: true,
              originShieldRegion: originShieldRegion,
            }),
            fallbackOrigin: new cforigins.HttpOrigin(imageProcessingDomainName, {
              originShieldEnabled: true,
              originShieldRegion: originShieldRegion,
            }),
            fallbackStatusCodes: [403, 500, 503, 504],
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED_FOR_UNCOMPRESSED_OBJECTS,
          responseHeadersPolicy: responseHeadersPolicy,
          compress: false,
          functionAssociations: [{
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
            function: imageURLformatting,
          }],
        },
        '/api/*': {
          origin: backendOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          responseHeadersPolicy: responseHeadersPolicy,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          compress: false,
        },
      },
    });

    cdn.node.addDependency(deleteWafCR);

    // ADD OAC between CloudFront and LambdaURL
    const oac = new cloudfront.CfnOriginAccessControl(this, "OAC", {
      originAccessControlConfig: {
        name: `oac${this.node.addr}`,
        originAccessControlOriginType: "lambda",
        signingBehavior: "always",
        signingProtocol: "sigv4",
      },
    });
    const cfnImageDelivery = cdn.node.defaultChild as cloudfront.CfnDistribution;
    cfnImageDelivery.addPropertyOverride('DistributionConfig.Origins.2.OriginAccessControlId', oac.getAtt("Id"));
    imageProcessing.addPermission("AllowCloudFrontServicePrincipal", {
      principal: new iam.ServicePrincipal("cloudfront.amazonaws.com"),
      action: "lambda:InvokeFunctionUrl",
      sourceArn: `arn:aws:cloudfront::${this.account}:distribution/${cdn.distributionId}`
    })

    // Update the domain name of RUM TODO risk of drift detection
    new AwsCustomResource(this, 'RumUpdate', {
      onCreate: {
        service: 'RUM',
        action: 'UpdateAppMonitor',
        parameters: {
          Domain: cdn.distributionDomainName,
          Name: rumApplicationName,
          AppMonitorConfiguration: {
            AllowCookies: true,
            EnableXRay: false,
            SessionSampleRate: 1,
            Telemetries: ['errors', 'performance', 'http'],
            IdentityPoolId: cwRumIdentityPool.ref,
            GuestRoleArn: cwRumUnauthenticatedRole.roleArn
          }
        },
        physicalResourceId: PhysicalResourceId.of('RumUpdate'),
      },
      policy: customResourcePolicy,
    });

    // Add CloudFormation outputs
    new cdk.CfnOutput(this, 'CloudFrontDomainName', {
      description: 'CloudFront domain name for fast-secure-ecommerce-demo',
      value: cdn.distributionDomainName
    });
    new cdk.CfnOutput(this, 'ALBDomainName', {
      description: 'Application origin (ALB) domain name',
      value: alb.loadBalancerDnsName
    });
    new cdk.CfnOutput(this, 'comments_ddb_table', {
      description: 'DynamoDB comments table',
      value: commentsTable.tableName
    });
    new cdk.CfnOutput(this, 'products_ddb_table', {
      description: 'DynamoDB products table',
      value: productsTable.tableName
    });
    new cdk.CfnOutput(this, 'users_ddb_table', {
      description: 'DynamoDB users table',
      value: usersTable.tableName
    });
    new cdk.CfnOutput(this, 'login_secret_key', {
      description: 'Secret key used for sign in',
      value: secretKey
    });
    new cdk.CfnOutput(this, 'aws_region', {
      description: 'AWS region name',
      value: this.region
    });
    new cdk.CfnOutput(this, 'waf_url', {
      description: 'WAF integration url',
      value: `${wafIntegrationURL}challenge.compact.js`
    });
    new cdk.CfnOutput(this, 'rumMonitorId', {
      description: 'RUM monitor ID',
      value: rumMonitorId
    });
    new cdk.CfnOutput(this, 'rumMonitorIdentityPoolId', {
      description: 'RUM monitor identity pool ID',
      value: rumMonitorIdentityPoolId
    });

  }
}
