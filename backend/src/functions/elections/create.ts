import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { PutCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuid } from 'uuid'
import { db, Tables } from '../../lib/db/client'
import { getRequestOrg, parseBody } from '../../lib/auth/middleware'
import { badRequest, created, serverError, unauthorized } from '../../lib/utils/response'
import { CreateElectionInput, Election, ElectionStatus } from '../../types'

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const org = await getRequestOrg(event)
    if (!org) return unauthorized()

    const body = parseBody<CreateElectionInput>(event)
    if (!body?.title) return badRequest('title is required')
    if (!body.type) return badRequest('type is required (OPEN or CLOSED)')

    const now = new Date().toISOString()
    const election: Election = {
      election_id: uuid(),
      org_id: org.org_id,
      title: body.title.trim(),
      description: body.description?.trim(),
      type: body.type,
      status: ElectionStatus.DRAFT,
      scheduled_start_at: body.scheduled_start_at,
      show_live_results: body.show_live_results ?? true,
      created_at: now,
      updated_at: now,
    }

    await db.send(new PutCommand({ TableName: Tables.ELECTIONS, Item: election }))

    return created(election)
  } catch (err) {
    return serverError(err)
  }
}
