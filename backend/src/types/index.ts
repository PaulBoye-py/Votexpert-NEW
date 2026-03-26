// ─── Enums ────────────────────────────────────────────────────────────────────

export enum ElectionType {
  OPEN = 'OPEN',       // Anyone with the link/QR can vote (anonymous session)
  CLOSED = 'CLOSED',   // Only invited voters with a unique link can vote
}

export enum ElectionStatus {
  DRAFT = 'DRAFT',                       // Being set up, not visible to voters
  SCHEDULED = 'SCHEDULED',               // Has a scheduled start time, not yet active
  ACTIVE = 'ACTIVE',                     // Currently running, voting in progress
  CLOSED = 'CLOSED',                     // Voting ended, results not yet published
  RESULTS_PUBLISHED = 'RESULTS_PUBLISHED', // Results visible to all
}

// ─── Org ──────────────────────────────────────────────────────────────────────

export interface Org {
  org_id: string
  name: string
  email: string
  cognito_user_id: string
  created_at: string   // ISO 8601
}

// ─── Election ─────────────────────────────────────────────────────────────────

export interface Election {
  election_id: string
  org_id: string
  title: string
  description?: string
  type: ElectionType
  status: ElectionStatus

  // Scheduling — either admin sets a scheduled start or starts manually
  // If both scheduled_start_at and scheduled_end_at are set → "scheduled" mode
  // (all positions open simultaneously during the window, no presenter flow)
  scheduled_start_at?: string  // ISO 8601, optional
  scheduled_end_at?: string    // ISO 8601, optional — when the election auto-closes
  started_at?: string          // set when election actually starts
  ended_at?: string            // set when election actually ends

  // 6-digit numeric code voters use to join (e.g. "482931")
  election_code: string

  // Whether real-time vote counts are broadcast during the election
  show_live_results: boolean

  // When to show the leaderboard to voters:
  //   after_each_position — show results after voter submits each position
  //   at_end              — only show results when the election fully ends
  leaderboard_mode: 'after_each_position' | 'at_end'

  // Derived at runtime — which position is currently active.
  // Computed from started_at + cumulative position durations, not stored.

  created_at: string
  updated_at: string
}

// ─── Position ─────────────────────────────────────────────────────────────────

export interface Position {
  position_id: string
  election_id: string
  title: string
  description?: string
  position_order: number   // 1-based, determines voting sequence
  duration_seconds: number // How long this position is open for voting
  created_at: string
  updated_at: string
}

// Computed at runtime — not stored in DB
export interface ActivePositionState {
  position: Position
  seconds_remaining: number
  seconds_elapsed: number
}

// ─── Candidate ────────────────────────────────────────────────────────────────

export interface Candidate {
  candidate_id: string
  position_id: string
  election_id: string
  name: string
  photo_url?: string
  bio?: string
  vote_count: number   // Atomic counter — incremented on each vote
  created_at: string
  updated_at: string
}

// ─── Open Election: Anonymous Vote Session ────────────────────────────────────

// Created when a voter lands on an open election page.
// Stored in browser localStorage and sent with every vote request.
export interface VoteSession {
  session_token: string      // UUID — the voter's anonymous identity
  election_id: string
  ip_address: string
  user_agent?: string        // Browser user-agent for fingerprinting
  created_at: string
  ttl: number                // Unix epoch — session expires when election ends
  // Map of position_id → candidate_id for each vote cast this session
  votes_cast: Record<string, string>
}

// ─── Closed Election: Invited Voter ───────────────────────────────────────────

export interface Voter {
  voter_id: string
  election_id: string
  email: string
  invite_token: string       // UUID — unique per voter per election, used as auth
  token_expires_at: string   // ISO 8601 — token expires at election end time
  invite_sent_at?: string    // ISO 8601 — when the invite email was sent
  voted_at?: string          // ISO 8601 — when they cast their vote (null = not voted)
  // Map of position_id → candidate_id for each vote cast
  votes_cast: Record<string, string>
  // Vote weight — default 1 for regular voters, >1 for judges. Multiplied into vote count.
  vote_weight: number
  created_at: string
}

// ─── Vote (Audit Trail) ───────────────────────────────────────────────────────

// One record per vote cast. Used for audit trail and recounts.
// PK = election_id + position_id for efficient querying.
export interface Vote {
  vote_id: string
  election_id: string
  position_id: string
  candidate_id: string
  // Anonymized voter reference — session_token for open, voter_id for closed
  voter_ref: string
  created_at: string
}

// ─── Org Voter Pool ───────────────────────────────────────────────────────────

// Org-level voter records that can be reused across multiple closed elections.
export interface OrgVoter {
  org_voter_id: string
  org_id: string
  email: string
  name?: string
  created_at: string
}

// ─── Lobby Participant ────────────────────────────────────────────────────────

// Tracks who is waiting in the lobby before an election starts (open elections).
// Voters can choose a display name or remain anonymous.
export interface LobbyParticipant {
  participant_id: string
  election_id: string
  display_name: string   // "Anonymous" if not provided
  joined_at: string      // ISO 8601
  ttl: number            // Unix epoch — auto-expires after 24 h
}

// ─── WebSocket Connection ─────────────────────────────────────────────────────

// Tracks active WebSocket connections per election for broadcasting.
export interface WSConnection {
  connection_id: string
  election_id: string
  connected_at: string
  ttl: number   // Auto-expire stale connections
}

// ─── API Request / Response types ────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Election creation payload
export interface CreateElectionInput {
  title: string
  description?: string
  type: ElectionType
  scheduled_start_at?: string
  scheduled_end_at?: string
  show_live_results?: boolean
  leaderboard_mode?: 'after_each_position' | 'at_end'
}

// Position creation payload
export interface CreatePositionInput {
  title: string
  description?: string
  position_order: number
  duration_seconds: number
}

// Candidate creation payload
export interface CreateCandidateInput {
  name: string
  photo_url?: string
  bio?: string
}

// Vote submission payload
export interface SubmitVoteInput {
  election_id: string
  position_id: string
  candidate_id: string
  // For open elections
  session_token?: string
  // For closed elections
  invite_token?: string
}

// Real-time WebSocket event types
export enum WSEventType {
  VOTE_UPDATE = 'VOTE_UPDATE',         // A vote was cast — send updated counts
  POSITION_CHANGED = 'POSITION_CHANGED', // Active position moved to the next one
  ELECTION_STARTED = 'ELECTION_STARTED',
  ELECTION_ENDED = 'ELECTION_ENDED',
}

export interface WSEvent {
  type: WSEventType
  election_id: string
  payload: unknown
}

// Results shape returned by the results API
export interface ElectionResults {
  election: Election
  positions: Array<{
    position: Position
    candidates: Array<{
      candidate: Candidate
      vote_count: number
      percentage: number
    }>
    total_votes: number
    winner?: Candidate
  }>
  total_votes_cast: number
}
