import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { db, Tables } from '../../lib/db/client'
import { getRequestOrg, parseBody } from '../../lib/auth/middleware'
import { badRequest, conflict, forbidden, notFound, ok, serverError, unauthorized } from '../../lib/utils/response'
import { sendEmail, inviteEmailHtml } from '../../lib/email/mailer'
import { Election, ElectionType, Voter } from '../../types'

// POST /elections/{electionId}/voters/send-invites
// Body (optional): { voter_ids: string[] } — if omitted, sends to ALL voters who haven't been invited
// Sends invite emails to voters. Can be called multiple times (resend).
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
      return badRequest('Invites are only available for closed elections')
    }

    const body = parseBody<{ voter_ids?: string[] }>(event)

    // Fetch voters
    const votersResult = await db.send(
      new QueryCommand({
        TableName: Tables.VOTERS,
        KeyConditionExpression: 'election_id = :eid',
        ExpressionAttributeValues: { ':eid': electionId },
      })
    )

    let voters = (votersResult.Items ?? []) as Voter[]

    // Filter to specific voter_ids if provided
    if (body?.voter_ids?.length) {
      const ids = new Set(body.voter_ids)
      voters = voters.filter((v) => ids.has(v.voter_id))
      if (voters.length === 0) return badRequest('No matching voters found')
    }

    const appUrl = process.env.APP_URL ?? 'http://localhost:5173'
    const now = new Date().toISOString()

    let sent = 0
    let failed = 0

    for (const voter of voters) {
      const inviteUrl = `${appUrl}/vote/${electionId}?token=${voter.invite_token}`

      try {
        await sendEmail({
          to: voter.email,
          subject: `You've been invited to vote: ${election.title}`,
          html: inviteEmailHtml({
            electionTitle: election.title,
            orgName: org.name,
            inviteUrl,
            expiresAt: voter.token_expires_at,
          }),
        })

        // Mark invite as sent
        await db.send(
          new UpdateCommand({
            TableName: Tables.VOTERS,
            Key: { election_id: electionId, voter_id: voter.voter_id },
            UpdateExpression: 'SET invite_sent_at = :now',
            ExpressionAttributeValues: { ':now': now },
          })
        )

        sent++
      } catch (emailErr) {
        console.error(`[SendInvites] Failed to send to ${voter.email}:`, emailErr)
        failed++
      }
    }

    return ok({ sent, failed, total: voters.length })
  } catch (err) {
    return serverError(err)
  }
}
