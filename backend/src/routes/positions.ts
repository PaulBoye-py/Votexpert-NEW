import { Router, Request, Response } from 'express'
import { GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuid } from 'uuid'
import { db, Tables } from '../lib/db/client'
import { requireAuth } from '../middleware/auth'
import { send } from '../lib/utils/response'
import { Election, ElectionStatus, Position, CreatePositionInput } from '../types'

// Mounted at /elections/:electionId/positions via mergeParams
export const positionsRouter = Router({ mergeParams: true })

positionsRouter.use(requireAuth)

// GET /elections/:electionId/positions
positionsRouter.get('/', async (req: Request, res: Response) => {
  try {
    if (!await assertOwnership(req, res)) return
    const result = await db.send(new QueryCommand({
      TableName: Tables.POSITIONS,
      KeyConditionExpression: 'election_id = :eid',
      ExpressionAttributeValues: { ':eid': req.params.electionId },
      ScanIndexForward: true,
    }))
    send.ok(res, result.Items ?? [])
  } catch (err) { send.serverError(res, err) }
})

// POST /elections/:electionId/positions
positionsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const election = await assertOwnership(req, res)
    if (!election) return
    if (election.status === ElectionStatus.ACTIVE) return send.conflict(res, 'Cannot add positions to an active election')

    const body: CreatePositionInput = req.body
    if (!body?.title) return send.badRequest(res, 'title is required')
    // Scheduled elections (have scheduled_end_at) don't use per-position timers
    const isScheduled = !!(election.scheduled_start_at || election.scheduled_end_at)
    if (!isScheduled && (!body.duration_seconds || body.duration_seconds < 10)) {
      return send.badRequest(res, 'duration_seconds must be at least 10')
    }

    // Auto-assign order if not provided
    let order = body.position_order
    if (!order) {
      const existing = await db.send(new QueryCommand({
        TableName: Tables.POSITIONS,
        KeyConditionExpression: 'election_id = :eid',
        ExpressionAttributeValues: { ':eid': req.params.electionId },
        Select: 'COUNT',
      }))
      order = (existing.Count ?? 0) + 1
    }

    const now = new Date().toISOString()
    const position: Position = {
      position_id: uuid(),
      election_id: req.params.electionId,
      title: body.title.trim(),
      description: body.description?.trim(),
      position_order: order,
      duration_seconds: body.duration_seconds,
      created_at: now,
      updated_at: now,
    }
    await db.send(new PutCommand({ TableName: Tables.POSITIONS, Item: position }))
    send.created(res, position)
  } catch (err) { send.serverError(res, err) }
})

// PUT /elections/:electionId/positions/:positionId
positionsRouter.put('/:positionId', async (req: Request, res: Response) => {
  try {
    if (!await assertOwnership(req, res)) return
    const position = await getPosition(req.params.positionId, req.params.electionId)
    if (!position) return send.notFound(res, 'Position')

    const body: Partial<Position> = req.body
    const now = new Date().toISOString()
    await db.send(new UpdateCommand({
      TableName: Tables.POSITIONS,
      Key: { election_id: req.params.electionId, position_order: position.position_order },
      UpdateExpression: 'SET title = :title, #desc = :desc, duration_seconds = :dur, updated_at = :now',
      ExpressionAttributeNames: { '#desc': 'description' },
      ExpressionAttributeValues: {
        ':title': body.title ?? position.title,
        ':desc': body.description ?? position.description ?? null,
        ':dur': body.duration_seconds ?? position.duration_seconds,
        ':now': now,
      },
    }))
    send.ok(res, { ...position, ...body, updated_at: now })
  } catch (err) { send.serverError(res, err) }
})

// DELETE /elections/:electionId/positions/:positionId
positionsRouter.delete('/:positionId', async (req: Request, res: Response) => {
  try {
    const election = await assertOwnership(req, res)
    if (!election) return
    if (election.status === ElectionStatus.ACTIVE) return send.conflict(res, 'Cannot delete positions from an active election')

    const position = await getPosition(req.params.positionId, req.params.electionId)
    if (!position) return send.notFound(res, 'Position')

    await db.send(new DeleteCommand({
      TableName: Tables.POSITIONS,
      Key: { election_id: req.params.electionId, position_order: position.position_order },
    }))
    send.noContent(res)
  } catch (err) { send.serverError(res, err) }
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function assertOwnership(req: Request, res: Response): Promise<Election | null> {
  const result = await db.send(new GetCommand({ TableName: Tables.ELECTIONS, Key: { election_id: req.params.electionId } }))
  const election = result.Item as Election | undefined
  if (!election) { send.notFound(res, 'Election'); return null }
  if (election.org_id !== req.org!.org_id) { send.forbidden(res); return null }
  return election
}

async function getPosition(positionId: string, electionId: string): Promise<Position | undefined> {
  const result = await db.send(new QueryCommand({
    TableName: Tables.POSITIONS,
    IndexName: 'position-id-index',
    KeyConditionExpression: 'position_id = :pid',
    ExpressionAttributeValues: { ':pid': positionId },
    Limit: 1,
  }))
  const pos = result.Items?.[0] as Position | undefined
  return pos?.election_id === electionId ? pos : undefined
}
