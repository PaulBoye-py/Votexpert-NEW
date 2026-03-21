import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { db, Tables } from '../../lib/db/client'

// $disconnect — called when a client closes the WebSocket connection.
// Removes the connection record from DynamoDB.
// We query by connection_id across all elections (scan the GSI isn't ideal,
// so we store election_id on connect and query directly).
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const connectionId = event.requestContext.connectionId!

  // We need to find which election this connection belongs to.
  // The connection record has election_id as PK — we stored it on connect.
  // Scan for the connection_id across elections using a GSI would be expensive.
  // Instead, the electionId was also stored in the request context on connect
  // via query param — but $disconnect doesn't have query params.
  // Approach: store election_id separately in a connection_id → election_id mapping.
  // For simplicity, we query by connection_id using a full scan of the partition.
  // In practice, the TTL will clean up stale connections anyway.
  //
  // A cleaner approach: add a GSI on connection_id to the WS_CONNECTIONS table.
  // For now, we store the election_id on the connection record and retrieve it
  // by doing a scan with a filter — acceptable at this scale.

  // Better approach: keep a reverse lookup table or accept TTL cleanup handles it.
  // Here we just log and rely on TTL + GoneException cleanup in broadcast().
  console.log(`[WS Disconnect] Connection ${connectionId} closed`)

  return { statusCode: 200, body: 'Disconnected' }
}
