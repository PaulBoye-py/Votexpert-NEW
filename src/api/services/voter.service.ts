import { publicApiClient } from '../client';
import { ENDPOINTS } from '../endpoints';
import type {
  VoteSessionResponse,
  VerifyTokenResponse,
  CastVotePayload,
  CastVoteResponse,
  PublicElectionResponse,
  ElectionResultsResponse,
  JoinLobbyResponse,
  LobbyStateResponse,
} from '@/types';

// ─── Election code lookup ─────────────────────────────────────────────────────

export interface ElectionByCodeResponse {
  election_id: string;
  title: string;
  description?: string;
  type: 'OPEN' | 'CLOSED';
  status: string;
  election_code: string;
}

export async function getElectionByCode(code: string): Promise<ElectionByCodeResponse> {
  const res = await publicApiClient.get<ElectionByCodeResponse>(
    ENDPOINTS.ELECTION_BY_CODE(code)
  );
  return res.data;
}

// ─── Public Election ──────────────────────────────────────────────────────────

export async function getPublicElection(
  electionId: string
): Promise<PublicElectionResponse> {
  const res = await publicApiClient.get<PublicElectionResponse>(
    ENDPOINTS.PUBLIC_ELECTION(electionId)
  );
  return res.data;
}

// ─── Vote Session — Open Elections ────────────────────────────────────────────

export async function startVoteSession(
  electionId: string,
  existingToken?: string
): Promise<VoteSessionResponse> {
  const res = await publicApiClient.post<VoteSessionResponse>(
    ENDPOINTS.VOTE_SESSION,
    { election_id: electionId, session_token: existingToken }
  );
  return res.data;
}

// ─── Verify Invite Token — Closed Elections ───────────────────────────────────

export async function verifyInviteToken(
  token: string
): Promise<VerifyTokenResponse> {
  const res = await publicApiClient.get<VerifyTokenResponse>(
    ENDPOINTS.VOTE_VERIFY_TOKEN,
    { params: { token } }
  );
  return res.data;
}

// ─── Cast Vote ────────────────────────────────────────────────────────────────

export async function castVote(
  payload: CastVotePayload
): Promise<CastVoteResponse> {
  const res = await publicApiClient.post<CastVoteResponse>(
    ENDPOINTS.VOTE_CAST,
    payload
  );
  return res.data;
}

// ─── Lobby ────────────────────────────────────────────────────────────────────

export async function joinLobby(
  electionId: string,
  displayName?: string
): Promise<JoinLobbyResponse> {
  const res = await publicApiClient.post<JoinLobbyResponse>(
    ENDPOINTS.LOBBY_JOIN(electionId),
    { display_name: displayName || undefined }
  );
  return res.data;
}

export async function getLobbyState(
  electionId: string
): Promise<LobbyStateResponse> {
  const res = await publicApiClient.get<LobbyStateResponse>(
    ENDPOINTS.LOBBY_STATE(electionId)
  );
  return res.data;
}

// ─── Results ─────────────────────────────────────────────────────────────────

export async function getElectionResults(
  electionId: string
): Promise<ElectionResultsResponse> {
  const res = await publicApiClient.get<ElectionResultsResponse>(
    ENDPOINTS.RESULTS(electionId)
  );
  return res.data;
}
