import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { GetCommand, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuid } from 'uuid'
import { db, Tables } from '../../lib/db/client'
import { getRequestOrg, parseBody } from '../../lib/auth/middleware'
import { badRequest, forbidden, notFound, ok, serverError, unauthorized } from '../../lib/utils/response'
import { Election, ElectionType, Voter } from '../../types'

// POST /elections/{electionId}/voters/import
// Body: { csv: string } — raw CSV content with an "email" column
// Parses CSV, deduplicates, and bulk-adds voters.
// Expected CSV format:
//   email
//   alice@example.com
//   bob@example.com
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const org = await getRequestOrg(event)
    if (!org) return unauthorized()

    const electionId = event.pathParameters?.electionId
    if (!electionId) return notFound('Election')

    const election = (
      await db.send(new GetCommand({ TableName: Tables.ELECTIONS, Key: { election_id: electionId } }))
    ).Item as Election | undefined

    if (!election) return notFound('Election')
    if (election.org_id !== org.org_id) return forbidden()
    if (election.type !== ElectionType.CLOSED) {
      return badRequest('Voter import is only available for closed elections')
    }

    const body = parseBody<{ csv: string }>(event)
    if (!body?.csv) return badRequest('csv field is required')

    // Parse CSV — handle both \r\n and \n line endings
    const lines = body.csv.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length < 2) return badRequest('CSV must have a header row and at least one data row')

    // Find the email column index (case-insensitive header)
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
    const emailCol = headers.indexOf('email')
    if (emailCol === -1) return badRequest('CSV must have an "email" column')

    const emails = [...new Set(
      lines.slice(1)
        .map((line) => line.split(',')[emailCol]?.trim().toLowerCase())
        .filter((e) => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    )]

    if (emails.length === 0) return badRequest('No valid email addresses found in CSV')

    // Fetch existing voters to skip duplicates
    const existingResult = await db.send(
      new QueryCommand({
        TableName: Tables.VOTERS,
        KeyConditionExpression: 'election_id = :eid',
        ExpressionAttributeValues: { ':eid': electionId },
        ProjectionExpression: 'email',
      })
    )
    const existingEmails = new Set(
      (existingResult.Items ?? []).map((v) => v.email as string)
    )

    const now = new Date().toISOString()
    const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    let added = 0
    let skipped = 0

    for (const email of emails) {
      if (existingEmails.has(email)) {
        skipped++
        continue
      }

      const voter: Voter = {
        voter_id: uuid(),
        election_id: electionId,
        email,
        invite_token: uuid(),
        token_expires_at: tokenExpiresAt,
        votes_cast: {},
        created_at: now,
      }

      await db.send(new PutCommand({ TableName: Tables.VOTERS, Item: voter }))
      added++
    }

    return ok({ added, skipped, total_in_csv: emails.length })
  } catch (err) {
    return serverError(err)
  }
}
