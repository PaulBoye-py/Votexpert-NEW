import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'

// $default — handles any unrecognised WebSocket route.
// Clients don't need to send messages — this is a server-push only API.
export async function handler(_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return { statusCode: 200, body: 'OK' }
}
