import * as React from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { rootRoute } from '../../../__root';
import { VoterLayout } from '@/components/templates';
import { CandidateList } from '@/components/organisms';
import { AlertMessage } from '@/components/molecules';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/atoms';
import { getElectionCandidates } from '@/api/services/voter.service';
import { $user, $isAuthenticated, logout } from '@/stores/auth.store';
import { useStore } from '@nanostores/react';
import { Vote, BarChart3, ArrowLeft } from 'lucide-react';
import type { Voter } from '@/types';

export const voterElectionDetailsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/voter/elections/$electionId',
  component: ElectionDetailsPage,
});

function ElectionDetailsPage() {
  const navigate = useNavigate();
  const { electionId } = voterElectionDetailsRoute.useParams();
  const user = useStore($user) as Voter | null;
  const isAuthenticated = useStore($isAuthenticated);

  // Get election data from localStorage (saved during OTP verification)
  const [storedElection, setStoredElection] = React.useState<{
    election_id: string;
    election_name: string;
    status: string;
  } | null>(null);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem('votexpert_election');
      if (stored) {
        setStoredElection(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load election data:', e);
    }
  }, []);

  // Redirect if not authenticated
  React.useEffect(() => {
    if (!isAuthenticated) {
      navigate({ to: '/voter/login' });
    }
  }, [isAuthenticated, navigate]);

  // Fetch candidates
  const { data: candidatesData, isLoading: candidatesLoading, error: candidatesError } = useQuery({
    queryKey: ['election', electionId, 'candidates'],
    queryFn: () => getElectionCandidates(electionId),
    enabled: isAuthenticated && !!electionId,
  });

  const handleLogout = () => {
    logout();
    localStorage.removeItem('votexpert_election');
    navigate({ to: '/voter/login' });
  };

  const handleStartVoting = () => {
    navigate({ to: '/voter/elections/$electionId/vote', params: { electionId } });
  };

  const handleViewResults = () => {
    navigate({ to: '/voter/results/$electionId', params: { electionId } });
  };

  const handleBack = () => {
    navigate({ to: '/voter/elections' });
  };

  // Use stored election data
  const election = storedElection;
  const hasVoted = user?.has_voted ?? false;
  // Determine if voting is available based on election status
  const isElectionActive = election?.status === 'ongoing' || election?.status === 'active';
  const canVote = isElectionActive && !hasVoted;

  // Transform candidates for display
  const positions = React.useMemo(() => {
    if (!candidatesData?.positions) return [];
    return candidatesData.positions.map((pos) => ({
      position: pos.position,
      candidates: pos.candidates.map((c) => ({
        id: c.candidate_id,
        name: c.name,
        position: c.position,
        photoUrl: c.photo_url,
        bio: c.bio,
        manifesto: c.manifesto,
      })),
    }));
  }, [candidatesData]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <VoterLayout
      voterName={user?.name || 'Voter'}
      voterEmail={user?.email}
      electionName={election?.election_name}
      onLogout={handleLogout}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back button */}
        <Button variant="ghost" onClick={handleBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Elections
        </Button>

        {candidatesError && (
          <AlertMessage variant="error">
            Failed to load candidates. Please try again later.
          </AlertMessage>
        )}

        {/* Election Details */}
        {election && (
          <Card>
            <CardHeader>
              <CardTitle>{election.election_name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Status:</span>
                <span className={`text-sm font-medium px-2 py-1 rounded ${
                  election.status === 'ongoing' || election.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {election.status.charAt(0).toUpperCase() + election.status.slice(1)}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Voting Status & Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Voting Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasVoted ? (
              <>
                <AlertMessage variant="success">
                  You have already cast your vote in this election.
                </AlertMessage>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={handleViewResults} className="flex-1">
                    <BarChart3 className="mr-2 h-4 w-4" />
                    View Results
                  </Button>
                </div>
              </>
            ) : canVote ? (
              <>
                <AlertMessage variant="info">
                  You are eligible to vote in this election. The election is currently active.
                </AlertMessage>
                <Button onClick={handleStartVoting} className="w-full" size="lg">
                  <Vote className="mr-2 h-5 w-5" />
                  Start Voting
                </Button>
              </>
            ) : !isElectionActive ? (
              <AlertMessage variant="warning">
                This election is not currently active. Voting will be available when the election starts.
              </AlertMessage>
            ) : (
              <AlertMessage variant="warning">
                You are not eligible to vote in this election.
              </AlertMessage>
            )}
          </CardContent>
        </Card>

        {/* Candidates Preview */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Candidates</h2>
          <CandidateList
            positions={positions}
            isLoading={candidatesLoading}
          />
        </div>
      </div>
    </VoterLayout>
  );
}
