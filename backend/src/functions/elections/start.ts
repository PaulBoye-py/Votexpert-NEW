import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { db, Tables } from '../../lib/db/client'
import { getRequestOrg } from '../../lib/auth/middleware'
import { badRequest, conflict, forbidden, notFound, ok, serverError, unauthorized } from '../../lib/utils/response'
import { broadcast } from '../../lib/websocket/broadcaster'
import { Election, ElectionStatus, Position, WSEventType } from '../../types'
import { getExpectedEndTime } from '../../lib/utils/election-timing'

// POST /elections/{electionId}/start
// Admin manually starts an election (or this is triggered by EventBridge for scheduled starts).
// - Validates the election is in DRAFT/SCHEDULED state
// - Requires at least one position with candidates
// - Sets status to ACTIVE, records started_at
// - Broadcasts ELECTION_STARTED to any already-connected WebSocket clients
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

    if (existing.status === ElectionStatus.ACTIVE) {
      return conflict('Election is already active')
    }
    if ([ElectionStatus.CLOSED, ElectionStatus.RESULTS_PUBLISHED].includes(existing.status)) {
      return conflict('Election has already ended')
    }

    // Validate at least one position exists
    const positionsResult = await db.send(
      new QueryCommand({
        TableName: Tables.POSITIONS,
        KeyConditionExpression: 'election_id = :eid',
        ExpressionAttributeValues: { ':eid': electionId },
      })
    )
    const positions = (positionsResult.Items ?? []) as Position[]
    if (positions.length === 0) {
      return badRequest('Election must have at least one position before starting')
    }

    const now = new Date().toISOString()

    await db.send(
      new UpdateCommand({
        TableName: Tables.ELECTIONS,
        Key: { election_id: electionId },
        UpdateExpression: 'SET #status = :status, started_at = :now, updated_at = :now',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': ElectionStatus.ACTIVE,
          ':now': now,
        },
      })
    )

    const expectedEndTime = getExpectedEndTime(now, positions)

    // Broadcast to any already-connected clients
    await broadcast(electionId, {
      type: WSEventType.ELECTION_STARTED,
      election_id: electionId,
      payload: {
        started_at: now,
        expected_end_at: expectedEndTime,
        total_positions: positions.length,
      },
    })

    return ok({
      election_id: electionId,
      status: ElectionStatus.ACTIVE,
      started_at: now,
      expected_end_at: expectedEndTime,
    })
  } catch (err) {
    return serverError(err)
  }
}
