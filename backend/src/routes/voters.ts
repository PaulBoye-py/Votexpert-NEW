import { Router, Request, Response } from 'express'
import { GetCommand, PutCommand, DeleteCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuid } from 'uuid'
import { db, Tables } from '../lib/db/client'
import { requireAuth } from '../middleware/auth'
import { send } from '../lib/utils/response'
import { sendEmail, inviteEmailHtml } from '../lib/email/mailer'
import { Election, ElectionStatus, ElectionType, Voter } from '../types'

// Mounted at /elections/:electionId/voters via mergeParams
export const votersRouter = Router({ mergeParams: true })

votersRouter.use(requireAuth)

// GET /elections/:electionId/voters
votersRouter.get('/', async (req: Request, res: Response) => {
  try {
    if (!await assertOwnership(req, res)) return
    const result = await db.send(new QueryCommand({
      TableName: Tables.VOTERS,
      KeyConditionExpression: 'election_id = :eid',
      ExpressionAttributeValues: { ':eid': req.params.electionId },
    }))
    // Strip invite_token from admin view
    const voters = (result.Items ?? []).map(({ invite_token: _t, ...v }) => v)
    send.ok(res, voters)
  } catch (err) { send.serverError(res, err) }
})

// POST /elections/:electionId/voters  — { emails: string[] }
votersRouter.post('/', async (req: Request, res: Response) => {
  try {
    const election = await assertOwnership(req, res)
    if (!election) return
    if (election.type !== ElectionType.CLOSED) return send.badRequest(res, 'Voter management is only for closed elections')
    if (election.status === ElectionStatus.ACTIVE) return send.conflict(res, 'Cannot add voters to an active election')

    const emails: string[] = [...new Set<string>(
      (req.body?.emails ?? []).map((e: string) => e.trim().toLowerCase()).filter(Boolean)
    )]
    if (!emails.length) return send.badRequest(res, 'emails array is required')

    const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const now = new Date().toISOString()
    let added = 0; const skipped: string[] = []

    for (const email of emails) {
      const existing = await db.send(new QueryCommand({
        TableName: Tables.VOTERS,
        IndexName: 'election-email-index',
        KeyConditionExpression: 'election_id = :eid AND email = :email',
        ExpressionAttributeValues: { ':eid': req.params.electionId, ':email': email },
        Limit: 1,
      }))
      if (existing.Items?.length) { skipped.push(email); continue }

      const voter: Voter = {
        voter_id: uuid(),
        election_id: req.params.electionId,
        email,
        invite_token: uuid(),
        token_expires_at: tokenExpiresAt,
        votes_cast: {},
        created_at: now,
      }
      await db.send(new PutCommand({ TableName: Tables.VOTERS, Item: voter }))
      added++
    }
    send.ok(res, { added, skipped: skipped.length, skipped_emails: skipped })
  } catch (err) { send.serverError(res, err) }
})

// POST /elections/:electionId/voters/import  — { csv: string }
votersRouter.post('/import', async (req: Request, res: Response) => {
  try {
    const election = await assertOwnership(req, res)
    if (!election) return
    if (election.type !== ElectionType.CLOSED) return send.badRequest(res, 'Voter import is only for closed elections')

    const csv: string = req.body?.csv
    if (!csv) return send.badRequest(res, 'csv field is required')

    const lines = csv.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) return send.badRequest(res, 'CSV must have a header row and at least one data row')

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const emailCol = headers.indexOf('email')
    if (emailCol === -1) return send.badRequest(res, 'CSV must have an "email" column')

    const emails = [...new Set(
      lines.slice(1)
        .map(line => line.split(',')[emailCol]?.trim().toLowerCase())
        .filter(e => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    )]
    if (!emails.length) return send.badRequest(res, 'No valid emails found in CSV')

    const existingResult = await db.send(new QueryCommand({
      TableName: Tables.VOTERS,
      KeyConditionExpression: 'election_id = :eid',
      ExpressionAttributeValues: { ':eid': req.params.electionId },
      ProjectionExpression: 'email',
    }))
    const existingEmails = new Set((existingResult.Items ?? []).map(v => v.email as string))

    const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const now = new Date().toISOString()
    let added = 0; let skipped = 0

    for (const email of emails) {
      if (existingEmails.has(email)) { skipped++; continue }
      const voter: Voter = {
        voter_id: uuid(), election_id: req.params.electionId, email,
        invite_token: uuid(), token_expires_at: tokenExpiresAt, votes_cast: {}, created_at: now,
      }
      await db.send(new PutCommand({ TableName: Tables.VOTERS, Item: voter }))
      added++
    }
    send.ok(res, { added, skipped, total_in_csv: emails.length })
  } catch (err) { send.serverError(res, err) }
})

