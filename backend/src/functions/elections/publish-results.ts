import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { db, Tables } from '../../lib/db/client'
import { getRequestOrg } from '../../lib/auth/middleware'
import { conflict, forbidden, notFound, ok, serverError, unauthorized } from '../../lib/utils/response'
import { Election, ElectionStatus } from '../../types'

// POST /elections/{electionId}/publish-results
// Moves election to RESULTS_PUBLISHED — results become publicly visible
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const org = await getRequestOrg(event)
    if (!org) return unauthorized()

    const electionId = event.pathParameters?.electionId
    if (!electionId) return notFound('Election')

    const existing = (
      await db.send(new GetCommand({ TableName: Tables.ELECTIONS, Key: { election_id: electionId } }))
    ).Item as Election | undefined

    if (!existing) return notFound('Election')
    if (existing.org_id !== org.org_id) return forbidden()

    if (existing.status !== ElectionStatus.CLOSED) {
      return conflict('Election must be closed before publishing results')
    }

    const now = new Date().toISOString()
    await db.send(
      new UpdateCommand({
        TableName: Tables.ELECTIONS,
        Key: { election_id: electionId },
        UpdateExpression: 'SET #status = :status, updated_at = :now',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': ElectionStatus.RESULTS_PUBLISHED, ':now': now },
      })
    )

    return ok({ election_id: electionId, status: ElectionStatus.RESULTS_PUBLISHED })
  } catch (err) {
    return serverError(err)
  }
}
