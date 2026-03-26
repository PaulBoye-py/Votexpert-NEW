/**
 * Scheduler tick — runs every minute via EventBridge.
 *
 * Responsibilities:
 *  1. Start SCHEDULED elections whose scheduled_start_at has arrived.
 *  2. End (CLOSED) ACTIVE scheduled elections whose scheduled_end_at has passed.
 *  3. Publish results for CLOSED elections immediately after ending.
 *
 * Only elections with a scheduled_end_at are "scheduled mode" elections.
 * Immediate elections are started/ended manually by the admin.
 */
import { ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { db, Tables } from '../../lib/db/client'
import { Election, ElectionStatus } from '../../types'

export async function handler(): Promise<void> {
  const now = new Date().toISOString()

  // Scan for elections that need state transitions.
  // We filter to SCHEDULED and ACTIVE statuses — the scan is cheap since
  // most elections will be DRAFT/CLOSED/RESULTS_PUBLISHED and filtered out.
  const result = await db.send(
    new ScanCommand({
      TableName: Tables.ELECTIONS,
      // Include DRAFT too — scheduled elections may have been created before status defaulted to SCHEDULED
      FilterExpression: '#status IN (:draft, :scheduled, :active) AND attribute_exists(scheduled_start_at)',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':draft': ElectionStatus.DRAFT,
        ':scheduled': ElectionStatus.SCHEDULED,
        ':active': ElectionStatus.ACTIVE,
      },
    })
  )

  const elections = (result.Items ?? []) as Election[]

  const transitions = elections.map(async (election) => {
    const { election_id, status, scheduled_start_at, scheduled_end_at } = election

    // 1. DRAFT or SCHEDULED → ACTIVE: start time has arrived
    if (
      (status === ElectionStatus.DRAFT || status === ElectionStatus.SCHEDULED) &&
      scheduled_start_at && scheduled_start_at <= now
    ) {
      await db.send(
        new UpdateCommand({
          TableName: Tables.ELECTIONS,
          Key: { election_id },
          UpdateExpression: 'SET #status = :active, started_at = :now, updated_at = :now',
          ConditionExpression: '#status IN (:draft, :scheduled)',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':active': ElectionStatus.ACTIVE,
            ':draft': ElectionStatus.DRAFT,
            ':scheduled': ElectionStatus.SCHEDULED,
            ':now': now,
          },
        })
      ).catch(() => { /* another tick already started it — ignore */ })
      return
    }

    // 2. ACTIVE → RESULTS_PUBLISHED: end time has passed
    // We publish results directly (skip CLOSED intermediate state) for scheduled elections
    // since there's no manual "publish results" step needed.
    if (status === ElectionStatus.ACTIVE && scheduled_end_at && scheduled_end_at <= now) {
      await db.send(
        new UpdateCommand({
          TableName: Tables.ELECTIONS,
          Key: { election_id },
          UpdateExpression: 'SET #status = :published, ended_at = :now, updated_at = :now',
          ConditionExpression: '#status = :active',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':published': ElectionStatus.RESULTS_PUBLISHED,
            ':active': ElectionStatus.ACTIVE,
            ':now': now,
          },
        })
      ).catch(() => { /* another tick already ended it — ignore */ })
    }
  })

  await Promise.allSettled(transitions)
}
