import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { db, Tables } from '../../lib/db/client'
import { getRequestOrg } from '../../lib/auth/middleware'
import { conflict, forbidden, notFound, noContent, serverError, unauthorized } from '../../lib/utils/response'
import { Election, ElectionStatus, Voter } from '../../types'

// DELETE /elections/{electionId}/voters/{voterId}
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const org = await getRequestOrg(event)
    if (!org) return unauthorized()

    const { electionId, voterId } = event.pathParameters ?? {}
    if (!electionId || !voterId) return notFound('Voter')

    const election = (
      await db.send(new GetCommand({ TableName: Tables.ELECTIONS, Key: { election_id: electionId } }))
    ).Item as Election | undefined

    if (!election) return notFound('Election')
    if (election.org_id !== org.org_id) return forbidden()
    if (election.status === ElectionStatus.ACTIVE) {
      return conflict('Cannot remove voters from an active election')
    }

    const voter = (
      await db.send(
        new GetCommand({ TableName: Tables.VOTERS, Key: { election_id: electionId, voter_id: voterId } })
      )
    ).Item as Voter | undefined

    if (!voter) return notFound('Voter')

    await db.send(
      new DeleteCommand({ TableName: Tables.VOTERS, Key: { election_id: electionId, voter_id: voterId } })
    )

    return noContent()
  } catch (err) {
    return serverError(err)
  }
}
