import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { db, Tables } from '../../lib/db/client'
import { conflict, notFound, ok, serverError, unauthorized } from '../../lib/utils/response'
import { Election, ElectionStatus, ElectionType, Position, Voter } from '../../types'
import { getActivePosition } from '../../lib/utils/election-timing'

// GET /vote/verify-token?token=xxx
// Called when a closed election voter clicks their invite link.
// Returns voter info, election info, positions, candidates, and the active position.
// Does NOT mark the token as used — that happens when they actually vote.
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const token = event.queryStringParameters?.token
    if (!token) return unauthorized('Missing invite token')

    // Look up voter by invite token via GSI
    const voterResult = await db.send(
      new QueryCommand({
        TableName: Tables.VOTERS,
        IndexName: 'invite-token-index',
        KeyConditionExpression: 'invite_token = :token',
        ExpressionAttributeValues: { ':token': token },
        Limit: 1,
      })
    )

    const voter = voterResult.Items?.[0] as Voter | undefined
    if (!voter) return unauthorized('Invalid or expired invite link')

    // Check token expiry
    if (voter.token_expires_at && new Date(voter.token_expires_at) < new Date()) {
      return unauthorized('This invite link has expired')
    }

    // Check if already voted
    if (voter.voted_at) {
      return conflict('You have already cast your vote in this election')
    }

    // Fetch election
    const election = (
      await db.send(new GetCommand({ TableName: Tables.ELECTIONS, Key: { election_id: voter.election_id } }))
    ).Item as Election | undefined

    if (!election) return notFound('Election')
    if (election.type !== ElectionType.CLOSED) return unauthorized('Invalid election type')

    if (election.status === ElectionStatus.DRAFT || election.status === ElectionStatus.SCHEDULED) {
      return conflict('This election has not started yet')
    }
    if (election.status === ElectionStatus.CLOSED || election.status === ElectionStatus.RESULTS_PUBLISHED) {
      return conflict('This election has ended')
    }

    // Fetch positions + candidates
    const positionsResult = await db.send(
      new QueryCommand({
        TableName: Tables.POSITIONS,
        KeyConditionExpression: 'election_id = :eid',
        ExpressionAttributeValues: { ':eid': voter.election_id },
        ScanIndexForward: true,
      })
    )
    const positions = (positionsResult.Items ?? []) as Position[]

    const activePosition = election.started_at
      ? getActivePosition(positions, election.started_at)
      : null

    return ok({
      voter_id: voter.voter_id,
      election,
      positions,
      active_position: activePosition,
      votes_cast: voter.votes_cast,
    })
  } catch (err) {
    return serverError(err)
  }
}
