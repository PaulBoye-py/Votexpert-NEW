import { Router, Request, Response } from 'express'
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuid } from 'uuid'
import { db, Tables } from '../lib/db/client'
import { send } from '../lib/utils/response'
import { Candidate, Election, ElectionStatus, LobbyParticipant, Position } from '../types'
import { getActivePosition } from '../lib/utils/election-timing'

export const publicRouter = Router()

// GET /public/elections/code/:code
// Look up election by its 6-digit join code — no auth required
publicRouter.get('/elections/code/:code', async (req: Request, res: Response) => {
  try {
    const result = await db.send(new QueryCommand({
      TableName: Tables.ELECTIONS,
      IndexName: 'election-code-index',
      KeyConditionExpression: 'election_code = :code',
      ExpressionAttributeValues: { ':code': req.params.code },
      Limit: 1,
    }))
    const election = result.Items?.[0] as Election | undefined
    if (!election) return send.notFound(res, 'Invalid code. Please check and try again.')
    if ([ElectionStatus.CLOSED, ElectionStatus.RESULTS_PUBLISHED].includes(election.status)) {
      return send.conflict(res, 'This election has already ended')
    }
    send.ok(res, {
      election_id: election.election_id,
      title: election.title,
      description: election.description,
      type: election.type,
      status: election.status,
      election_code: election.election_code,
    })
  } catch (err) { send.serverError(res, err) }
})

// GET /public/elections/:electionId
// No auth — used by voters joining via link, QR code, or lobby
publicRouter.get('/elections/:electionId', async (req: Request, res: Response) => {
  try {
    const election = (await db.send(new GetCommand({ TableName: Tables.ELECTIONS, Key: { election_id: req.params.electionId } }))).Item as Election | undefined
    if (!election) return send.notFound(res, 'Election')
    // Allow pre-active elections so voters can join the lobby and wait

    const positions = ((await db.send(new QueryCommand({
      TableName: Tables.POSITIONS,
      KeyConditionExpression: 'election_id = :eid',
      ExpressionAttributeValues: { ':eid': req.params.electionId },
      ScanIndexForward: true,
    }))).Items ?? []) as Position[]

    const candidates = ((await db.send(new QueryCommand({
      TableName: Tables.CANDIDATES,
      IndexName: 'election-candidates-index',
      KeyConditionExpression: 'election_id = :eid',
      ExpressionAttributeValues: { ':eid': req.params.electionId },
    }))).Items ?? []) as Candidate[]

    const voteCounts = Object.fromEntries(
      ((await db.send(new QueryCommand({
        TableName: Tables.VOTE_COUNTS,
        KeyConditionExpression: 'election_id = :eid',
        ExpressionAttributeValues: { ':eid': req.params.electionId },
      }))).Items ?? []).map(r => [`${r.position_id}#${r.candidate_id}`, r.vote_count as number])
    )

    const activePosition = election.started_at ? getActivePosition(positions, election.started_at) : null

    // Auto-publish: if election is ACTIVE but all positions have elapsed, publish results immediately
    if (election.status === ElectionStatus.ACTIVE && activePosition === null && election.started_at) {
      election.status = ElectionStatus.RESULTS_PUBLISHED
      await db.send(new UpdateCommand({
        TableName: Tables.ELECTIONS,
        Key: { election_id: req.params.electionId },
        UpdateExpression: 'SET #status = :published, updated_at = :now',
        ConditionExpression: '#status = :active',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':published': ElectionStatus.RESULTS_PUBLISHED,
          ':now': new Date().toISOString(),
          ':active': ElectionStatus.ACTIVE,
        },
      })).catch(() => { /* already published by another concurrent request — ignore */ })
    }

    send.ok(res, {
      election: {
        election_id: election.election_id, title: election.title, description: election.description,
        type: election.type, status: election.status, started_at: election.started_at,
        show_live_results: election.show_live_results,
        leaderboard_mode: election.leaderboard_mode ?? 'at_end',
      },
      positions: positions.map(pos => ({
        ...pos,
        candidates: candidates
          .filter(c => c.position_id === pos.position_id)
          .map(c => ({ ...c, vote_count: voteCounts[`${pos.position_id}#${c.candidate_id}`] ?? 0 })),
      })),
      active_position: activePosition,
    })
  } catch (err) { send.serverError(res, err) }
})

// POST /public/elections/:electionId/lobby
// Voter joins the lobby waiting room. Optional display_name (open elections).
// Returns a participant_id used to identify this voter in the lobby list.
publicRouter.post('/elections/:electionId/lobby', async (req: Request, res: Response) => {
  try {
    const { electionId } = req.params
    const election = (await db.send(new GetCommand({ TableName: Tables.ELECTIONS, Key: { election_id: electionId } }))).Item as Election | undefined
    if (!election) return send.notFound(res, 'Election')
    if ([ElectionStatus.CLOSED, ElectionStatus.RESULTS_PUBLISHED].includes(election.status)) {
      return send.conflict(res, 'This election has already ended')
    }

    const participant: LobbyParticipant = {
      participant_id: uuid(),
      election_id: electionId,
      display_name: (req.body?.display_name as string | undefined)?.trim() || 'Anonymous',
      joined_at: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + 86400, // 24 h TTL
    }
    await db.send(new PutCommand({ TableName: Tables.LOBBY_PARTICIPANTS, Item: participant }))
    send.created(res, { participant_id: participant.participant_id, display_name: participant.display_name })
  } catch (err) { send.serverError(res, err) }
})

// GET /public/elections/:electionId/lobby
// Returns current lobby state: election status + list of waiting participants.
publicRouter.get('/elections/:electionId/lobby', async (req: Request, res: Response) => {
  try {
    const { electionId } = req.params
    const election = (await db.send(new GetCommand({ TableName: Tables.ELECTIONS, Key: { election_id: electionId } }))).Item as Election | undefined
    if (!election) return send.notFound(res, 'Election')

    const participants = ((await db.send(new QueryCommand({
      TableName: Tables.LOBBY_PARTICIPANTS,
      KeyConditionExpression: 'election_id = :eid',
      ExpressionAttributeValues: { ':eid': electionId },
    }))).Items ?? []) as LobbyParticipant[]

    send.ok(res, {
      election_status: election.status,
      election_title: election.title,
      election_type: election.type,
      started_at: election.started_at ?? null,
      participants: participants
        .sort((a, b) => a.joined_at.localeCompare(b.joined_at))
        .map(p => ({ participant_id: p.participant_id, display_name: p.display_name, joined_at: p.joined_at })),
    })
  } catch (err) { send.serverError(res, err) }
})
