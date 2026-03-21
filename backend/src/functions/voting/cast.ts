import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuid } from 'uuid'
import { db, Tables } from '../../lib/db/client'
import { parseBody, getSessionToken } from '../../lib/auth/middleware'
import { badRequest, conflict, notFound, ok, serverError, unauthorized } from '../../lib/utils/response'
import { broadcast } from '../../lib/websocket/broadcaster'
import {
  Candidate, Election, ElectionStatus, ElectionType,
  Position, SubmitVoteInput, Vote, VoteSession, Voter, WSEventType,
} from '../../types'
import { getActivePosition } from '../../lib/utils/election-timing'

// POST /vote/cast
// Handles vote submission for BOTH open and closed elections.
//
// Open elections:  authenticated by session_token (from X-Session-Token header or body)
// Closed elections: authenticated by invite_token (from body)
//
// On success:
//   1. Records the vote in the audit trail (VotesTable)
//   2. Atomically increments the candidate's vote count (VoteCountsTable)
//   3. Marks the voter/session as having voted for this position
//   4. Broadcasts updated vote counts to all WebSocket clients
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = parseBody<SubmitVoteInput>(event)
    if (!body?.election_id) return badRequest('election_id is required')
    if (!body.position_id) return badRequest('position_id is required')
    if (!body.candidate_id) return badRequest('candidate_id is required')

    // ── Fetch & validate election ───────────────────────────────────────────
    const election = (
      await db.send(new GetCommand({ TableName: Tables.ELECTIONS, Key: { election_id: body.election_id } }))
    ).Item as Election | undefined

    if (!election) return notFound('Election')
    if (election.status !== ElectionStatus.ACTIVE) {
      return conflict('This election is not currently accepting votes')
    }

    // ── Validate the active position ────────────────────────────────────────
    // The voter can only vote for the CURRENTLY active position.
    // This prevents submitting votes for positions that have already passed
    // or haven't opened yet.
    const positionsResult = await db.send(
      new QueryCommand({
        TableName: Tables.POSITIONS,
        KeyConditionExpression: 'election_id = :eid',
        ExpressionAttributeValues: { ':eid': body.election_id },
        ScanIndexForward: true,
      })
    )
    const positions = (positionsResult.Items ?? []) as Position[]
    const activeState = election.started_at
      ? getActivePosition(positions, election.started_at)
      : null

    if (!activeState) {
      return conflict('No position is currently open for voting')
    }
    if (activeState.position.position_id !== body.position_id) {
      return conflict('This position is not currently open for voting')
    }

    // ── Validate the candidate belongs to this position ──────────────────────
    const candidate = (
      await db.send(
        new GetCommand({
          TableName: Tables.CANDIDATES,
          Key: { position_id: body.position_id, candidate_id: body.candidate_id },
        })
      )
    ).Item as Candidate | undefined

    if (!candidate || candidate.election_id !== body.election_id) {
      return notFound('Candidate')
    }

    // ── Authenticate & check duplicate vote ─────────────────────────────────
    if (election.type === ElectionType.OPEN) {
      // Open election: authenticate via session token
      const sessionToken = body.session_token ?? getSessionToken(event)
      if (!sessionToken) return unauthorized('Session token is required')

      const session = (
        await db.send(new GetCommand({ TableName: Tables.VOTE_SESSIONS, Key: { session_token: sessionToken } }))
      ).Item as VoteSession | undefined

      if (!session || session.election_id !== body.election_id) {
        return unauthorized('Invalid session token')
      }

      // Prevent voting twice for the same position
      if (session.votes_cast[body.position_id]) {
        return conflict('You have already voted for this position')
      }

      // Record the vote on the session
      await db.send(
        new UpdateCommand({
          TableName: Tables.VOTE_SESSIONS,
          Key: { session_token: sessionToken },
          UpdateExpression: 'SET votes_cast.#pid = :cid',
          ExpressionAttributeNames: { '#pid': body.position_id },
          ExpressionAttributeValues: { ':cid': body.candidate_id },
        })
      )
    } else {
      // Closed election: authenticate via invite token
      if (!body.invite_token) return unauthorized('Invite token is required')

      const voterResult = await db.send(
        new QueryCommand({
          TableName: Tables.VOTERS,
          IndexName: 'invite-token-index',
          KeyConditionExpression: 'invite_token = :token',
          ExpressionAttributeValues: { ':token': body.invite_token },
          Limit: 1,
        })
      )
      const voter = voterResult.Items?.[0] as Voter | undefined

      if (!voter || voter.election_id !== body.election_id) {
        return unauthorized('Invalid invite token')
      }
      if (voter.token_expires_at && new Date(voter.token_expires_at) < new Date()) {
        return unauthorized('Your invite link has expired')
      }

      // Prevent voting twice for the same position
      if (voter.votes_cast[body.position_id]) {
        return conflict('You have already voted for this position')
      }

      const now = new Date().toISOString()
      const isLastPosition = positions[positions.length - 1].position_id === body.position_id

      await db.send(
        new UpdateCommand({
          TableName: Tables.VOTERS,
          Key: { election_id: body.election_id, voter_id: voter.voter_id },
          UpdateExpression: `SET votes_cast.#pid = :cid ${isLastPosition ? ', voted_at = :now' : ''}`,
          ExpressionAttributeNames: { '#pid': body.position_id },
          ExpressionAttributeValues: { ':cid': body.candidate_id, ...(isLastPosition ? { ':now': now } : {}) },
        })
      )
    }

    // ── Write audit vote record ──────────────────────────────────────────────
    const voteRecord: Vote = {
      vote_id: uuid(),
      election_id: body.election_id,
      position_id: body.position_id,
      candidate_id: body.candidate_id,
      voter_ref: body.session_token ?? body.invite_token ?? 'unknown',
      created_at: new Date().toISOString(),
    }

    await db.send(
      new PutCommand({
        TableName: Tables.VOTES,
        Item: {
          ...voteRecord,
          vote_sk: `${body.position_id}#${body.candidate_id}#${voteRecord.vote_id}`,
        },
      })
    )

    // ── Atomically increment vote count ──────────────────────────────────────
    const updatedCounts = await db.send(
      new UpdateCommand({
        TableName: Tables.VOTE_COUNTS,
        Key: {
          election_id: body.election_id,
          position_candidate_sk: `${body.position_id}#${body.candidate_id}`,
        },
        UpdateExpression: 'ADD vote_count :one SET candidate_id = :cid, position_id = :pid, election_id = :eid',
        ExpressionAttributeValues: {
          ':one': 1,
          ':cid': body.candidate_id,
          ':pid': body.position_id,
          ':eid': body.election_id,
        },
        ReturnValues: 'ALL_NEW',
      })
    )

    const newCount = (updatedCounts.Attributes?.vote_count as number) ?? 1

    // ── Broadcast updated count to WebSocket clients ──────────────────────────
    // Only broadcast for open elections (or closed elections with show_live_results=true)
    const shouldBroadcast =
      election.type === ElectionType.OPEN ||
      (election.type === ElectionType.CLOSED && election.show_live_results)

    if (shouldBroadcast) {
      await broadcast(body.election_id, {
        type: WSEventType.VOTE_UPDATE,
        election_id: body.election_id,
        payload: {
          position_id: body.position_id,
          candidate_id: body.candidate_id,
          vote_count: newCount,
        },
      })
    }

    return ok({
      success: true,
      position_id: body.position_id,
      candidate_id: body.candidate_id,
      vote_count: newCount,
    })
  } catch (err) {
    return serverError(err)
  }
}
