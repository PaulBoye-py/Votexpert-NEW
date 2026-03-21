import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuid } from 'uuid'
import { db, Tables } from '../../lib/db/client'
import { getRequestOrg, parseBody } from '../../lib/auth/middleware'
import { badRequest, conflict, forbidden, notFound, created, serverError, unauthorized } from '../../lib/utils/response'
import { CreatePositionInput, Election, ElectionStatus, Position } from '../../types'

// POST /elections/{electionId}/positions
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
    if (election.status === ElectionStatus.ACTIVE) {
      return conflict('Cannot add positions to an active election')
    }

    const body = parseBody<CreatePositionInput>(event)
    if (!body?.title) return badRequest('title is required')
    if (!body.duration_seconds || body.duration_seconds < 10) {
      return badRequest('duration_seconds is required and must be at least 10 seconds')
    }

    // Auto-assign order if not provided — append to the end
    let order = body.position_order
    if (!order) {
      const existing = await db.send(
        new QueryCommand({
          TableName: Tables.POSITIONS,
          KeyConditionExpression: 'election_id = :eid',
          ExpressionAttributeValues: { ':eid': electionId },
          Select: 'COUNT',
        })
      )
      order = (existing.Count ?? 0) + 1
    }

    const now = new Date().toISOString()
    const position: Position = {
      position_id: uuid(),
      election_id: electionId,
      title: body.title.trim(),
      description: body.description?.trim(),
      position_order: order,
      duration_seconds: body.duration_seconds,
      created_at: now,
      updated_at: now,
    }

    await db.send(new PutCommand({ TableName: Tables.POSITIONS, Item: position }))

    return created(position)
  } catch (err) {
    return serverError(err)
  }
}
