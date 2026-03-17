import * as React from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { rootRoute } from '../../__root';
import { VoterLayout } from '@/components/templates';
import { ElectionList } from '@/components/organisms';
import { AlertMessage } from '@/components/molecules';
import { Button } from '@/components/atoms';
import { $user, $isAuthenticated, logout } from '@/stores/auth.store';
import { BarChart3 } from 'lucide-react';
import { useStore } from '@nanostores/react';
import type { Voter, ElectionStatus } from '@/types';

export const voterElectionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/voter/elections',
  component: VoterElectionsPage,
});

function VoterElectionsPage() {
  const navigate = useNavigate();
  const user = useStore($user) as Voter | null;
  const isAuthenticated = useStore($isAuthenticated);

  // Get election data from localStorage (saved during OTP verification)
  const [electionData, setElectionData] = React.useState<{
    election_id: string;
    election_name: string;
    status: string;
  } | null>(null);

  React.useEffect(() => {
    // Try to get election from localStorage
    try {
      const stored = localStorage.getItem('votexpert_election');
      if (stored) {
        setElectionData(JSON.parse(stored));
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

  const handleLogout = () => {
    logout();
    localStorage.removeItem('votexpert_election');
    navigate({ to: '/voter/login' });
  };

  const handleElectionClick = (electionId: string) => {
    navigate({ to: '/voter/elections/$electionId', params: { electionId } });
  };

  const handleViewResults = () => {
    if (electionData) {
      navigate({ to: '/voter/results/$electionId', params: { electionId: electionData.election_id } });
    }
  };

  // Transform election data for the list
  const elections = React.useMemo(() => {
    if (!electionData) return [];

    return [
      {
        id: electionData.election_id,
        name: electionData.election_name,
        status: electionData.status as ElectionStatus,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 86400000).toISOString(),
      },
    ];
  }, [electionData]);

  const getActionLabel = (election: { id: string; status: string }) => {
    if (user && 'has_voted' in user && user.has_voted) {
      return 'View Receipt';
    }
    if (election.status === 'ongoing' || election.status === 'active') {
      return 'Cast Vote';
    }
    return 'View Details';
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <VoterLayout
      voterName={user?.name || 'Voter'}
      voterEmail={user?.email}
      onLogout={handleLogout}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Your Elections</h1>
          <p className="text-muted-foreground">
            Select an election to cast your vote
          </p>
        </div>

        {/* Voting status message */}
        {user && 'has_voted' in user && user.has_voted && (
          <div className="space-y-4">
            <AlertMessage variant="success">
              You have already cast your vote in this election. Thank you for participating!
            </AlertMessage>
            <Button
              onClick={handleViewResults}
              variant="outline"
              className="w-full sm:w-auto"
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              View Live Results
            </Button>
          </div>
        )}

        <ElectionList
          elections={elections}
          isLoading={false}
          emptyMessage="No elections available at this time."
          onElectionClick={handleElectionClick}
          getActionLabel={getActionLabel}
        />
      </div>
    </VoterLayout>
  );
}
