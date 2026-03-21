import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { DeleteCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { db, Tables } from '../../lib/db/client'
import { getRequestOrg } from '../../lib/auth/middleware'
import { conflict, forbidden, notFound, noContent, serverError, unauthorized } from '../../lib/utils/response'
import { Election, ElectionStatus, Position } from '../../types'

// DELETE /elections/{electionId}/positions/{positionId}
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
      return conflict('Cannot delete positions from an active election')
    }

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

    await db.send(
      new DeleteCommand({
        TableName: Tables.POSITIONS,
        Key: { election_id: electionId, position_order: position.position_order },
      })
    )

    return noContent()
  } catch (err) {
    return serverError(err)
  }
}
