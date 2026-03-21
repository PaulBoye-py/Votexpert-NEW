import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { db, Tables } from '../../lib/db/client'
import { getRequestOrg } from '../../lib/auth/middleware'
import { conflict, forbidden, notFound, ok, serverError, unauthorized } from '../../lib/utils/response'
import { broadcast } from '../../lib/websocket/broadcaster'
import { Election, ElectionStatus, WSEventType } from '../../types'

// POST /elections/{electionId}/end — admin manually ends an active election
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

    if (existing.status !== ElectionStatus.ACTIVE) {
      return conflict('Election is not currently active')
    }

    const now = new Date().toISOString()

    await db.send(
      new UpdateCommand({
        TableName: Tables.ELECTIONS,
        Key: { election_id: electionId },
        UpdateExpression: 'SET #status = :status, ended_at = :now, updated_at = :now',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': ElectionStatus.CLOSED, ':now': now },
      })
    )

    await broadcast(electionId, {
      type: WSEventType.ELECTION_ENDED,
      election_id: electionId,
      payload: { ended_at: now },
    })

    return ok({ election_id: electionId, status: ElectionStatus.CLOSED, ended_at: now })
  } catch (err) {
    return serverError(err)
  }
}
