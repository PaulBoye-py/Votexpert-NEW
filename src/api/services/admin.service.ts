import { apiClient } from '../client';
import { ENDPOINTS } from '../endpoints';
import type {
  Org,
  Election,
  CreateElectionPayload,
  Position,
  CreatePositionPayload,
  Candidate,
  CreateCandidatePayload,
  Voter,
} from '@/types';

// ─── Org ──────────────────────────────────────────────────────────────────────

export async function getMyOrg(): Promise<Org> {
  const res = await apiClient.get<Org>(ENDPOINTS.MY_ORG);
  return res.data;
}

// ─── Elections ────────────────────────────────────────────────────────────────

export async function getElections(): Promise<Election[]> {
  const res = await apiClient.get<Election[]>(ENDPOINTS.ELECTIONS);
  return res.data;
}

export async function createElection(payload: CreateElectionPayload): Promise<Election> {
  const res = await apiClient.post<Election>(ENDPOINTS.ELECTIONS, payload);
  return res.data;
}

export async function getElection(electionId: string): Promise<Election> {
  const res = await apiClient.get<Election>(ENDPOINTS.ELECTION(electionId));
  return res.data;
}

export async function updateElection(
  electionId: string,
  payload: Partial<CreateElectionPayload>
): Promise<Election> {
  const res = await apiClient.put<Election>(ENDPOINTS.ELECTION(electionId), payload);
  return res.data;
}

export async function deleteElection(electionId: string): Promise<void> {
  await apiClient.delete(ENDPOINTS.ELECTION(electionId));
}

export async function startElection(electionId: string): Promise<{
  election_id: string;
  status: string;
  started_at: string;
  expected_end_at: string;
}> {
  const res = await apiClient.post(ENDPOINTS.ELECTION_START(electionId));
  return res.data;
}

export async function endElection(electionId: string): Promise<{
  election_id: string;
  status: string;
  ended_at: string;
}> {
  const res = await apiClient.post(ENDPOINTS.ELECTION_END(electionId));
  return res.data;
}

export async function publishResults(electionId: string): Promise<{
  election_id: string;
  status: string;
}> {
  const res = await apiClient.post(ENDPOINTS.ELECTION_PUBLISH_RESULTS(electionId));
  return res.data;
}

// ─── Positions ────────────────────────────────────────────────────────────────

export async function getPositions(electionId: string): Promise<Position[]> {
  const res = await apiClient.get<Position[]>(ENDPOINTS.POSITIONS(electionId));
  return res.data;
}

export async function createPosition(
  electionId: string,
  payload: CreatePositionPayload
): Promise<Position> {
  const res = await apiClient.post<Position>(ENDPOINTS.POSITIONS(electionId), payload);
  return res.data;
}

export async function updatePosition(
  electionId: string,
  positionId: string,
  payload: Partial<CreatePositionPayload>
): Promise<Position> {
  const res = await apiClient.put<Position>(
    ENDPOINTS.POSITION(electionId, positionId),
    payload
  );
  return res.data;
}

export async function deletePosition(
  electionId: string,
  positionId: string
): Promise<void> {
  await apiClient.delete(ENDPOINTS.POSITION(electionId, positionId));
}

// ─── Candidates ───────────────────────────────────────────────────────────────

export async function getCandidates(
  electionId: string,
  positionId: string
): Promise<Candidate[]> {
  const res = await apiClient.get<Candidate[]>(
    ENDPOINTS.CANDIDATES(electionId, positionId)
  );
  return res.data;
}

export async function createCandidate(
  electionId: string,
  positionId: string,
  payload: CreateCandidatePayload
): Promise<Candidate> {
  const res = await apiClient.post<Candidate>(
    ENDPOINTS.CANDIDATES(electionId, positionId),
    payload
  );
  return res.data;
}

export async function updateCandidate(
  electionId: string,
  positionId: string,
  candidateId: string,
  payload: Partial<CreateCandidatePayload>
): Promise<Candidate> {
  const res = await apiClient.put<Candidate>(
    ENDPOINTS.CANDIDATE(electionId, positionId, candidateId),
    payload
  );
  return res.data;
}

export async function deleteCandidate(
  electionId: string,
  positionId: string,
  candidateId: string
): Promise<void> {
  await apiClient.delete(ENDPOINTS.CANDIDATE(electionId, positionId, candidateId));
}

// ─── Voters ───────────────────────────────────────────────────────────────────

export async function getVoters(electionId: string): Promise<Voter[]> {
  const res = await apiClient.get<Voter[]>(ENDPOINTS.VOTERS(electionId));
  return res.data;
}

export async function addVoters(
  electionId: string,
  emails: string[]
): Promise<{ added: number; skipped: number; skipped_emails: string[] }> {
  const res = await apiClient.post(ENDPOINTS.VOTERS(electionId), { emails });
  return res.data;
}

export async function importVotersCSV(
  electionId: string,
  csv: string
): Promise<{ added: number; skipped: number; total_in_csv: number }> {
  const res = await apiClient.post(ENDPOINTS.VOTERS_IMPORT(electionId), { csv });
  return res.data;
}

export async function sendInvites(
  electionId: string,
  voterIds?: string[]
): Promise<{ sent: number; failed: number; total: number }> {
  const res = await apiClient.post(ENDPOINTS.VOTERS_SEND_INVITES(electionId), {
    voter_ids: voterIds,
  });
  return res.data;
}

export async function deleteVoter(
  electionId: string,
  voterId: string
): Promise<void> {
  await apiClient.delete(ENDPOINTS.VOTER(electionId, voterId));
}

// ─── Uploads ──────────────────────────────────────────────────────────────────

export async function getPresignedUploadUrl(
  filename: string,
  contentType: string
): Promise<{ uploadUrl: string; fileUrl: string }> {
  const res = await apiClient.post('/uploads/presign', { filename, contentType });
  return res.data;
}

export async function uploadFileToS3(uploadUrl: string, file: File): Promise<void> {
  await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
}
