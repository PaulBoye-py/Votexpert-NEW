import * as React from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { rootRoute } from '../../../__root';
import { VoterLayout } from '@/components/templates';
import { VotingBooth } from '@/components/organisms';
import { AlertMessage } from '@/components/molecules';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/atoms';
import { getElectionCandidates, castVote } from '@/api/services/voter.service';
import { $user, $isAuthenticated, logout } from '@/stores/auth.store';
import { setVoteReceipt } from '@/stores/election.store';
import { useStore } from '@nanostores/react';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import type { Voter, VotePayload } from '@/types';

export const voterElectionVoteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/voter/elections/$electionId/vote',
  component: VotingPage,
});

function VotingPage() {
  const navigate = useNavigate();
  const { electionId } = voterElectionVoteRoute.useParams();
  const user = useStore($user) as Voter | null;
  const isAuthenticated = useStore($isAuthenticated);
  const [error, setError] = React.useState<string | undefined>();

  // Get election data from localStorage
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
  const { data: candidatesData, isLoading: candidatesLoading } = useQuery({
    queryKey: ['election', electionId, 'candidates'],
    queryFn: () => getElectionCandidates(electionId),
    enabled: isAuthenticated && !!electionId,
  });

  // Cast vote mutation
  const voteMutation = useMutation({
    mutationFn: (votes: Record<string, string>) => {
      const payload: VotePayload = { votes };
      return castVote(electionId, payload);
    },
    onSuccess: (data) => {
      if (data.success) {
        // Store the receipt
        setVoteReceipt({
          ...data.receipt,
          electionName: storedElection?.election_name || 'Election',
        });
        // Navigate to success page
        navigate({
          to: '/voter/elections/$electionId/success',
          params: { electionId },
        });
      } else {
        setError(data.message || 'Failed to submit vote. Please try again.');
      }
    },
    onError: (err: Error) => {
      setError(err.message || 'An error occurred. Please try again.');
    },
  });

  const handleLogout = () => {
    logout();
    navigate({ to: '/voter/login' });
  };

  const handleBack = () => {
    navigate({ to: '/voter/elections/$electionId', params: { electionId } });
  };

  const handleSubmitVote = (votes: Record<string, string>) => {
    setError(undefined);
    voteMutation.mutate(votes);
  };

  // Use stored election data
  const election = storedElection;
  const hasVoted = user?.has_voted ?? false;
  const isElectionActive = election?.status === 'ongoing' || election?.status === 'active';
  const canVote = isElectionActive && !hasVoted;

  // Transform candidates for VotingBooth
  const positions = React.useMemo(() => {
    if (!candidatesData?.positions) return [];
    return candidatesData.positions.map((pos) => ({
      position: pos.position,
      candidates: pos.candidates.map((c) => ({
        id: c.candidate_id,
        name: c.name,
        photoUrl: c.photo_url,
        bio: c.bio,
        manifesto: c.manifesto,
      })),
    }));
  }, [candidatesData]);

  const isLoading = candidatesLoading;

  if (!isAuthenticated) {
    return null;
  }

  // Can't vote state
  if (!isLoading && !canVote) {
    return (
      <VoterLayout
        voterName={user?.name || 'Voter'}
        voterEmail={user?.email}
        onLogout={handleLogout}
      >
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
              <CardTitle>Cannot Vote</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <AlertMessage variant="warning">
                You are not eligible to vote in this election at this time.
                This could be because voting has ended, hasn't started yet, or you have already voted.
              </AlertMessage>
              <Button onClick={handleBack} className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Election
              </Button>
            </CardContent>
          </Card>
        </div>
      </VoterLayout>
    );
  }

  return (
    <VoterLayout
      voterName={user?.name || 'Voter'}
      voterEmail={user?.email}
      electionName={election?.election_name}
      onLogout={handleLogout}
    >
      <div className="max-w-4xl mx-auto">
        {/* Back button */}
        <Button variant="ghost" onClick={handleBack} className="gap-2 mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to Election Details
        </Button>

        {error && (
          <AlertMessage variant="error" className="mb-4">
            {error}
          </AlertMessage>
        )}

        {isLoading ? (
          <Card>
            <CardContent className="p-8">
              <p className="text-center text-muted-foreground">Loading ballot...</p>
            </CardContent>
          </Card>
        ) : (
          <VotingBooth
            electionName={election?.election_name || 'Election'}
            positions={positions}
            onSubmit={handleSubmitVote}
            isSubmitting={voteMutation.isPending}
            error={error}
          />
        )}
      </div>
    </VoterLayout>
  );
}
