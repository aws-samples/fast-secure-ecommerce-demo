# Future work

## Scenarios  

* Add an observability option for CloudFront: CloudWatch or real time logs
* Demonstrate an Lambda URL based API
* Graceful failover
* Report false positives 
* Display Server timing headers in CloudWatch RUM
* Include CAPTCHA in registration worklflow
* Block unexpected API paths

## App code
* Add more registration data (e.g. First and Last name)
* Preview display in social networks
* GenAI search bar

## Infra code
* Add CSP header
* Use latest version of bot control
* Enforce origin cloaking at L7
* Use OAC L2 construct for S3 buckets
* Remove KVS id rewrite
* Move static content to own bucket with appropriate caching behavior
* Consider moving backed in Lambda with Lamdba Adapter layer
* Config file change to work with CDK output
* Allow the option for custom domain in CDK input parameters
* Update WAFWebACL on every CDK change
