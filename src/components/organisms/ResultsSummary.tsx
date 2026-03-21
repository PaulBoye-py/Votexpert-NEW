import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  ProgressBar,
  Skeleton,
} from '@/components/atoms';
import { StatCard } from '@/components/molecules';
import { PositionResultsCard } from './ResultsCard';
import { Users, Vote, Trophy, BarChart3, Clock, CheckCircle } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface CandidateResult {
  id: string;
  name: string;
  photoUrl?: string;
  votes: number;
  percentage: number;
  rank: number;
}

interface PositionResult {
  position: string;
  totalVotes: number;
  candidates: CandidateResult[];
  winnerId: string;
}

interface ResultsSummaryProps {
  electionName: string;
  electionStatus: string;
  totalRegisteredVoters: number;
  totalVotesCast: number;
  voterTurnoutPercentage: number;
  positions: PositionResult[];
  generatedAt?: string;
  resultsAvailable: boolean;
  isLoading?: boolean;
  className?: string;
}

function SummarySkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-6 border rounded-lg space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="p-6 border rounded-lg space-y-4">
            <Skeleton className="h-6 w-32" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ResultsSummary({
  electionName,
  electionStatus,
  totalRegisteredVoters,
  totalVotesCast,
  voterTurnoutPercentage,
  positions,
  generatedAt,
  resultsAvailable,
  isLoading = false,
  className,
}: ResultsSummaryProps) {
  if (isLoading) {
    return <SummarySkeleton />;
  }

  if (!resultsAvailable) {
    return (
      <Card className={className}>
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Clock className="w-8 h-8 text-muted-foreground" />
          </div>
          <CardTitle>Results Not Yet Available</CardTitle>
          <CardDescription>
            The results for this election have not been announced yet.
            Please check back later.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Count winners
  const totalPositions = positions.length;
  const winners = positions.map((p) => {
    const winner = p.candidates.find((c) => c.id === p.winnerId);
    return { position: p.position, winner };
  });

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{electionName}</h1>
          <p className="text-muted-foreground">Election Results</p>
        </div>
        <Badge
          variant={electionStatus === 'results_announced' ? 'success' : 'secondary'}
          className="flex items-center gap-1"
        >
          <CheckCircle className="h-3 w-3" />
          {electionStatus === 'results_announced' ? 'Results Announced' : electionStatus}
        </Badge>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Registered Voters"
          value={totalRegisteredVoters}
          icon={Users}
        />
        <StatCard
          label="Votes Cast"
          value={totalVotesCast}
          icon={Vote}
        />
        <StatCard
          label="Voter Turnout"
          value={`${voterTurnoutPercentage.toFixed(1)}%`}
          icon={BarChart3}
        />
        <StatCard
          label="Positions"
          value={totalPositions}
          icon={Trophy}
        />
      </div>

      {/* Turnout Progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Voter Turnout</CardTitle>
        </CardHeader>
        <CardContent>
          <ProgressBar
            value={voterTurnoutPercentage}
            showLabel
            size="lg"
            variant={voterTurnoutPercentage >= 50 ? 'success' : 'default'}
          />
        </CardContent>
      </Card>

      {/* Winners Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Winners
          </CardTitle>
          <CardDescription>
            Elected candidates for each position
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {winners.map(({ position, winner }) => (
              <div
                key={position}
                className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
              >
                <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-muted border border-border">
                  {winner?.photoUrl ? (
                    <img src={winner.photoUrl} alt={winner.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm font-bold text-muted-foreground">
                      {winner?.name.charAt(0).toUpperCase() ?? '?'}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{position}</p>
                  <p className="font-semibold text-sm truncate">{winner?.name || 'No winner'}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Results by Position */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Detailed Results</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          {positions.map((position) => (
            <PositionResultsCard
              key={position.position}
              position={position.position}
              totalVotes={position.totalVotes}
              candidates={position.candidates}
              winnerId={position.winnerId}
            />
          ))}
        </div>
      </div>

      {/* Generated timestamp */}
      {generatedAt && (
        <p className="text-sm text-muted-foreground text-center">
          Results generated at {formatDate(generatedAt)}
        </p>
      )}
    </div>
  );
}
