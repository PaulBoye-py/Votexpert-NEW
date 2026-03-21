// API Configuration
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'https://4yqf9s94k0.execute-api.us-east-1.amazonaws.com/dev';

// Cognito
export const COGNITO_CLIENT_ID =
  import.meta.env.VITE_COGNITO_CLIENT_ID || '3plqrtju10oh6k01envqctiisg';
export const COGNITO_REGION =
  import.meta.env.VITE_COGNITO_REGION || 'us-east-1';
export const COGNITO_ENDPOINT = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/`;

// App
export const APP_NAME = 'VoteXpert';
export const APP_TAGLINE = 'Empowering Transparent Decisions.';

// Auth storage
export const TOKEN_STORAGE_KEY = 'votexpert_tokens';
export const USER_STORAGE_KEY = 'votexpert_user';
export const VOTER_SESSION_KEY = 'votexpert_voter_session';

// OTP
export const OTP_LENGTH = 6;
export const OTP_EXPIRY_SECONDS = 300;

// Election status labels (new backend values)
export const ELECTION_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  ACTIVE: 'Active',
  CLOSED: 'Closed',
  RESULTS_PUBLISHED: 'Results Published',
};

// Election status colors (Tailwind classes)
export const ELECTION_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-500',
  SCHEDULED: 'bg-blue-400',
  ACTIVE: 'bg-green-500',
  CLOSED: 'bg-purple-500',
  RESULTS_PUBLISHED: 'bg-emerald-500',
};

export const ELECTION_TYPE_LABELS: Record<string, string> = {
  OPEN: 'Open (Public)',
  CLOSED: 'Closed (Invite Only)',
};

// Routes
export const ROUTES = {
  HOME: '/',

  // Admin
  ADMIN_LOGIN: '/admin/login',
  ADMIN_SIGNUP: '/admin/signup',
  ADMIN_OTP: '/admin/otp',
  ADMIN_DASHBOARD: '/admin/dashboard',
  ADMIN_ELECTIONS: '/admin/elections',
  ADMIN_CREATE_ELECTION: '/admin/elections/create',
  ADMIN_ELECTION_DETAILS: '/admin/elections/:electionId',
  ADMIN_ELECTION_STATISTICS: '/admin/elections/:electionId/statistics',

  // Voter (public entry points)
  VOTE_JOIN: '/vote/join',
  VOTE_BALLOT: '/vote/:electionId/ballot',
  VOTE_DONE: '/vote/:electionId/done',
  PUBLIC_RESULTS: '/results/:electionId',
} as const;

// Pagination
export const DEFAULT_PAGE_SIZE = 10;

// Date formats
export const DATE_FORMAT = 'MMM dd, yyyy';
export const DATETIME_FORMAT = 'MMM dd, yyyy HH:mm';
export const TIME_FORMAT = 'HH:mm';
