import { rootRoute } from './__root';
import { indexRoute } from './index';

// Admin
import { adminLoginRoute } from './admin/login';
import { adminForgotPasswordRoute } from './admin/forgot-password';
import { adminSignupRoute } from './admin/signup';
import { adminOtpRoute } from './admin/otp';
import { adminDashboardRoute } from './admin/dashboard';
import { adminElectionsRoute } from './admin/elections/index';
import { adminElectionsCreateRoute } from './admin/elections/create';
import { adminElectionDetailsRoute } from './admin/elections/$electionId/index';
import { adminElectionStatisticsRoute } from './admin/elections/$electionId/statistics';
import { adminElectionPresenterRoute } from './admin/elections/$electionId/present';
import { adminCandidatesRoute } from './admin/candidates';
import { adminVotersRoute } from './admin/voters';
import { adminResultsRoute } from './admin/results';
import { adminSettingsRoute } from './admin/settings';

// Voter (new public flow)
import { voteJoinRoute } from './vote/join';
import { voteElectionRedirectRoute } from './vote/$electionId/index';
import { voteBallotRoute } from './vote/$electionId/ballot';
import { voteLobbyRoute } from './vote/$electionId/lobby';
import { publicResultsRoute } from './results/$electionId';

// Build the route tree
export const routeTree = rootRoute.addChildren([
  indexRoute,

  // Admin
  adminLoginRoute,
  adminForgotPasswordRoute,
  adminSignupRoute,
  adminOtpRoute,
  adminDashboardRoute,
  adminElectionsRoute,
  adminElectionsCreateRoute,
  adminElectionDetailsRoute,
  adminElectionStatisticsRoute,
  adminElectionPresenterRoute,
  adminCandidatesRoute,
  adminVotersRoute,
  adminResultsRoute,
  adminSettingsRoute,

  // Voter / Public
  voteJoinRoute,
  voteElectionRedirectRoute,
  voteLobbyRoute,
  voteBallotRoute,
  publicResultsRoute,
]);
