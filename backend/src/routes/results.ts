import { Router, Request, Response } from 'express'
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { db, Tables } from '../lib/db/client'
import { send } from '../lib/utils/response'
import { Candidate, Election, ElectionStatus, ElectionType, Position } from '../types'

export const resultsRouter = Router()

// GET /results/:electionId — public
resultsRouter.get('/:electionId', async (req: Request, res: Response) => {
  try {
    const election = (await db.send(new GetCommand({ TableName: Tables.ELECTIONS, Key: { election_id: req.params.electionId } }))).Item as Election | undefined
    if (!election) return send.notFound(res, 'Election')

    const canView =
      election.status === ElectionStatus.RESULTS_PUBLISHED ||
      (election.type === ElectionType.OPEN && election.status === ElectionStatus.CLOSED) ||
      (election.show_live_results && election.status === ElectionStatus.ACTIVE)

    if (!canView) return send.conflict(res, 'Results are not yet available for this election')

    const positions = ((await db.send(new QueryCommand({
      TableName: Tables.POSITIONS,
      KeyConditionExpression: 'election_id = :eid',
      ExpressionAttributeValues: { ':eid': req.params.electionId },
      ScanIndexForward: true,
    }))).Items ?? []) as Position[]

    const allCandidates = ((await db.send(new QueryCommand({
      TableName: Tables.CANDIDATES,
      IndexName: 'election-candidates-index',
      KeyConditionExpression: 'election_id = :eid',
      ExpressionAttributeValues: { ':eid': req.params.electionId },
    }))).Items ?? []) as Candidate[]

    const voteCounts = Object.fromEntries(
      ((await db.send(new QueryCommand({
        TableName: Tables.VOTE_COUNTS,
        KeyConditionExpression: 'election_id = :eid',
        ExpressionAttributeValues: { ':eid': req.params.electionId },
        ConsistentRead: true, // avoid stale reads immediately after election ends
      }))).Items ?? []).map(r => [`${r.position_id}#${r.candidate_id}`, r.vote_count as number])
    )

    let totalVotesCast = 0
    const positionResults = positions.map(pos => {
      const candidates = allCandidates
        .filter(c => c.position_id === pos.position_id)
        .map(c => ({ ...c, vote_count: voteCounts[`${pos.position_id}#${c.candidate_id}`] ?? 0 }))
        .sort((a, b) => b.vote_count - a.vote_count)

      const total = candidates.reduce((s, c) => s + c.vote_count, 0)
      totalVotesCast += total

      return {
        position: pos,
        candidates: candidates.map(c => ({ ...c, percentage: total > 0 ? Math.round((c.vote_count / total) * 1000) / 10 : 0 })),
        total_votes: total,
        winner: candidates[0]?.vote_count > 0 ? candidates[0] : undefined,
      }
    })

    send.ok(res, {
      election: { election_id: election.election_id, title: election.title, type: election.type, status: election.status, started_at: election.started_at, ended_at: election.ended_at },
      positions: positionResults,
      total_votes_cast: totalVotesCast,
    })
  } catch (err) { send.serverError(res, err) }
})
