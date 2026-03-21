import { Router, Request, Response } from 'express'
import { GetCommand, PutCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuid } from 'uuid'
import { db, Tables } from '../lib/db/client'
import { send } from '../lib/utils/response'
import { broadcast } from '../lib/websocket/broadcaster'
import { getActivePosition, getTotalDuration } from '../lib/utils/election-timing'
import { Candidate, Election, ElectionStatus, ElectionType, Position, SubmitVoteInput, Vote, VoteSession, Voter, WSEventType } from '../types'

export const votingRouter = Router()

// POST /vote/session — open elections only
// Called when voter lands on election page. Creates or returns an anonymous session token.
votingRouter.post('/session', async (req: Request, res: Response) => {
  try {
    const { election_id, session_token } = req.body
    if (!election_id) return send.badRequest(res, 'election_id is required')

    const election = await getElection(election_id)
    if (!election) return send.notFound(res, 'Election')
    if (election.type !== ElectionType.OPEN) return send.conflict(res, 'This election requires an invitation')
    if (election.status !== ElectionStatus.ACTIVE) return send.conflict(res, 'This election is not currently active')

    // Return existing session if valid
    if (session_token) {
      const existing = (await db.send(new GetCommand({ TableName: Tables.VOTE_SESSIONS, Key: { session_token } }))).Item as VoteSession | undefined
      if (existing && existing.election_id === election_id) {
        const positions = await getPositions(election_id)
        const activePosition = election.started_at ? getActivePosition(positions, election.started_at) : null
        return send.ok(res, { session_token: existing.session_token, votes_cast: existing.votes_cast, active_position: activePosition })
      }
    }

    // Create new anonymous session
    const positions = await getPositions(election_id)
    const ttl = Math.floor((new Date(election.started_at!).getTime() + (getTotalDuration(positions) + 3600) * 1000) / 1000)
    const session: VoteSession = {
      session_token: uuid(),
      election_id,
      ip_address: req.ip ?? 'unknown',
      created_at: new Date().toISOString(),
      ttl,
      votes_cast: {},
    }
    await db.send(new PutCommand({ TableName: Tables.VOTE_SESSIONS, Item: session }))

    const activePosition = election.started_at ? getActivePosition(positions, election.started_at) : null
    send.ok(res, { session_token: session.session_token, votes_cast: {}, active_position: activePosition })
  } catch (err) { send.serverError(res, err) }
})

// GET /vote/verify-token?token=xxx — closed elections only
votingRouter.get('/verify-token', async (req: Request, res: Response) => {
  try {
    const token = req.query.token as string
    if (!token) return send.unauthorized(res, 'Missing invite token')

    const voter = await getVoterByToken(token)
    if (!voter) return send.unauthorized(res, 'Invalid or expired invite link')
    if (voter.token_expires_at && new Date(voter.token_expires_at) < new Date()) return send.unauthorized(res, 'This invite link has expired')
    if (voter.voted_at) return send.conflict(res, 'You have already cast your vote')

    const election = await getElection(voter.election_id)
    if (!election) return send.notFound(res, 'Election')
    if (election.type !== ElectionType.CLOSED) return send.unauthorized(res, 'Invalid election type')
    // Allow DRAFT/SCHEDULED so closed voters can verify their token and join the lobby
    if ([ElectionStatus.CLOSED, ElectionStatus.RESULTS_PUBLISHED].includes(election.status)) return send.conflict(res, 'This election has ended')

    const positions = await getPositions(voter.election_id)
    const activePosition = election.started_at ? getActivePosition(positions, election.started_at) : null

    send.ok(res, { voter_id: voter.voter_id, election, positions, active_position: activePosition, votes_cast: voter.votes_cast })
  } catch (err) { send.serverError(res, err) }
})

