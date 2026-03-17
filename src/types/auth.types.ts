import type { Admin, Voter } from './api.types';

export type UserType = 'admin' | 'voter';

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: Admin | Voter | null;
  userType: UserType | null;
  isAuthenticated: boolean;
}

export interface AdminLoginCredentials {
  username: string;
  password: string;
  // email?: string;
}

export interface AdminOtpPayload {
  session_token: string;
  otp: string;
}

export interface VoterLoginCredentials {
  voter_id: string;
  email: string;
}

export interface VoterOtpPayload {
  voter_id: string;
  election_id: string;
  otp: string;
}

export interface VoterFacePayload {
  face_image: string; // base64
  face_verification_token: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
