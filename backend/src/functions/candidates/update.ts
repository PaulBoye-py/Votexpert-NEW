import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { db, Tables } from '../../lib/db/client'
import { getRequestOrg, parseBody } from '../../lib/auth/middleware'
import { badRequest, forbidden, notFound, ok, serverError, unauthorized } from '../../lib/utils/response'
import { Candidate, Election } from '../../types'

// PUT /elections/{electionId}/positions/{positionId}/candidates/{candidateId}
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const org = await getRequestOrg(event)
    if (!org) return unauthorized()

    const { electionId, positionId, candidateId } = event.pathParameters ?? {}
    if (!electionId || !positionId || !candidateId) return notFound('Candidate')

    const election = (
      await db.send(new GetCommand({ TableName: Tables.ELECTIONS, Key: { election_id: electionId } }))
    ).Item as Election | undefined

    if (!election) return notFound('Election')
    if (election.org_id !== org.org_id) return forbidden()

    const existing = (
      await db.send(
        new GetCommand({ TableName: Tables.CANDIDATES, Key: { position_id: positionId, candidate_id: candidateId } })
      )
    ).Item as Candidate | undefined

    if (!existing || existing.election_id !== electionId) return notFound('Candidate')

    const body = parseBody<Partial<Candidate>>(event)
    if (!body) return badRequest('Request body is required')

    const now = new Date().toISOString()
    await db.send(
      new UpdateCommand({
        TableName: Tables.CANDIDATES,
        Key: { position_id: positionId, candidate_id: candidateId },
        UpdateExpression: 'SET #name = :name, photo_url = :photo, bio = :bio, updated_at = :now',
        ExpressionAttributeNames: { '#name': 'name' },
        ExpressionAttributeValues: {
          ':name': body.name ?? existing.name,
          ':photo': body.photo_url ?? existing.photo_url ?? null,
          ':bio': body.bio ?? existing.bio ?? null,
          ':now': now,
        },
      })
    )

    return ok({ ...existing, ...body, updated_at: now })
  } catch (err) {
    return serverError(err)
  }
}
