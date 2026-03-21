import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { GetCommand } from '@aws-sdk/lib-dynamodb'
import { db, Tables } from '../../lib/db/client'
import { getRequestOrg } from '../../lib/auth/middleware'
import { forbidden, notFound, ok, serverError, unauthorized } from '../../lib/utils/response'
import { Election } from '../../types'

// GET /elections/{electionId} — get a single election (admin view, full data)
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const org = await getRequestOrg(event)
    if (!org) return unauthorized()

    const electionId = event.pathParameters?.electionId
    if (!electionId) return notFound('Election')

    const result = await db.send(
      new GetCommand({ TableName: Tables.ELECTIONS, Key: { election_id: electionId } })
    )

    const election = result.Item as Election | undefined
    if (!election) return notFound('Election')

    // Orgs can only access their own elections
    if (election.org_id !== org.org_id) return forbidden()

    return ok(election)
  } catch (err) {
    return serverError(err)
  }
}
