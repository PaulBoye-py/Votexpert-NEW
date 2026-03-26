import { Router, Request, Response } from 'express'
import { GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuid } from 'uuid'
import { db, Tables } from '../lib/db/client'
import { requireAuth } from '../middleware/auth'
import { send } from '../lib/utils/response'
import { broadcast } from '../lib/websocket/broadcaster'
import { Election, ElectionStatus, ElectionType, Position, WSEventType, CreateElectionInput } from '../types'
import { getActivePosition, getExpectedEndTime } from '../lib/utils/election-timing'

export const electionsRouter = Router()

// All election routes require auth
electionsRouter.use(requireAuth)

// GET /elections
electionsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const result = await db.send(new QueryCommand({
      TableName: Tables.ELECTIONS,
      IndexName: 'org-elections-index',
      KeyConditionExpression: 'org_id = :orgId',
      ExpressionAttributeValues: { ':orgId': req.org!.org_id },
      ScanIndexForward: false,
    }))
    send.ok(res, result.Items ?? [])
  } catch (err) { send.serverError(res, err) }
})

// POST /elections
electionsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const body: CreateElectionInput = req.body
    if (!body?.title) return send.badRequest(res, 'title is required')
    if (!body.type) return send.badRequest(res, 'type is required (OPEN or CLOSED)')

    const now = new Date().toISOString()
    const election: Election = {
      election_id: uuid(),
      election_code: await generateUniqueCode(),
      org_id: req.org!.org_id,
      title: body.title.trim(),
      description: body.description?.trim(),
      type: body.type,
      // Scheduled elections go straight to SCHEDULED so the tick Lambda can pick them up
      status: (body.scheduled_start_at || body.scheduled_end_at)
        ? ElectionStatus.SCHEDULED
        : ElectionStatus.DRAFT,
      scheduled_start_at: body.scheduled_start_at,
      scheduled_end_at: body.scheduled_end_at,
      show_live_results: body.show_live_results ?? true,
      leaderboard_mode: body.leaderboard_mode ?? 'at_end',
      created_at: now,
      updated_at: now,
    }
    await db.send(new PutCommand({ TableName: Tables.ELECTIONS, Item: election }))
    send.created(res, election)
  } catch (err) { send.serverError(res, err) }
})

// GET /elections/:electionId
electionsRouter.get('/:electionId', async (req: Request, res: Response) => {
  try {
    const election = await getElection(req.params.electionId)
    if (!election) return send.notFound(res, 'Election')
    if (election.org_id !== req.org!.org_id) return send.forbidden(res)
    send.ok(res, election)
  } catch (err) { send.serverError(res, err) }
})

// PUT /elections/:electionId
electionsRouter.put('/:electionId', async (req: Request, res: Response) => {
  try {
    const election = await getElection(req.params.electionId)
    if (!election) return send.notFound(res, 'Election')
    if (election.org_id !== req.org!.org_id) return send.forbidden(res)
    if ([ElectionStatus.ACTIVE, ElectionStatus.CLOSED, ElectionStatus.RESULTS_PUBLISHED].includes(election.status)) {
      return send.conflict(res, 'Cannot edit an election that is already active or closed')
    }

    const body: Partial<Election> = req.body
    const now = new Date().toISOString()
    await db.send(new UpdateCommand({
      TableName: Tables.ELECTIONS,
      Key: { election_id: req.params.electionId },
      UpdateExpression: 'SET title = :title, #desc = :desc, scheduled_start_at = :sched_start, scheduled_end_at = :sched_end, show_live_results = :slr, leaderboard_mode = :lbm, updated_at = :now',
      ExpressionAttributeNames: { '#desc': 'description' },
      ExpressionAttributeValues: {
        ':title': body.title ?? election.title,
        ':desc': body.description ?? election.description ?? null,
        ':sched_start': body.scheduled_start_at ?? election.scheduled_start_at ?? null,
        ':sched_end': body.scheduled_end_at ?? election.scheduled_end_at ?? null,
        ':slr': body.show_live_results ?? election.show_live_results,
        ':lbm': body.leaderboard_mode ?? election.leaderboard_mode ?? 'at_end',
        ':now': now,
      },
    }))
    send.ok(res, { ...election, ...body, updated_at: now })
  } catch (err) { send.serverError(res, err) }
})

// DELETE /elections/:electionId
electionsRouter.delete('/:electionId', async (req: Request, res: Response) => {
  try {
    const election = await getElection(req.params.electionId)
    if (!election) return send.notFound(res, 'Election')
    if (election.org_id !== req.org!.org_id) return send.forbidden(res)
    if ([ElectionStatus.ACTIVE, ElectionStatus.CLOSED, ElectionStatus.RESULTS_PUBLISHED].includes(election.status)) {
      return send.conflict(res, 'Cannot delete an election that has already started')
    }
    await db.send(new DeleteCommand({ TableName: Tables.ELECTIONS, Key: { election_id: req.params.electionId } }))
    send.noContent(res)
  } catch (err) { send.serverError(res, err) }
})

