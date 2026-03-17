import { apiClient, publicApiClient } from '../client';
import { ENDPOINTS } from '../endpoints';
import type {
  VoterLoginInitiateResponse,
  VoterVerifyEmailResponse,
  VoterVerifyOtpResponse,
  VoterVerifyFaceResponse,
  VoterProfileResponse,
  ElectionInfo,
  CandidatesResponse,
  CastVoteResponse,
  VotePayload,
} from '@/types';
import type { VoterLoginCredentials, VoterOtpPayload, VoterFacePayload } from '@/types';

// Voter Authentication
export async function voterLoginInitiate(
  credentials: VoterLoginCredentials
): Promise<VoterLoginInitiateResponse> {
  const response = await publicApiClient.post<VoterLoginInitiateResponse>(
    ENDPOINTS.VOTER_LOGIN_INITIATE,
    credentials
  );
  return response.data;
}

export async function voterVerifyEmail(
  token: string
): Promise<VoterVerifyEmailResponse> {
  const response = await publicApiClient.get<VoterVerifyEmailResponse>(
    ENDPOINTS.VOTER_VERIFY_EMAIL(token)
  );
  return response.data;
}

export async function voterVerifyOtp(
  payload: VoterOtpPayload
): Promise<VoterVerifyOtpResponse> {
  const response = await publicApiClient.post<VoterVerifyOtpResponse>(
    ENDPOINTS.VOTER_VERIFY_OTP,
    payload
  );
  return response.data;
}

export async function voterVerifyFace(
  payload: VoterFacePayload
): Promise<VoterVerifyFaceResponse> {
  const response = await publicApiClient.post<VoterVerifyFaceResponse>(
    ENDPOINTS.VOTER_VERIFY_FACE,
    payload
  );
  return response.data;
}

// Voter Profile
export async function getVoterProfile(): Promise<VoterProfileResponse> {
  const response = await apiClient.get<VoterProfileResponse>(
    ENDPOINTS.VOTER_PROFILE
  );
  return response.data;
}

// Elections
export async function getElectionInfo(
  electionId: string
): Promise<{ success: boolean; election: ElectionInfo }> {
  const response = await apiClient.get<{ success: boolean; election: ElectionInfo }>(
    ENDPOINTS.VOTER_ELECTION_INFO(electionId)
  );
  return response.data;
}

export async function getElectionCandidates(
  electionId: string,
  position?: string
): Promise<CandidatesResponse> {
  const params = position ? { position } : {};
  // Use public client to avoid 401 logout - candidates are public info
  const response = await publicApiClient.get<CandidatesResponse>(
    ENDPOINTS.VOTER_ELECTION_CANDIDATES(electionId),
    { params }
  );
  return response.data;
}

// Voting
export async function castVote(
  electionId: string,
  votes: VotePayload
): Promise<CastVoteResponse> {
  const response = await apiClient.post<CastVoteResponse>(
    ENDPOINTS.VOTER_CAST_VOTE(electionId),
    votes
  );
  return response.data;
}
