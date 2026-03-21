import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { db, Tables } from '../../lib/db/client'
import { getRequestOrg } from '../../lib/auth/middleware'
import { forbidden, notFound, ok, serverError, unauthorized } from '../../lib/utils/response'
import { Election } from '../../types'

// GET /elections/{electionId}/voters — list all invited voters
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const org = await getRequestOrg(event)
    if (!org) return unauthorized()

    const electionId = event.pathParameters?.electionId
    if (!electionId) return notFound('Election')

    const election = (
      await db.send(new GetCommand({ TableName: Tables.ELECTIONS, Key: { election_id: electionId } }))
    ).Item as Election | undefined

    if (!election) return notFound('Election')
    if (election.org_id !== org.org_id) return forbidden()

    const result = await db.send(
      new QueryCommand({
        TableName: Tables.VOTERS,
        KeyConditionExpression: 'election_id = :eid',
        ExpressionAttributeValues: { ':eid': electionId },
      })
    )

    // Strip invite_token from response — admin doesn't need to see the raw token
    const voters = (result.Items ?? []).map(({ invite_token: _tok, ...voter }) => voter)

    return ok(voters)
  } catch (err) {
    return serverError(err)
  }
}
