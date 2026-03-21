import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { GetCommand, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuid } from 'uuid'
import { db, Tables } from '../../lib/db/client'
import { getRequestOrg, parseBody } from '../../lib/auth/middleware'
import { badRequest, conflict, forbidden, notFound, ok, serverError, unauthorized } from '../../lib/utils/response'
import { Election, ElectionStatus, ElectionType, Voter } from '../../types'

// POST /elections/{electionId}/voters
// Body: { emails: string[] }
// Adds one or more voters to a closed election by email.
// Does NOT send invites — that's a separate action.
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
      return badRequest('Voter management is only available for closed elections')
    }
    if (election.status === ElectionStatus.ACTIVE) {
      return conflict('Cannot add voters to an active election')
    }

    const body = parseBody<{ emails: string[] }>(event)
    if (!body?.emails?.length) return badRequest('emails array is required')

    const emails = [...new Set(body.emails.map((e) => e.trim().toLowerCase()))].filter(Boolean)
    if (emails.length === 0) return badRequest('No valid emails provided')

    const now = new Date().toISOString()
    // Token expires when election is expected to end (or 30 days from now if not scheduled)
    const tokenExpiresAt = election.scheduled_start_at
      ? new Date(new Date(election.scheduled_start_at).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const added: Voter[] = []
    const skipped: string[] = []

    for (const email of emails) {
      // Check for duplicate
      const existing = await db.send(
        new QueryCommand({
          TableName: Tables.VOTERS,
          IndexName: 'election-email-index',
          KeyConditionExpression: 'election_id = :eid AND email = :email',
          ExpressionAttributeValues: { ':eid': electionId, ':email': email },
          Limit: 1,
        })
      )

      if (existing.Items?.length) {
        skipped.push(email)
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
      added.push(voter)
    }

    return ok({
      added: added.length,
      skipped: skipped.length,
      skipped_emails: skipped,
    })
  } catch (err) {
    return serverError(err)
  }
}
