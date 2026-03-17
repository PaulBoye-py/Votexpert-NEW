import { rootRoute } from './__root';
import { indexRoute } from './index';
import { voterLoginRoute } from './voter/login';
import { voterOtpRoute } from './voter/otp';
import { voterFaceVerificationRoute } from './voter/face-verification';
import { voterElectionsRoute } from './voter/elections/index';
import { voterElectionDetailsRoute } from './voter/elections/$electionId/index';
import { voterElectionVoteRoute } from './voter/elections/$electionId/vote';
import { voterElectionSuccessRoute } from './voter/elections/$electionId/success';
import { voterResultsRoute } from './voter/results.$electionId';
import { adminLoginRoute } from './admin/login';
import { adminOtpRoute } from './admin/otp';
import { adminDashboardRoute } from './admin/dashboard';
import { adminElectionsRoute } from './admin/elections/index';
import { adminElectionsCreateRoute } from './admin/elections/create';
import { adminElectionDetailsRoute } from './admin/elections/$electionId/index';
import { adminElectionStatisticsRoute } from './admin/elections/$electionId/statistics';
import { adminCandidatesRoute } from './admin/candidates';
import { adminVotersRoute } from './admin/voters';
import { adminResultsRoute } from './admin/results';
import { adminSettingsRoute } from './admin/settings';

// Build the route tree
export const routeTree = rootRoute.addChildren([
  indexRoute,
  voterLoginRoute,
  voterOtpRoute,
  voterFaceVerificationRoute,
  voterElectionsRoute,
  voterElectionDetailsRoute,
  voterElectionVoteRoute,
  voterElectionSuccessRoute,
  voterResultsRoute,
  adminLoginRoute,
  adminOtpRoute,
  adminDashboardRoute,
  adminElectionsRoute,
  adminElectionsCreateRoute,
  adminElectionDetailsRoute,
  adminElectionStatisticsRoute,
  adminCandidatesRoute,
  adminVotersRoute,
  adminResultsRoute,
  adminSettingsRoute,
]);
