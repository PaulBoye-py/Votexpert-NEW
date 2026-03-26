// ─── Base ─────────────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}

// ─── Org Voter Pool ───────────────────────────────────────────────────────────

export interface OrgVoter {
  org_voter_id: string;
  org_id: string;
  email: string;
  name?: string;
  created_at: string;
}

// ─── Org / Admin ──────────────────────────────────────────────────────────────

export interface Org {
  org_id: string;
  name: string;
  cognito_user_id: string;
  created_at: string;
}

export interface Admin {
  org_id?: string;
  name: string;
  email: string;
  org_name: string;
}

// ─── Cognito ─────────────────────────────────────────────────────────────────

export interface CognitoAuthResult {
  IdToken: string;
  AccessToken: string;
  RefreshToken: string;
  ExpiresIn: number;
  TokenType: string;
}

// ─── Elections ────────────────────────────────────────────────────────────────

export type ElectionType = 'OPEN' | 'CLOSED';
export type LeaderboardMode = 'after_each_position' | 'at_end';

export type ElectionStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'ACTIVE'
  | 'CLOSED'
  | 'RESULTS_PUBLISHED';

export interface Election {
  election_id: string;
  election_code: string;
  org_id: string;
  title: string;
  description?: string;
  type: ElectionType;
  status: ElectionStatus;
  show_live_results: boolean;
  leaderboard_mode: LeaderboardMode;
  scheduled_start_at?: string;
  scheduled_end_at?: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
  ended_at?: string;
}

export interface CreateElectionPayload {
  title: string;
  description?: string;
  type: ElectionType;
  show_live_results?: boolean;
  leaderboard_mode?: LeaderboardMode;
  scheduled_start_at?: string;
  scheduled_end_at?: string;
}

// ─── Positions ────────────────────────────────────────────────────────────────

export interface Position {
  position_id: string;
  election_id: string;
  title: string;
  description?: string;
  position_order: number;
  duration_seconds: number;
  created_at: string;
  updated_at: string;
}

export interface CreatePositionPayload {
  title: string;
  description?: string;
  duration_seconds: number;
  position_order?: number;
}

// ─── Candidates ───────────────────────────────────────────────────────────────

export interface Candidate {
  candidate_id: string;
  election_id: string;
  position_id: string;
  name: string;
  bio?: string;
  photo_url?: string;
  created_at: string;
}

export interface CreateCandidatePayload {
  name: string;
  bio?: string;
  photo_url?: string;
}

// ─── Voters ───────────────────────────────────────────────────────────────────

export interface Voter {
  voter_id: string;
  election_id: string;
  email: string;
  votes_cast: Record<string, string>;
  voted_at?: string;
  invite_sent_at?: string;
  vote_weight: number;
  created_at: string;
}

// ─── Voting ───────────────────────────────────────────────────────────────────

export interface ActivePosition {
  position: Position;
  ends_at: string;
  seconds_remaining: number;
}

export interface VoteSessionResponse {
  session_token: string;
  votes_cast: Record<string, string>;
  active_position: ActivePosition | null;
}

export interface VerifyTokenResponse {
  voter_id: string;
  election: Election;
  positions: Position[];
  active_position: ActivePosition | null;
  votes_cast: Record<string, string>;
}

export interface CastVotePayload {
  election_id: string;
  position_id: string;
  candidate_id: string;
  // one of:
  session_token?: string;
  invite_token?: string;
}

export interface CastVoteResponse {
  position_id: string;
  candidate_id: string;
  vote_count: number;
}

// ─── Public Election ─────────────────────────────────────────────────────────

export interface PublicCandidate extends Candidate {
  vote_count: number;
}

export interface PublicPosition extends Position {
  candidates: PublicCandidate[];
}

export interface PublicElectionResponse {
  election: {
    election_id: string;
    title: string;
    description?: string;
    type: ElectionType;
    status: ElectionStatus;
    started_at?: string;
    scheduled_start_at?: string;
    scheduled_end_at?: string;
    show_live_results: boolean;
    leaderboard_mode: LeaderboardMode;
  };
  positions: PublicPosition[];
  active_position: ActivePosition | null;
}

// ─── Lobby ────────────────────────────────────────────────────────────────────

export interface LobbyParticipant {
  participant_id: string;
  display_name: string;
  joined_at: string;
}

export interface JoinLobbyResponse {
  participant_id: string;
  display_name: string;
}

export interface LobbyStateResponse {
  election_status: ElectionStatus;
  election_title: string;
  election_type: ElectionType;
  started_at: string | null;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  participants: LobbyParticipant[];
}

// ─── Results ─────────────────────────────────────────────────────────────────

export interface CandidateResult {
  candidate_id: string;
  name: string;
  bio?: string;
  photo_url?: string;
  vote_count: number;
  percentage: number;
}

export interface PositionResult {
  position: Position;
  candidates: CandidateResult[];
  total_votes: number;
  winner?: CandidateResult;
  is_tie?: boolean;
}

export interface ElectionResultsResponse {
  election: {
    election_id: string;
    title: string;
    type: ElectionType;
    status: ElectionStatus;
    started_at?: string;
    ended_at?: string;
  };
  positions: PositionResult[];
  total_votes_cast: number;
}