// POST /elections/:electionId/voters/send-invites  — { voter_ids?: string[] }
votersRouter.post('/send-invites', async (req: Request, res: Response) => {
  try {
    const election = await assertOwnership(req, res)
    if (!election) return
    if (election.type !== ElectionType.CLOSED) return send.badRequest(res, 'Invites are only for closed elections')

    const allVoters = (await db.send(new QueryCommand({
      TableName: Tables.VOTERS,
      KeyConditionExpression: 'election_id = :eid',
      ExpressionAttributeValues: { ':eid': req.params.electionId },
    }))).Items as Voter[]

    let voters = allVoters
    if (req.body?.voter_ids?.length) {
      const ids = new Set(req.body.voter_ids)
      voters = voters.filter(v => ids.has(v.voter_id))
    }
    if (!voters.length) return send.badRequest(res, 'No voters found')

    const appUrl = process.env.APP_URL ?? 'http://localhost:5173'
    const now = new Date().toISOString()
    let sent = 0; let failed = 0

    for (const voter of voters) {
      try {
        await sendEmail({
          to: voter.email,
          subject: `You've been invited to vote: ${election.title}`,
          html: inviteEmailHtml({
            electionTitle: election.title,
            orgName: req.org!.name,
            inviteUrl: `${appUrl}/vote/${req.params.electionId}?token=${voter.invite_token}`,
            expiresAt: voter.token_expires_at,
          }),
        })
        await db.send(new UpdateCommand({
          TableName: Tables.VOTERS,
          Key: { election_id: req.params.electionId, voter_id: voter.voter_id },
          UpdateExpression: 'SET invite_sent_at = :now',
          ExpressionAttributeValues: { ':now': now },
        }))
        sent++
      } catch (e) { console.error(`Failed to send to ${voter.email}:`, e); failed++ }
    }
    send.ok(res, { sent, failed, total: voters.length })
  } catch (err) { send.serverError(res, err) }
})

// DELETE /elections/:electionId/voters/:voterId
votersRouter.delete('/:voterId', async (req: Request, res: Response) => {
  try {
    const election = await assertOwnership(req, res)
    if (!election) return
    if (election.status === ElectionStatus.ACTIVE) return send.conflict(res, 'Cannot remove voters from an active election')

    const voter = (await db.send(new GetCommand({
      TableName: Tables.VOTERS,
      Key: { election_id: req.params.electionId, voter_id: req.params.voterId },
    }))).Item
    if (!voter) return send.notFound(res, 'Voter')

    await db.send(new DeleteCommand({ TableName: Tables.VOTERS, Key: { election_id: req.params.electionId, voter_id: req.params.voterId } }))
    send.noContent(res)
  } catch (err) { send.serverError(res, err) }
})

// ─── Helper ───────────────────────────────────────────────────────────────────

async function assertOwnership(req: Request, res: Response): Promise<Election | null> {
  const result = await db.send(new GetCommand({ TableName: Tables.ELECTIONS, Key: { election_id: req.params.electionId } }))
  const election = result.Item as Election | undefined
  if (!election) { send.notFound(res, 'Election'); return null }
  if (election.org_id !== req.org!.org_id) { send.forbidden(res); return null }
  return election
}
