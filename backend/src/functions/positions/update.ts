import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { db, Tables } from '../../lib/db/client'
import { getRequestOrg, parseBody } from '../../lib/auth/middleware'
import { badRequest, forbidden, notFound, ok, serverError, unauthorized } from '../../lib/utils/response'
import { Election, Position } from '../../types'

// PUT /elections/{electionId}/positions/{positionId}
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const org = await getRequestOrg(event)
    if (!org) return unauthorized()

    const { electionId, positionId } = event.pathParameters ?? {}
    if (!electionId || !positionId) return notFound('Position')

    const election = (
      await db.send(new GetCommand({ TableName: Tables.ELECTIONS, Key: { election_id: electionId } }))
    ).Item as Election | undefined

    if (!election) return notFound('Election')
    if (election.org_id !== org.org_id) return forbidden()

    // Look up the position by its ID via GSI
    const posResult = await db.send(
      new QueryCommand({
        TableName: Tables.POSITIONS,
        IndexName: 'position-id-index',
        KeyConditionExpression: 'position_id = :pid',
        ExpressionAttributeValues: { ':pid': positionId },
        Limit: 1,
      })
    )

    const position = posResult.Items?.[0] as Position | undefined
    if (!position || position.election_id !== electionId) return notFound('Position')

    const body = parseBody<Partial<Position>>(event)
    if (!body) return badRequest('Request body is required')

    const now = new Date().toISOString()
    await db.send(
      new UpdateCommand({
        TableName: Tables.POSITIONS,
        Key: { election_id: electionId, position_order: position.position_order },
        UpdateExpression: 'SET title = :title, #desc = :desc, duration_seconds = :dur, updated_at = :now',
        ExpressionAttributeNames: { '#desc': 'description' },
        ExpressionAttributeValues: {
          ':title': body.title ?? position.title,
          ':desc': body.description ?? position.description ?? null,
          ':dur': body.duration_seconds ?? position.duration_seconds,
          ':now': now,
        },
      })
    )

    return ok({ ...position, ...body, updated_at: now })
  } catch (err) {
    return serverError(err)
  }
}
