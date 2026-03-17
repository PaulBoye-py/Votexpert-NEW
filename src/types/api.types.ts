// Base API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}

// Admin Types
export interface Admin {
  admin_id: string;
  username: string;
  email: string;
}

export interface AdminLoginResponse {
  success: boolean;
  message: string;
  token: string;
  expires_in: number;
}

export interface AdminVerifyOtpResponse {
  success: boolean;
  access_token: string;
  refresh_token: string;
  admin: Admin;
}

// Voter Types
export interface Voter {
  voter_id: string;
  name: string;
  email: string;
  has_voted: boolean;
  voted_at: string | null;
}

export interface VoterLoginInitiateResponse {
  success: boolean;
  message: string;
  voter_id?: string;
  election_id?: string;
}

export interface VoterVerifyEmailResponse {
  success: boolean;
  message: string;
  otp_required: boolean;
  voter_id: string;
}

export interface VoterVerifyOtpResponse {
  success: boolean;
  message: string;
  access_token?: string;
  face_verification_required?: boolean;
  face_verification_token?: string;
  voter?: {
    voter_id: string;
    name: string;
    email: string;
    election_id: string;
    has_voted: boolean;
  };
  election?: {
    election_id: string;
    election_name: string;
    status: string;
  };
}

export interface VoterVerifyFaceResponse {
  success: boolean;
  message: string;
  access_token: string;
  refresh_token: string;
  voter: Voter;
  similarity: number;
}

export interface VoterProfileResponse {
  success: boolean;
  voter: Voter;
  election: {
    election_id: string;
    election_name: string;
    status: string;
  };
}

// Election Types
export type ElectionStatus =
  | 'draft'
  | 'active'
  | 'ongoing'
  | 'concluded'
  | 'cancelled'
  | 'results_announced';

export interface Position {
  position_name: string;
  max_candidates: number;
}

export interface ElectionDetails {
  election_id: string;
  election_name: string;
  description: string;
  status: ElectionStatus;
  created_by: string;
  created_at: string;
  election_start_time: string;
  election_end_time: string;
  result_announcement_time: string;
  positions: Position[];
  statistics: {
    total_voters: number;
    total_candidates: number;
    votes_cast: number;
    voter_turnout: number;
  };
}

export interface ElectionInfo {
  election_id: string;
  election_name: string;
  description: string;
  start_time: string;
  end_time: string;
  status: string;
  positions: string[];
  total_candidates: number;
  voter_status: {
    has_voted: boolean;
    can_vote: boolean;
    time_remaining: string | null;
  };
}

// Candidate Types
export interface Candidate {
  candidate_id: string;
  name: string;
  position: string;
  bio: string;
  photo_url: string;
  manifesto: string;
}

export interface PositionWithCandidates {
  position: string;
  candidates: Candidate[];
}

export interface CandidatesResponse {
  success: boolean;
  positions: PositionWithCandidates[];
}

// Voting Types
export interface VotePayload {
  votes: Record<string, string>; // position -> candidate_id
}

export interface VoteReceipt {
  vote_id: string;
  timestamp: string;
  positions_voted: number;
}

export interface CastVoteResponse {
  success: boolean;
  message: string;
  receipt: VoteReceipt;
}

// Statistics Types
export interface VotingTrend {
  time: string;
  votes: number;
}

export interface Statistics {
  total_voters: number;
  votes_cast: number;
  pending_votes: number;
  turnout_percentage: number;
  votes_by_position: Record<string, number>;
  voting_trend: VotingTrend[];
  last_updated: string;
}

export interface StatisticsResponse {
  success: boolean;
  statistics: Statistics;
}

// Results Types
export interface CandidateResult {
  candidate_id: string;
  name: string;
  photo_url: string;
  votes: number;
  percentage: number;
  rank: number;
}

export interface PositionResult {
  position: string;
  total_votes: number;
  candidates: CandidateResult[];
  winner: {
    candidate_id: string;
    name: string;
  };
}

export interface ElectionResultsResponse {
  success: boolean;
  election: {
    election_id: string;
    election_name: string;
    status: string;
    total_registered_voters: number;
    total_votes_cast: number;
    voter_turnout_percentage: number;
  };
  results: PositionResult[];
  results_available: boolean;
  generated_at: string;
}

// Create Election Types
export interface CreateElectionPayload {
  election_name: string;
  description?: string;
  election_start_time: string;
  election_end_time: string;
  result_announcement_time?: string;
  positions: string; // JSON stringified Position[]
  candidates_csv_base64?: string;
  voters_csv_base64?: string;
}

export interface CreateElectionResponse {
  success: boolean;
  election_id: string;
  message: string;
  processing: {
    candidates: string;
    voters: string;
  };
}

// Update Election Status
export interface UpdateElectionStatusPayload {
  status: ElectionStatus;
}

export interface UpdateElectionStatusResponse {
  success: boolean;
  election_id: string;
  status: ElectionStatus;
  updated_at: string;
}
