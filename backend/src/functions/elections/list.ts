import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import { db, Tables } from '../../lib/db/client'
import { getRequestOrg } from '../../lib/auth/middleware'
import { ok, serverError, unauthorized } from '../../lib/utils/response'

// GET /elections — list all elections for the authenticated org
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const org = await getRequestOrg(event)
    if (!org) return unauthorized()

    const result = await db.send(
      new QueryCommand({
        TableName: Tables.ELECTIONS,
        IndexName: 'org-elections-index',
        KeyConditionExpression: 'org_id = :orgId',
        ExpressionAttributeValues: { ':orgId': org.org_id },
        ScanIndexForward: false, // newest first
      })
    )

    return ok(result.Items ?? [])
  } catch (err) {
    return serverError(err)
  }
}
