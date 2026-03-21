import { atom, computed } from 'nanostores';
import type { Admin } from '@/types';
import type { AuthTokens, VoterSession } from '@/types/auth.types';
import { TOKEN_STORAGE_KEY, USER_STORAGE_KEY, VOTER_SESSION_KEY } from '@/lib/constants';

// ─── Admin Auth ───────────────────────────────────────────────────────────────

export const $accessToken = atom<string | null>(null);
export const $refreshToken = atom<string | null>(null);
export const $user = atom<Admin | null>(null);

export const $isAuthenticated = computed(
  [$accessToken, $user],
  (token, user) => !!token && !!user
);

export const $isAdmin = computed([$isAuthenticated], (auth) => auth);

// Legacy — voter flow is sessionToken-based, not user-based
export const $userType = computed([$isAuthenticated], (auth) =>
  auth ? ('admin' as const) : null
);

// ─── Voter Session (no login — just a session token for voting) ───────────────

export const $voterSession = atom<VoterSession | null>(null);

// ─── Pending Cognito Signup (between SignUp and ConfirmSignUp) ────────────────
export const $pendingEmail = atom<string | null>(null);

// ─── Actions ─────────────────────────────────────────────────────────────────

export function setTokens(tokens: AuthTokens) {
  $accessToken.set(tokens.accessToken);
  $refreshToken.set(tokens.refreshToken);
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
  } catch (e) {
    console.error('Failed to persist tokens:', e);
  }
}

export function setUser(user: Admin) {
  $user.set(user);
  try {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch (e) {
    console.error('Failed to persist user:', e);
  }
}

export function setPendingEmail(email: string | null) {
  $pendingEmail.set(email);
  if (email) {
    try { localStorage.setItem('votexpert_pending_email', email); } catch { /* */ }
  } else {
    try { localStorage.removeItem('votexpert_pending_email'); } catch { /* */ }
  }
}

export function setVoterSession(session: VoterSession | null) {
  $voterSession.set(session);
  try {
    if (session) {
      localStorage.setItem(VOTER_SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(VOTER_SESSION_KEY);
    }
  } catch { /* */ }
}

export function logout() {
  $accessToken.set(null);
  $refreshToken.set(null);
  $user.set(null);
  $pendingEmail.set(null);
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem('votexpert_pending_email');
  } catch (e) {
    console.error('Failed to clear storage:', e);
  }
}

export function initializeAuth() {
  try {
    const tokensJson = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (tokensJson) {
      const tokens = JSON.parse(tokensJson) as AuthTokens;
      $accessToken.set(tokens.accessToken);
      $refreshToken.set(tokens.refreshToken);
    }
    const userJson = localStorage.getItem(USER_STORAGE_KEY);
    if (userJson) {
      $user.set(JSON.parse(userJson) as Admin);
    }
    const pendingEmail = localStorage.getItem('votexpert_pending_email');
    if (pendingEmail) {
      $pendingEmail.set(pendingEmail);
    }
    const sessionJson = localStorage.getItem(VOTER_SESSION_KEY);
    if (sessionJson) {
      $voterSession.set(JSON.parse(sessionJson) as VoterSession);
    }
  } catch (e) {
    console.error('Failed to initialize auth:', e);
    logout();
  }
}
