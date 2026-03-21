import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { db, Tables } from '../../lib/db/client'
import { notFound, ok, serverError, conflict } from '../../lib/utils/response'
import { Candidate, Election, ElectionStatus, Position } from '../../types'
import { getActivePosition } from '../../lib/utils/election-timing'

// GET /public/elections/{electionId}
// Public endpoint — no auth required.
// Returns election data + positions + candidates + current active position + live vote counts.
// Used by voters joining an open election.
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const electionId = event.pathParameters?.electionId
    if (!electionId) return notFound('Election')

    const election = (
      await db.send(new GetCommand({ TableName: Tables.ELECTIONS, Key: { election_id: electionId } }))
    ).Item as Election | undefined

    if (!election) return notFound('Election')

    if (election.status === ElectionStatus.DRAFT || election.status === ElectionStatus.SCHEDULED) {
      return conflict('This election has not started yet')
    }

    // Fetch positions
    const positionsResult = await db.send(
      new QueryCommand({
        TableName: Tables.POSITIONS,
        KeyConditionExpression: 'election_id = :eid',
        ExpressionAttributeValues: { ':eid': electionId },
        ScanIndexForward: true,
      })
    )
    const positions = (positionsResult.Items ?? []) as Position[]

    // Fetch all candidates for this election
    const candidatesResult = await db.send(
      new QueryCommand({
        TableName: Tables.CANDIDATES,
        IndexName: 'election-candidates-index',
        KeyConditionExpression: 'election_id = :eid',
        ExpressionAttributeValues: { ':eid': electionId },
      })
    )
    const candidates = (candidatesResult.Items ?? []) as Candidate[]

    // Fetch live vote counts
    const voteCountsResult = await db.send(
      new QueryCommand({
        TableName: Tables.VOTE_COUNTS,
        KeyConditionExpression: 'election_id = :eid',
        ExpressionAttributeValues: { ':eid': electionId },
      })
    )
    const voteCounts = Object.fromEntries(
      (voteCountsResult.Items ?? []).map((row) => [
        `${row.position_id}#${row.candidate_id}`,
        row.vote_count as number,
      ])
    )

    const activePosition = election.started_at
      ? getActivePosition(positions, election.started_at)
      : null

    // Group candidates by position
    const positionsWithCandidates = positions.map((pos) => ({
      ...pos,
      candidates: candidates
        .filter((c) => c.position_id === pos.position_id)
        .map((c) => ({
          ...c,
          vote_count: voteCounts[`${pos.position_id}#${c.candidate_id}`] ?? 0,
        })),
    }))

    return ok({
      election: {
        election_id: election.election_id,
        title: election.title,
        description: election.description,
        type: election.type,
        status: election.status,
        started_at: election.started_at,
        show_live_results: election.show_live_results,
      },
      positions: positionsWithCandidates,
      active_position: activePosition,
    })
  } catch (err) {
    return serverError(err)
  }
}
