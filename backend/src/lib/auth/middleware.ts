import { APIGatewayProxyEvent } from 'aws-lambda'
import { GetCommand } from '@aws-sdk/lib-dynamodb'
import { db, Tables } from '../db/client'
import { Org } from '../../types'

// Extracts the org from a Cognito-authenticated request.
// API Gateway + Cognito authorizer validates the JWT before Lambda runs,
// so by the time this runs, the token is already verified.
// We just extract the Cognito sub and look up the org record.
export async function getRequestOrg(event: APIGatewayProxyEvent): Promise<Org | null> {
  const sub = event.requestContext.authorizer?.claims?.sub as string | undefined
  if (!sub) return null

  // Look up org by Cognito user sub via GSI
  const { QueryCommand } = await import('@aws-sdk/lib-dynamodb')
  const result = await db.send(
    new QueryCommand({
      TableName: Tables.ORGS,
      IndexName: 'cognito-sub-index',
      KeyConditionExpression: 'cognito_user_id = :sub',
      ExpressionAttributeValues: { ':sub': sub },
      Limit: 1,
    })
  )

  const org = result.Items?.[0] as Org | undefined
  return org ?? null
}

// Extracts and validates the session token for open election voting.
// The token comes in the X-Session-Token header.
export function getSessionToken(event: APIGatewayProxyEvent): string | null {
  return event.headers['X-Session-Token'] ?? event.headers['x-session-token'] ?? null
}

// Parses and validates the request body as JSON.
export function parseBody<T>(event: APIGatewayProxyEvent): T | null {
  try {
    if (!event.body) return null
    const body = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf-8')
      : event.body
    return JSON.parse(body) as T
  } catch {
    return null
  }
}
