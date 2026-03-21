import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import { db, Tables } from '../../lib/db/client'
import { getRequestOrg } from '../../lib/auth/middleware'
import { notFound, ok, serverError, unauthorized } from '../../lib/utils/response'

// GET /elections/{electionId}/positions/{positionId}/candidates
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const org = await getRequestOrg(event)
    if (!org) return unauthorized()

    const { positionId } = event.pathParameters ?? {}
    if (!positionId) return notFound('Position')

    const result = await db.send(
      new QueryCommand({
        TableName: Tables.CANDIDATES,
        KeyConditionExpression: 'position_id = :pid',
        ExpressionAttributeValues: { ':pid': positionId },
      })
    )

    return ok(result.Items ?? [])
  } catch (err) {
    return serverError(err)
  }
}
