import { Router, Request, Response } from 'express'
import { send } from '../lib/utils/response'
import { requireAuth } from '../middleware/auth'

export const orgsRouter = Router()

// GET /orgs/me
orgsRouter.get('/me', requireAuth, (req: Request, res: Response) => {
  send.ok(res, req.org)
})
