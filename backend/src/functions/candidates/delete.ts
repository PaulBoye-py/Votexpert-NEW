import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { db, Tables } from '../../lib/db/client'
import { getRequestOrg } from '../../lib/auth/middleware'
import { forbidden, notFound, noContent, serverError, unauthorized } from '../../lib/utils/response'
import { Candidate, Election } from '../../types'

// DELETE /elections/{electionId}/positions/{positionId}/candidates/{candidateId}
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

    await db.send(
      new DeleteCommand({ TableName: Tables.CANDIDATES, Key: { position_id: positionId, candidate_id: candidateId } })
    )

    return noContent()
  } catch (err) {
    return serverError(err)
  }
}
