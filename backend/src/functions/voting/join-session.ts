import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuid } from 'uuid'
import { db, Tables } from '../../lib/db/client'
import { parseBody } from '../../lib/auth/middleware'
import { badRequest, conflict, notFound, ok, serverError } from '../../lib/utils/response'
import { Election, ElectionStatus, ElectionType, VoteSession } from '../../types'
import { getActivePosition, getTotalDuration } from '../../lib/utils/election-timing'
import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import { Position } from '../../types'

// POST /vote/session
// Called when a voter opens an open election page (via link or QR code).
// Returns an existing session token (from body, if re-joining) or creates a new one.
// The session token stored in the browser is the voter's anonymous identity.
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = parseBody<{ election_id: string; session_token?: string }>(event)
    if (!body?.election_id) return badRequest('election_id is required')

    const election = (
      await db.send(new GetCommand({ TableName: Tables.ELECTIONS, Key: { election_id: body.election_id } }))
    ).Item as Election | undefined

    if (!election) return notFound('Election')
    if (election.type !== ElectionType.OPEN) {
      return conflict('This election requires an invitation to vote')
    }
    if (election.status !== ElectionStatus.ACTIVE) {
      return conflict('This election is not currently active')
    }

    // If the voter already has a session token, return the existing session
    if (body.session_token) {
      const existing = (
        await db.send(new GetCommand({ TableName: Tables.VOTE_SESSIONS, Key: { session_token: body.session_token } }))
      ).Item as VoteSession | undefined

      if (existing && existing.election_id === body.election_id) {
        // Fetch current active position for the response
        const positions = await getPositions(body.election_id)
        const activePosition = election.started_at
          ? getActivePosition(positions, election.started_at)
          : null

        return ok({ session_token: existing.session_token, votes_cast: existing.votes_cast, active_position: activePosition })
      }
    }

    // Create a new anonymous session
    const ip = event.requestContext.identity?.sourceIp ?? 'unknown'
    const positions = await getPositions(body.election_id)
    const totalDuration = getTotalDuration(positions)

    // Session TTL = election start time + total duration + 1 hour buffer
    const ttl = Math.floor(
      (new Date(election.started_at!).getTime() + (totalDuration + 3600) * 1000) / 1000
    )

    const session: VoteSession = {
      session_token: uuid(),
      election_id: body.election_id,
      ip_address: ip,
      created_at: new Date().toISOString(),
      ttl,
      votes_cast: {},
    }

    await db.send(new PutCommand({ TableName: Tables.VOTE_SESSIONS, Item: session }))

    const activePosition = election.started_at
      ? getActivePosition(positions, election.started_at)
      : null

    return ok({
      session_token: session.session_token,
      votes_cast: {},
      active_position: activePosition,
    })
  } catch (err) {
    return serverError(err)
  }
}

async function getPositions(electionId: string): Promise<Position[]> {
  const result = await db.send(
    new QueryCommand({
      TableName: Tables.POSITIONS,
      KeyConditionExpression: 'election_id = :eid',
      ExpressionAttributeValues: { ':eid': electionId },
      ScanIndexForward: true,
    })
  )
  return (result.Items ?? []) as Position[]
}
