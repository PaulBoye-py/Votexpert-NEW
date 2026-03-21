import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { PutCommand } from '@aws-sdk/lib-dynamodb'
import { db, Tables } from '../../lib/db/client'

// $connect — called when a client opens a WebSocket connection.
// Expects electionId as a query parameter: wss://...?electionId=xxx
// Stores the connection so broadcast() can find it later.
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const connectionId = event.requestContext.connectionId!
  const electionId = event.queryStringParameters?.electionId

  if (!electionId) {
    // Reject connection if no electionId — nothing to broadcast to
    return { statusCode: 400, body: 'electionId query parameter is required' }
  }

  const ttl = Math.floor(Date.now() / 1000) + 24 * 60 * 60 // 24-hour TTL

  await db.send(
    new PutCommand({
      TableName: Tables.WS_CONNECTIONS,
      Item: {
        election_id: electionId,
        connection_id: connectionId,
        connected_at: new Date().toISOString(),
        ttl,
      },
    })
  )

  return { statusCode: 200, body: 'Connected' }
}
