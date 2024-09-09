import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient, GetItemCommand, PutItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from '@aws-sdk/util-dynamodb'
import config from '../aws-backend-config.json';

const SECRET_KEY =  config.login_secret_key; // In a real app, use an environment variable

const client = new DynamoDBClient({
    region: config.aws_region,
});
const docClient = DynamoDBDocumentClient.from(client);

export async function getProducts() {
    try {
        const command = new ScanCommand({
            TableName: config.products_ddb_table,
        });

        const response = await docClient.send(command);
        return response.Items;

    } catch (error) {
        console.error('Error fetching products from DynamoDB:', error);
        return null;
    }
}

export async function getProduct(pid) {
    try {
        const command = new GetItemCommand({
            'TableName': config.products_ddb_table,
            'Key': {
                'id': {
                    'S': pid
                }
            }
        });

        const response = await docClient.send(command);
        return unmarshall(response.Item);

    } catch (error) {
        console.error(`Error fetching product ${pid} from DynamoDB:`, error);
        return null;
    }
}

export async function getComments(pid) {
    try {
        const command = new QueryCommand({
            'TableName': config.comments_ddb_table,
            'KeyConditionExpression': "productid = :pid",
            'ExpressionAttributeValues': {
                ':pid': {
                    "S": pid
                }
            }
        });

        const response = await docClient.send(command);
        const unmarshalled = response.Items.map((i) => unmarshall(i));
        return unmarshalled;

    } catch (err) {
        console.log(`Error fetching comments for product ${pid} from DynamoDB:`, err);
        return null;
    }
}

export async function addComment(username, text, productid, timestamp) {
    try {
        const command = new PutItemCommand({
            'TableName': config.comments_ddb_table,
            'Item': {
                'username': {
                    'S': username
                },
                'productid': {
                    'S': productid
                },
                'text': {
                    'S': text
                },
                'timestamp': {
                    'N': `${timestamp}`
                },
            }
        });
        await docClient.send(command);
        return true;
    } catch (err) {
        console.log(`comment couldn\'t be added for product ${pid} in DynamoDB:`, err);
        return null;
    }
}

export async function getProfile(username) {
    try {
        const command = new GetItemCommand({
            'TableName': config.users_ddb_table,
            'Key': {
                'username': {
                    'S': username
                }
            }
        });

        const response = await docClient.send(command);

        if (response.Item) {
            return unmarshall(response.Item);
        } else {
            console.log(`user ${username} was not found in ddb`)
            return null;
        }
    } catch (err) {
        console.log(`profile couldn\'t be fetched for ${username} in DynamoDB:`, err);
        return null;
    }
}

export async function registerUser(username, password, phone, address, premium) {
    try {
        const command = new PutItemCommand({
            'TableName': config.users_ddb_table,
            'Item': {
              'username' : {
                'S': username
              }, 
              'password' : {
                'S': password
              }, 
              'phone' : {
                'S': phone
              }, 
              'address' : {
                'S': address
              }, 
              'premium' : {
                'S': premium
              }, 
            }
          });
        await docClient.send(command);
        return true;
    } catch (err) {
        console.log(`user couldn\'t be registered in DynamoDB:`, err);
        return null;
    }
}