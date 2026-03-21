import { ApiGatewayManagementApiClient, PostToConnectionCommand, GoneException } from '@aws-sdk/client-apigatewaymanagementapi'
import { QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { db, Tables } from '../db/client'
import { WSEvent } from '../../types'

// Broadcasts a WebSocket event to all clients connected to a given election.
// Stale connections (GoneException) are automatically removed from DynamoDB.
export async function broadcast(electionId: string, event: WSEvent): Promise<void> {
  const wsClient = new ApiGatewayManagementApiClient({
    endpoint: process.env.WS_API_ENDPOINT,
  })

  // Fetch all active connections for this election
  const result = await db.send(
    new QueryCommand({
      TableName: Tables.WS_CONNECTIONS,
      KeyConditionExpression: 'election_id = :eid',
      ExpressionAttributeValues: { ':eid': electionId },
    })
  )

  const connections = result.Items ?? []
  const payload = Buffer.from(JSON.stringify(event))

  // Send to all connections concurrently
  await Promise.allSettled(
    connections.map(async (conn) => {
      try {
        await wsClient.send(
          new PostToConnectionCommand({
            ConnectionId: conn.connection_id,
            Data: payload,
          })
        )
      } catch (err) {
        // Connection is gone — clean it up
        if (err instanceof GoneException) {
          await db.send(
            new DeleteCommand({
              TableName: Tables.WS_CONNECTIONS,
              Key: { election_id: electionId, connection_id: conn.connection_id },
            })
          )
        }
      }
    })
  )
}
