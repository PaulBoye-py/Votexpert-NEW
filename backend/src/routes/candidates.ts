import { Router, Request, Response } from 'express'
import { GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuid } from 'uuid'
import { db, Tables } from '../lib/db/client'
import { requireAuth } from '../middleware/auth'
import { send } from '../lib/utils/response'
import { Candidate, CreateCandidateInput, Election, ElectionStatus } from '../types'

// Mounted at /elections/:electionId/positions/:positionId/candidates via mergeParams
export const candidatesRouter = Router({ mergeParams: true })

candidatesRouter.use(requireAuth)

// GET /elections/:electionId/positions/:positionId/candidates
candidatesRouter.get('/', async (req: Request, res: Response) => {
  try {
    if (!await assertOwnership(req, res)) return
    const result = await db.send(new QueryCommand({
      TableName: Tables.CANDIDATES,
      KeyConditionExpression: 'position_id = :pid',
      ExpressionAttributeValues: { ':pid': req.params.positionId },
    }))
    send.ok(res, result.Items ?? [])
  } catch (err) { send.serverError(res, err) }
})

// POST /elections/:electionId/positions/:positionId/candidates
candidatesRouter.post('/', async (req: Request, res: Response) => {
  try {
    const election = await assertOwnership(req, res)
    if (!election) return
    if (election.status === ElectionStatus.ACTIVE) return send.conflict(res, 'Cannot add candidates to an active election')

    const body: CreateCandidateInput = req.body
    if (!body?.name) return send.badRequest(res, 'name is required')

    const now = new Date().toISOString()
    const candidate: Candidate = {
      candidate_id: uuid(),
      position_id: req.params.positionId,
      election_id: req.params.electionId,
      name: body.name.trim(),
      photo_url: body.photo_url,
      bio: body.bio?.trim(),
      vote_count: 0,
      created_at: now,
      updated_at: now,
    }
    await db.send(new PutCommand({ TableName: Tables.CANDIDATES, Item: candidate }))
    send.created(res, candidate)
  } catch (err) { send.serverError(res, err) }
})

// PUT /elections/:electionId/positions/:positionId/candidates/:candidateId
candidatesRouter.put('/:candidateId', async (req: Request, res: Response) => {
  try {
    if (!await assertOwnership(req, res)) return
    const candidate = await getCandidate(req.params.positionId, req.params.candidateId, req.params.electionId)
    if (!candidate) return send.notFound(res, 'Candidate')

    const body: Partial<Candidate> = req.body
    const now = new Date().toISOString()
    await db.send(new UpdateCommand({
      TableName: Tables.CANDIDATES,
      Key: { position_id: req.params.positionId, candidate_id: req.params.candidateId },
      UpdateExpression: 'SET #name = :name, photo_url = :photo, bio = :bio, updated_at = :now',
      ExpressionAttributeNames: { '#name': 'name' },
      ExpressionAttributeValues: {
        ':name': body.name ?? candidate.name,
        ':photo': body.photo_url ?? candidate.photo_url ?? null,
        ':bio': body.bio ?? candidate.bio ?? null,
        ':now': now,
      },
    }))
    send.ok(res, { ...candidate, ...body, updated_at: now })
  } catch (err) { send.serverError(res, err) }
})

// DELETE /elections/:electionId/positions/:positionId/candidates/:candidateId
candidatesRouter.delete('/:candidateId', async (req: Request, res: Response) => {
  try {
    if (!await assertOwnership(req, res)) return
    const candidate = await getCandidate(req.params.positionId, req.params.candidateId, req.params.electionId)
    if (!candidate) return send.notFound(res, 'Candidate')
    await db.send(new DeleteCommand({ TableName: Tables.CANDIDATES, Key: { position_id: req.params.positionId, candidate_id: req.params.candidateId } }))
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

async function getCandidate(positionId: string, candidateId: string, electionId: string): Promise<Candidate | undefined> {
  const result = await db.send(new GetCommand({ TableName: Tables.CANDIDATES, Key: { position_id: positionId, candidate_id: candidateId } }))
  const c = result.Item as Candidate | undefined
  return c?.election_id === electionId ? c : undefined
}
