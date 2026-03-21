import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { db, Tables } from '../../lib/db/client'
import { getRequestOrg } from '../../lib/auth/middleware'
import { conflict, forbidden, notFound, noContent, serverError, unauthorized } from '../../lib/utils/response'
import { Election, ElectionStatus } from '../../types'

// DELETE /elections/{electionId} — only allowed in DRAFT/SCHEDULED state
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const org = await getRequestOrg(event)
    if (!org) return unauthorized()

    const electionId = event.pathParameters?.electionId
    if (!electionId) return notFound('Election')

    const existing = (
      await db.send(new GetCommand({ TableName: Tables.ELECTIONS, Key: { election_id: electionId } }))
    ).Item as Election | undefined

    if (!existing) return notFound('Election')
    if (existing.org_id !== org.org_id) return forbidden()

    if ([ElectionStatus.ACTIVE, ElectionStatus.CLOSED, ElectionStatus.RESULTS_PUBLISHED].includes(existing.status)) {
      return conflict('Cannot delete an election that has already started')
    }

    await db.send(
      new DeleteCommand({ TableName: Tables.ELECTIONS, Key: { election_id: electionId } })
    )

    return noContent()
  } catch (err) {
    return serverError(err)
  }
}
