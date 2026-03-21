import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuid } from 'uuid'
import { db, Tables } from '../../lib/db/client'
import { getRequestOrg, parseBody } from '../../lib/auth/middleware'
import { badRequest, conflict, forbidden, notFound, created, serverError, unauthorized } from '../../lib/utils/response'
import { Candidate, CreateCandidateInput, Election, ElectionStatus, Position } from '../../types'

// POST /elections/{electionId}/positions/{positionId}/candidates
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
    if (election.status === ElectionStatus.ACTIVE) {
      return conflict('Cannot add candidates to an active election')
    }

    // Verify the position exists under this election
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

    const body = parseBody<CreateCandidateInput>(event)
    if (!body?.name) return badRequest('name is required')

    const now = new Date().toISOString()
    const candidate: Candidate = {
      candidate_id: uuid(),
      position_id: positionId,
      election_id: electionId,
      name: body.name.trim(),
      photo_url: body.photo_url,
      bio: body.bio?.trim(),
      vote_count: 0,
      created_at: now,
      updated_at: now,
    }

    await db.send(new PutCommand({ TableName: Tables.CANDIDATES, Item: candidate }))

    return created(candidate)
  } catch (err) {
    return serverError(err)
  }
}
