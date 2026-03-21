import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  ProgressBar,
} from '@/components/atoms';
import { StatCard } from '@/components/molecules';
import { formatDate, formatTimeRemaining, isBetween } from '@/lib/utils';
import { Calendar, Users, Vote, Clock, Trophy, BarChart3 } from 'lucide-react';
import type { ElectionStatus } from '@/types';
import { ELECTION_STATUS_LABELS } from '@/lib/constants';

interface ElectionDetailsCardProps {
  name: string;
  description?: string;
  status: ElectionStatus;
  startTime: string;
  endTime: string;
  resultAnnouncementTime?: string;
  positions?: string[];
  statistics?: {
    totalVoters: number;
    totalCandidates: number;
    votesCast: number;
    voterTurnout: number;
  };
  className?: string;
}

const statusVariants: Partial<Record<ElectionStatus, 'default' | 'secondary' | 'success' | 'warning' | 'info' | 'destructive'>> = {
  DRAFT: 'secondary',
  SCHEDULED: 'warning',
  ACTIVE: 'info',
  CLOSED: 'default',
  RESULTS_PUBLISHED: 'success',
};

export function ElectionDetailsCard({
  name,
  description,
  status,
  startTime,
  endTime,
  resultAnnouncementTime,
  positions,
  statistics,
  className,
}: ElectionDetailsCardProps) {
  const isOngoing = isBetween(startTime, endTime);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">{name}</CardTitle>
              {description && (
                <CardDescription className="mt-2">{description}</CardDescription>
              )}
            </div>
            <Badge variant={statusVariants[status] ?? 'default'} className="text-sm">
              {ELECTION_STATUS_LABELS[status] || status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Timeline */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Start</p>
                <p className="font-medium">{formatDate(startTime)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">End</p>
                <p className="font-medium">{formatDate(endTime)}</p>
              </div>
            </div>
            {resultAnnouncementTime && (
              <div className="flex items-center gap-2 text-sm">
                <Trophy className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Results</p>
                  <p className="font-medium">{formatDate(resultAnnouncementTime)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Time remaining for ongoing elections */}
          {isOngoing && (
            <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg">
              <Clock className="h-5 w-5 text-primary" />
              <span className="font-medium text-primary">
                {formatTimeRemaining(endTime)}
              </span>
            </div>
          )}

          {/* Positions */}
          {positions && positions.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Positions</p>
              <div className="flex flex-wrap gap-2">
                {positions.map((position) => (
                  <Badge key={position} variant="secondary">
                    {position}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statistics */}
      {statistics && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Voters"
            value={statistics.totalVoters}
            icon={Users}
          />
          <StatCard
            label="Candidates"
            value={statistics.totalCandidates}
            icon={Vote}
          />
          <StatCard
            label="Votes Cast"
            value={statistics.votesCast}
            icon={BarChart3}
          />
          <StatCard
            label="Voter Turnout"
            value={`${statistics.voterTurnout.toFixed(1)}%`}
            icon={Trophy}
            description={
              statistics.voterTurnout > 50
                ? 'Above average turnout'
                : statistics.voterTurnout > 0
                ? 'Voting in progress'
                : undefined
            }
          />
        </div>
      )}

      {/* Turnout Progress */}
      {statistics && statistics.totalVoters > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Voter Turnout Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <ProgressBar
              value={statistics.voterTurnout}
              showLabel
              size="lg"
            />
            <p className="text-sm text-muted-foreground mt-2">
              {statistics.votesCast} of {statistics.totalVoters} registered voters have cast their votes
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
