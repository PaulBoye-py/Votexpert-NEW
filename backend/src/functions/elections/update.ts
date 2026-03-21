import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { db, Tables } from '../../lib/db/client'
import { getRequestOrg, parseBody } from '../../lib/auth/middleware'
import { badRequest, conflict, forbidden, notFound, ok, serverError, unauthorized } from '../../lib/utils/response'
import { Election, ElectionStatus } from '../../types'

// PUT /elections/{electionId} — update election metadata
// Only allowed when election is DRAFT or SCHEDULED
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const org = await getRequestOrg(event)
    if (!org) return unauthorized()

    const electionId = event.pathParameters?.electionId
    if (!electionId) return notFound('Election')

    const body = parseBody<Partial<Election>>(event)
    if (!body) return badRequest('Request body is required')

    const existing = (
      await db.send(new GetCommand({ TableName: Tables.ELECTIONS, Key: { election_id: electionId } }))
    ).Item as Election | undefined

    if (!existing) return notFound('Election')
    if (existing.org_id !== org.org_id) return forbidden()

    // Cannot edit an election that is already active or closed
    if ([ElectionStatus.ACTIVE, ElectionStatus.CLOSED, ElectionStatus.RESULTS_PUBLISHED].includes(existing.status)) {
      return conflict('Cannot edit an election that is already active or closed')
    }

    const now = new Date().toISOString()

    await db.send(
      new UpdateCommand({
        TableName: Tables.ELECTIONS,
        Key: { election_id: electionId },
        UpdateExpression: `SET
          title = if_not_exists(title, :title),
          #desc = :desc,
          scheduled_start_at = :scheduledStart,
          show_live_results = :showLive,
          updated_at = :now
        `,
        ExpressionAttributeNames: { '#desc': 'description' },
        ExpressionAttributeValues: {
          ':title': body.title ?? existing.title,
          ':desc': body.description ?? existing.description ?? null,
          ':scheduledStart': body.scheduled_start_at ?? existing.scheduled_start_at ?? null,
          ':showLive': body.show_live_results ?? existing.show_live_results,
          ':now': now,
        },
      })
    )

    return ok({ ...existing, ...body, updated_at: now })
  } catch (err) {
    return serverError(err)
  }
}
