// API Endpoints — single source of truth for all backend routes

export const ENDPOINTS = {
  // ─── Org ──────────────────────────────────────────────────────────────────
  MY_ORG: '/orgs/me',

  // ─── Elections ────────────────────────────────────────────────────────────
  ELECTIONS: '/elections',
  ELECTION: (id: string) => `/elections/${id}`,
  ELECTION_START: (id: string) => `/elections/${id}/start`,
  ELECTION_END: (id: string) => `/elections/${id}/end`,
  ELECTION_PUBLISH_RESULTS: (id: string) => `/elections/${id}/publish-results`,

  // ─── Positions ────────────────────────────────────────────────────────────
  POSITIONS: (electionId: string) => `/elections/${electionId}/positions`,
  POSITION: (electionId: string, positionId: string) =>
    `/elections/${electionId}/positions/${positionId}`,

  // ─── Candidates ───────────────────────────────────────────────────────────
  CANDIDATES: (electionId: string, positionId: string) =>
    `/elections/${electionId}/positions/${positionId}/candidates`,
  CANDIDATE: (electionId: string, positionId: string, candidateId: string) =>
    `/elections/${electionId}/positions/${positionId}/candidates/${candidateId}`,

  // ─── Voters ───────────────────────────────────────────────────────────────
  VOTERS: (electionId: string) => `/elections/${electionId}/voters`,
  VOTER: (electionId: string, voterId: string) =>
    `/elections/${electionId}/voters/${voterId}`,
  VOTERS_IMPORT: (electionId: string) => `/elections/${electionId}/voters/import`,
  VOTERS_SEND_INVITES: (electionId: string) =>
    `/elections/${electionId}/voters/send-invites`,

  // ─── Voting (public) ──────────────────────────────────────────────────────
  VOTE_SESSION: '/vote/session',
  VOTE_VERIFY_TOKEN: '/vote/verify-token',
  VOTE_CAST: '/vote/cast',

  // ─── Public ───────────────────────────────────────────────────────────────
  PUBLIC_ELECTION: (id: string) => `/public/elections/${id}`,
  ELECTION_BY_CODE: (code: string) => `/public/elections/code/${code}`,

  // ─── Lobby (public) ───────────────────────────────────────────────────────
  LOBBY_JOIN: (id: string) => `/public/elections/${id}/lobby`,
  LOBBY_STATE: (id: string) => `/public/elections/${id}/lobby`,

  // ─── Results (public) ─────────────────────────────────────────────────────
  RESULTS: (id: string) => `/results/${id}`,
} as const;