// POST /vote/cast — both open and closed elections
votingRouter.post('/cast', async (req: Request, res: Response) => {
  try {
    const body: SubmitVoteInput = req.body
    if (!body?.election_id) return send.badRequest(res, 'election_id is required')
    if (!body.position_id) return send.badRequest(res, 'position_id is required')
    if (!body.candidate_id) return send.badRequest(res, 'candidate_id is required')

    const election = await getElection(body.election_id)
    if (!election) return send.notFound(res, 'Election')
    if (election.status !== ElectionStatus.ACTIVE) return send.conflict(res, 'This election is not accepting votes')

    // Validate active position
    const positions = await getPositions(body.election_id)
    const activeState = election.started_at ? getActivePosition(positions, election.started_at) : null
    if (!activeState) return send.conflict(res, 'No position is currently open for voting')
    if (activeState.position.position_id !== body.position_id) return send.conflict(res, 'This position is not currently open for voting')

    // Validate candidate
    const candidate = (await db.send(new GetCommand({ TableName: Tables.CANDIDATES, Key: { position_id: body.position_id, candidate_id: body.candidate_id } }))).Item as Candidate | undefined
    if (!candidate || candidate.election_id !== body.election_id) return send.notFound(res, 'Candidate')

    // Authenticate voter and prevent duplicates
    let voterRef: string

    if (election.type === ElectionType.OPEN) {
      const sessionToken = body.session_token ?? req.headers['x-session-token'] as string
      if (!sessionToken) return send.unauthorized(res, 'Session token is required')

      const session = (await db.send(new GetCommand({ TableName: Tables.VOTE_SESSIONS, Key: { session_token: sessionToken } }))).Item as VoteSession | undefined
      if (!session || session.election_id !== body.election_id) return send.unauthorized(res, 'Invalid session token')
      if (session.votes_cast[body.position_id]) return send.conflict(res, 'You have already voted for this position')

      await db.send(new UpdateCommand({
        TableName: Tables.VOTE_SESSIONS,
        Key: { session_token: sessionToken },
        UpdateExpression: 'SET votes_cast.#pid = :cid',
        ExpressionAttributeNames: { '#pid': body.position_id },
        ExpressionAttributeValues: { ':cid': body.candidate_id },
      }))
      voterRef = sessionToken
    } else {
      if (!body.invite_token) return send.unauthorized(res, 'Invite token is required')

      const voter = await getVoterByToken(body.invite_token)
      if (!voter || voter.election_id !== body.election_id) return send.unauthorized(res, 'Invalid invite token')
      if (voter.token_expires_at && new Date(voter.token_expires_at) < new Date()) return send.unauthorized(res, 'Your invite link has expired')
      if (voter.votes_cast[body.position_id]) return send.conflict(res, 'You have already voted for this position')

      const isLastPosition = positions[positions.length - 1].position_id === body.position_id
      const now = new Date().toISOString()
      await db.send(new UpdateCommand({
        TableName: Tables.VOTERS,
        Key: { election_id: body.election_id, voter_id: voter.voter_id },
        UpdateExpression: `SET votes_cast.#pid = :cid${isLastPosition ? ', voted_at = :now' : ''}`,
        ExpressionAttributeNames: { '#pid': body.position_id },
        ExpressionAttributeValues: { ':cid': body.candidate_id, ...(isLastPosition ? { ':now': now } : {}) },
      }))
      voterRef = voter.voter_id
    }

    // Write audit record
    const voteId = uuid()
    await db.send(new PutCommand({
      TableName: Tables.VOTES,
      Item: {
        vote_id: voteId, election_id: body.election_id, position_id: body.position_id,
        candidate_id: body.candidate_id, voter_ref: voterRef, created_at: new Date().toISOString(),
        vote_sk: `${body.position_id}#${body.candidate_id}#${voteId}`,
      } satisfies Vote & { vote_sk: string },
    }))

    // Atomic vote count increment
    // Note: election_id is the PK — never include it in UpdateExpression (key attrs cannot be updated)
    const updated = await db.send(new UpdateCommand({
      TableName: Tables.VOTE_COUNTS,
      Key: { election_id: body.election_id, position_candidate_sk: `${body.position_id}#${body.candidate_id}` },
      UpdateExpression: 'SET candidate_id = :cid, position_id = :pid ADD vote_count :one',
      ExpressionAttributeValues: { ':one': 1, ':cid': body.candidate_id, ':pid': body.position_id },
      ReturnValues: 'ALL_NEW',
    }))
    const newCount = (updated.Attributes?.vote_count as number) ?? 1

    // Broadcast to WebSocket clients
    const shouldBroadcast = election.type === ElectionType.OPEN || election.show_live_results
    if (shouldBroadcast) {
      await broadcast(body.election_id, {
        type: WSEventType.VOTE_UPDATE,
        election_id: body.election_id,
        payload: { position_id: body.position_id, candidate_id: body.candidate_id, vote_count: newCount },
      })
    }

    send.ok(res, { position_id: body.position_id, candidate_id: body.candidate_id, vote_count: newCount })
  } catch (err) { send.serverError(res, err) }
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getElection(id: string): Promise<Election | undefined> {
  return (await db.send(new GetCommand({ TableName: Tables.ELECTIONS, Key: { election_id: id } }))).Item as Election | undefined
}

async function getPositions(electionId: string): Promise<Position[]> {
  const r = await db.send(new QueryCommand({ TableName: Tables.POSITIONS, KeyConditionExpression: 'election_id = :eid', ExpressionAttributeValues: { ':eid': electionId }, ScanIndexForward: true }))
  return (r.Items ?? []) as Position[]
}

async function getVoterByToken(token: string): Promise<Voter | undefined> {
  const r = await db.send(new QueryCommand({ TableName: Tables.VOTERS, IndexName: 'invite-token-index', KeyConditionExpression: 'invite_token = :t', ExpressionAttributeValues: { ':t': token }, Limit: 1 }))
  return r.Items?.[0] as Voter | undefined
}
