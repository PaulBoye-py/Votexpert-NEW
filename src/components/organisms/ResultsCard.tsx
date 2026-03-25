import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Badge,
  ProgressBar,
  Skeleton,
} from '@/components/atoms';
import { getInitials } from '@/lib/utils';
import { Trophy, Medal } from 'lucide-react';

interface CandidateResult {
  id: string;
  name: string;
  photoUrl?: string;
  votes: number;
  percentage: number;
  rank: number;
}

interface PositionResultsCardProps {
  position: string;
  totalVotes: number;
  candidates: CandidateResult[];
  winnerId?: string;
  isTie?: boolean;
  isLoading?: boolean;
  className?: string;
}

function ResultsSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-full" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  );
}

export function PositionResultsCard({
  position,
  totalVotes,
  candidates,
  winnerId,
  isTie = false,
  isLoading = false,
  className,
}: PositionResultsCardProps) {
  const sortedCandidates = [...candidates].sort((a, b) => a.rank - b.rank);
  const winner = sortedCandidates.find((c) => c.id === winnerId);
  const topVotes = sortedCandidates[0]?.votes ?? 0;

  const getRankBadge = (candidate: CandidateResult) => {
    const isTiedCandidate = isTie && candidate.votes === topVotes;
    if (isTiedCandidate) {
      return (
        <Badge className="flex items-center gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-300 border-0">
          TIE
        </Badge>
      );
    }
    if (candidate.id === winnerId) {
      return (
        <Badge variant="success" className="flex items-center gap-1">
          <Trophy className="h-3 w-3" />
          Winner
        </Badge>
      );
    }
    if (candidate.rank === 2) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <Medal className="h-3 w-3" />
          2nd
        </Badge>
      );
    }
    if (candidate.rank === 3) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <Medal className="h-3 w-3" />
          3rd
        </Badge>
      );
    }
    return null;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{position}</CardTitle>
            <CardDescription>
              {totalVotes} total vote{totalVotes !== 1 ? 's' : ''} cast
            </CardDescription>
          </div>
          {!isLoading && (
            isTie ? (
              <div className="text-right">
                <p className="text-sm text-amber-600 dark:text-amber-400 font-semibold">TIE</p>
                <p className="text-xs text-muted-foreground">No winner declared</p>
              </div>
            ) : winner ? (
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Winner</p>
                <p className="font-semibold text-foreground">{winner.name}</p>
              </div>
            ) : null
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ResultsSkeleton />
        ) : (
          <div className="space-y-4">
            {sortedCandidates.map((candidate) => {
              const isTiedCandidate = isTie && candidate.votes === topVotes;
              return (
                <div
                  key={candidate.id}
                  className={cn(
                    'flex items-center gap-4 p-3 rounded-lg transition-colors',
                    isTiedCandidate && 'bg-amber-500/5 border border-amber-500/20',
                    !isTie && candidate.id === winnerId && 'bg-primary/5 border border-primary/20'
                  )}
                >
                  <Avatar className="h-12 w-12">
                    {candidate.photoUrl && (
                      <AvatarImage src={candidate.photoUrl} alt={candidate.name} />
                    )}
                    <AvatarFallback>{getInitials(candidate.name)}</AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-foreground truncate">
                        {candidate.name}
                      </p>
                      {getRankBadge(candidate)}
                    </div>
                    <ProgressBar
                      value={candidate.percentage}
                      variant={isTiedCandidate ? 'default' : candidate.id === winnerId ? 'success' : 'default'}
                      size="sm"
                    />
                  </div>

                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">
                      {candidate.percentage.toFixed(1)}%
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {candidate.votes} vote{candidate.votes !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
