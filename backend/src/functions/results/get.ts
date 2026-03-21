import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { db, Tables } from '../../lib/db/client'
import { conflict, notFound, ok, serverError } from '../../lib/utils/response'
import { Candidate, Election, ElectionStatus, ElectionType, Position } from '../../types'

// GET /results/{electionId} — public results page
// For open elections: available once election ends
// For closed elections: available only when admin publishes results (RESULTS_PUBLISHED status)
//   UNLESS show_live_results=true, in which case results are shown during voting too
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const electionId = event.pathParameters?.electionId
    if (!electionId) return notFound('Election')

    const election = (
      await db.send(new GetCommand({ TableName: Tables.ELECTIONS, Key: { election_id: electionId } }))
    ).Item as Election | undefined

    if (!election) return notFound('Election')

    // Access control: who can see results?
    const canViewResults =
      election.status === ElectionStatus.RESULTS_PUBLISHED ||
      (election.type === ElectionType.OPEN && election.status === ElectionStatus.CLOSED) ||
      (election.type === ElectionType.OPEN && election.show_live_results && election.status === ElectionStatus.ACTIVE) ||
      (election.type === ElectionType.CLOSED && election.show_live_results && election.status === ElectionStatus.ACTIVE)

    if (!canViewResults) {
      return conflict('Results are not yet available for this election')
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

    // Fetch all candidates
    const candidatesResult = await db.send(
      new QueryCommand({
        TableName: Tables.CANDIDATES,
        IndexName: 'election-candidates-index',
        KeyConditionExpression: 'election_id = :eid',
        ExpressionAttributeValues: { ':eid': electionId },
      })
    )
    const allCandidates = (candidatesResult.Items ?? []) as Candidate[]

    // Fetch vote counts
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

    // Build results per position
    let totalVotesCast = 0

    const positionResults = positions.map((pos) => {
      const candidates = allCandidates
        .filter((c) => c.position_id === pos.position_id)
        .map((c) => ({
          ...c,
          vote_count: voteCounts[`${pos.position_id}#${c.candidate_id}`] ?? 0,
        }))
        .sort((a, b) => b.vote_count - a.vote_count)

      const positionTotalVotes = candidates.reduce((sum, c) => sum + c.vote_count, 0)
      totalVotesCast += positionTotalVotes

      const candidatesWithPct = candidates.map((c) => ({
        ...c,
        percentage: positionTotalVotes > 0 ? Math.round((c.vote_count / positionTotalVotes) * 1000) / 10 : 0,
      }))

      return {
        position: pos,
        candidates: candidatesWithPct,
        total_votes: positionTotalVotes,
        winner: candidatesWithPct[0]?.vote_count > 0 ? candidatesWithPct[0] : undefined,
      }
    })

    return ok({
      election: {
        election_id: election.election_id,
        title: election.title,
        type: election.type,
        status: election.status,
        started_at: election.started_at,
        ended_at: election.ended_at,
      },
      positions: positionResults,
      total_votes_cast: totalVotesCast,
    })
  } catch (err) {
    return serverError(err)
  }
}
