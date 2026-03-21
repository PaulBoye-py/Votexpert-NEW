import * as React from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useStore } from '@nanostores/react';
import { rootRoute } from '../__root';
import { ResultsSummary } from '@/components/organisms';
import { AlertMessage } from '@/components/molecules';
import { Button } from '@/components/atoms';
import { getElectionResults } from '@/api/services/voter.service';
import { $isAuthenticated } from '@/stores';
import { ArrowLeft, LayoutDashboard } from 'lucide-react';

export const publicResultsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/results/$electionId',
  component: PublicResultsPage,
});

function PublicResultsPage() {
  const navigate = useNavigate();
  const { electionId } = publicResultsRoute.useParams();
  const isAuthenticated = useStore($isAuthenticated);

  const { data, isLoading, error } = useQuery({
    queryKey: ['results', electionId],
    queryFn: () => getElectionResults(electionId),
  });

  const positions = React.useMemo(() => {
    if (!data?.positions) return [];
    return data.positions.map((pos) => ({
      position: pos.position.title,
      totalVotes: pos.total_votes,
      candidates: pos.candidates.map((c, idx) => ({
        id: c.candidate_id,
        name: c.name,
        photoUrl: c.photo_url ?? '',
        votes: c.vote_count,
        percentage: c.percentage,
        rank: idx + 1,
      })),
      winnerId: pos.winner?.candidate_id ?? '',
    }));
  }, [data]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {isAuthenticated ? (
          <Button variant="ghost" onClick={() => navigate({ to: '/admin/dashboard' })} className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Back to Dashboard
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => navigate({ to: '/' })} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
        )}

        {error && (
          <AlertMessage variant="error">
            {(error as Error).message || 'Failed to load results.'}
          </AlertMessage>
        )}

        <ResultsSummary
          electionName={data?.election?.title || 'Election Results'}
          electionStatus={data?.election?.status?.toLowerCase() ?? 'closed'}
          totalRegisteredVoters={0}
          totalVotesCast={data?.total_votes_cast ?? 0}
          voterTurnoutPercentage={0}
          positions={positions}
          generatedAt={new Date().toISOString()}
          resultsAvailable={!!data}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
