import { Router, Request, Response } from 'express'
import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import { db, Tables } from '../lib/db/client'
import { send } from '../lib/utils/response'
import { requireAuth } from '../middleware/auth'

export const orgsRouter = Router()

// GET /orgs/me
orgsRouter.get('/me', requireAuth, (req: Request, res: Response) => {
  send.ok(res, req.org)
})

// GET /orgs/me/usage
orgsRouter.get('/me/usage', requireAuth, async (req: Request, res: Response) => {
  try {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const result = await db.send(new QueryCommand({
      TableName: Tables.ELECTIONS,
      IndexName: 'org-elections-index',
      KeyConditionExpression: 'org_id = :orgId AND created_at >= :monthStart',
      ExpressionAttributeValues: {
        ':orgId': req.org!.org_id,
        ':monthStart': monthStart,
      },
    }))
    const electionsThisMonth = result.Items?.length ?? 0
    const plan = req.org!.plan ?? 'free'
    const limits = { free: 1, standard: 2, pro: 2, standard_pro: 2 }
    const electionsLimit = (limits as Record<string, number>)[plan] ?? 1

    send.ok(res, {
      plan,
      electionsThisMonth,
      electionsLimit,
      electionsRemaining: Math.max(0, electionsLimit - electionsThisMonth),
      atLimit: electionsThisMonth >= electionsLimit,
    })
  } catch (err) { send.serverError(res, err) }
})
