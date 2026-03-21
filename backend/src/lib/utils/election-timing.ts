import { Position, ActivePositionState } from '../../types'

// Computes which position is currently active based on the election's
// started_at timestamp and each position's duration_seconds.
// This is pure math — no database reads, no stored state.
//
// Example: positions [President: 60s, VP: 90s, Secretary: 60s]
//   - 0–59s   → President is active, 60-elapsed seconds remaining
//   - 60–149s → VP is active
//   - 150–209s→ Secretary is active
//   - 210s+   → Election is over (all positions voted)
export function getActivePosition(
  positions: Position[],
  startedAt: string
): ActivePositionState | null {
  const sorted = [...positions].sort((a, b) => a.position_order - b.position_order)
  const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000

  let cursor = 0
  for (const position of sorted) {
    const positionEnd = cursor + position.duration_seconds
    if (elapsed < positionEnd) {
      return {
        position,
        seconds_elapsed: elapsed - cursor,
        seconds_remaining: positionEnd - elapsed,
      }
    }
    cursor = positionEnd
  }

  // All positions have elapsed — election is over
  return null
}

// Total duration of an election in seconds (sum of all position durations)
export function getTotalDuration(positions: Position[]): number {
  return positions.reduce((sum, p) => sum + p.duration_seconds, 0)
}

// Expected end time of the election as an ISO string
export function getExpectedEndTime(startedAt: string, positions: Position[]): string {
  const endMs = new Date(startedAt).getTime() + getTotalDuration(positions) * 1000
  return new Date(endMs).toISOString()
}