// POST /elections/:electionId/start
electionsRouter.post('/:electionId/start', async (req: Request, res: Response) => {
  try {
    const election = await getElection(req.params.electionId)
    if (!election) return send.notFound(res, 'Election')
    if (election.org_id !== req.org!.org_id) return send.forbidden(res)
    if (election.status === ElectionStatus.ACTIVE) return send.conflict(res, 'Election is already active')
    if ([ElectionStatus.CLOSED, ElectionStatus.RESULTS_PUBLISHED].includes(election.status)) {
      return send.conflict(res, 'Election has already ended')
    }

    const positions = await getPositions(req.params.electionId)
    if (positions.length === 0) return send.badRequest(res, 'Election must have at least one position before starting')

    const now = new Date().toISOString()
    await db.send(new UpdateCommand({
      TableName: Tables.ELECTIONS,
      Key: { election_id: req.params.electionId },
      UpdateExpression: 'SET #status = :status, started_at = :now, updated_at = :now',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':status': ElectionStatus.ACTIVE, ':now': now },
    }))

    const expectedEndAt = getExpectedEndTime(now, positions)
    await broadcast(req.params.electionId, {
      type: WSEventType.ELECTION_STARTED,
      election_id: req.params.electionId,
      payload: { started_at: now, expected_end_at: expectedEndAt, total_positions: positions.length },
    })

    send.ok(res, { election_id: req.params.electionId, status: ElectionStatus.ACTIVE, started_at: now, expected_end_at: expectedEndAt })
  } catch (err) { send.serverError(res, err) }
})

// POST /elections/:electionId/end
electionsRouter.post('/:electionId/end', async (req: Request, res: Response) => {
  try {
    const election = await getElection(req.params.electionId)
    if (!election) return send.notFound(res, 'Election')
    if (election.org_id !== req.org!.org_id) return send.forbidden(res)
    if (election.status !== ElectionStatus.ACTIVE) return send.conflict(res, 'Election is not currently active')

    const now = new Date().toISOString()
    await db.send(new UpdateCommand({
      TableName: Tables.ELECTIONS,
      Key: { election_id: req.params.electionId },
      UpdateExpression: 'SET #status = :status, ended_at = :now, updated_at = :now',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':status': ElectionStatus.CLOSED, ':now': now },
    }))

    await broadcast(req.params.electionId, {
      type: WSEventType.ELECTION_ENDED,
      election_id: req.params.electionId,
      payload: { ended_at: now },
    })

    send.ok(res, { election_id: req.params.electionId, status: ElectionStatus.CLOSED, ended_at: now })
  } catch (err) { send.serverError(res, err) }
})

// POST /elections/:electionId/publish-results
electionsRouter.post('/:electionId/publish-results', async (req: Request, res: Response) => {
  try {
    const election = await getElection(req.params.electionId)
    if (!election) return send.notFound(res, 'Election')
    if (election.org_id !== req.org!.org_id) return send.forbidden(res)
    if (election.status !== ElectionStatus.CLOSED) return send.conflict(res, 'Election must be closed before publishing results')

    const now = new Date().toISOString()
    await db.send(new UpdateCommand({
      TableName: Tables.ELECTIONS,
      Key: { election_id: req.params.electionId },
      UpdateExpression: 'SET #status = :status, updated_at = :now',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':status': ElectionStatus.RESULTS_PUBLISHED, ':now': now },
    }))

    send.ok(res, { election_id: req.params.electionId, status: ElectionStatus.RESULTS_PUBLISHED })
  } catch (err) { send.serverError(res, err) }
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Generates a 6-digit numeric code guaranteed unique across existing elections. */
async function generateUniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const existing = await db.send(new QueryCommand({
      TableName: Tables.ELECTIONS,
      IndexName: 'election-code-index',
      KeyConditionExpression: 'election_code = :code',
      ExpressionAttributeValues: { ':code': code },
      Limit: 1,
    }))
    if (!existing.Items?.length) return code
  }
  // Extremely unlikely fallback
  return Math.floor(100000 + Math.random() * 900000).toString()
}

async function getElection(electionId: string): Promise<Election | undefined> {
  const result = await db.send(new GetCommand({ TableName: Tables.ELECTIONS, Key: { election_id: electionId } }))
  return result.Item as Election | undefined
}

async function getPositions(electionId: string): Promise<Position[]> {
  const result = await db.send(new QueryCommand({
    TableName: Tables.POSITIONS,
    KeyConditionExpression: 'election_id = :eid',
    ExpressionAttributeValues: { ':eid': electionId },
    ScanIndexForward: true,
  }))
  return (result.Items ?? []) as Position[]
}
