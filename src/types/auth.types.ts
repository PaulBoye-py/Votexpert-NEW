import type { Admin } from './api.types';

export type UserType = 'admin';

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: Admin | null;
  userType: UserType | null;
  isAuthenticated: boolean;
}

// Cognito signup
export interface AdminSignupCredentials {
  email: string;
  password: string;
  name: string;
  org_name: string;
}

// Cognito confirm signup (OTP)
export interface AdminConfirmPayload {
  email: string;
  code: string;
}

// Cognito login
export interface AdminLoginCredentials {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;   // Cognito IdToken — used as Bearer for our API
  refreshToken: string;  // Cognito RefreshToken
}

// Voter session (not a login — just localStorage token for voting)
export interface VoterSession {
  session_token: string;
  election_id: string;
  invite_token?: string;   // for closed elections
  participant_id?: string; // lobby participant ID (set when joining lobby)
  display_name?: string;   // voter's chosen display name (open elections)
}
