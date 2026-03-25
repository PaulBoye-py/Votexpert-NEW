import { Router, Request, Response } from 'express'
import { DeleteCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuid } from 'uuid'
import { db, Tables } from '../lib/db/client'
import { requireAuth } from '../middleware/auth'
import { send } from '../lib/utils/response'
import { OrgVoter } from '../types'

// Mounted at /org-voters
export const orgVotersRouter = Router()
orgVotersRouter.use(requireAuth)

// GET /org-voters — list the org's voter pool
orgVotersRouter.get('/', async (req: Request, res: Response) => {
  try {
    const result = await db.send(new QueryCommand({
      TableName: Tables.ORG_VOTERS,
      KeyConditionExpression: 'org_id = :oid',
      ExpressionAttributeValues: { ':oid': req.org!.org_id },
    }))
    send.ok(res, result.Items ?? [])
  } catch (err) { send.serverError(res, err) }
})

// POST /org-voters — add voters to the pool
// Body: { emails: string[] }
orgVotersRouter.post('/', async (req: Request, res: Response) => {
  try {
    const emails: string[] = [...new Set<string>(
      (req.body?.emails ?? []).map((e: string) => e.trim().toLowerCase()).filter(Boolean)
    )]
    if (!emails.length) return send.badRequest(res, 'emails array is required')

    // Fetch existing emails for this org to detect duplicates
    const existingResult = await db.send(new QueryCommand({
      TableName: Tables.ORG_VOTERS,
      KeyConditionExpression: 'org_id = :oid',
      ExpressionAttributeValues: { ':oid': req.org!.org_id },
      ProjectionExpression: 'email',
    }))
    const existingEmails = new Set((existingResult.Items ?? []).map((v) => v.email as string))

    const now = new Date().toISOString()
    let added = 0
    const skipped: string[] = []

    for (const email of emails) {
      if (existingEmails.has(email)) { skipped.push(email); continue }

      const voter: OrgVoter = {
        org_voter_id: uuid(),
        org_id: req.org!.org_id,
        email,
        created_at: now,
      }
      await db.send(new PutCommand({ TableName: Tables.ORG_VOTERS, Item: voter }))
      added++
    }

    send.ok(res, { added, skipped: skipped.length, skipped_emails: skipped })
  } catch (err) { send.serverError(res, err) }
})

// DELETE /org-voters/:orgVoterId — remove from pool
orgVotersRouter.delete('/:orgVoterId', async (req: Request, res: Response) => {
  try {
    await db.send(new DeleteCommand({
      TableName: Tables.ORG_VOTERS,
      Key: { org_id: req.org!.org_id, org_voter_id: req.params.orgVoterId },
    }))
    send.noContent(res)
  } catch (err) { send.serverError(res, err) }
})
