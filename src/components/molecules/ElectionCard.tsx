import { cn } from '@/lib/utils';
import { Card, Badge, Button } from '@/components/atoms';
import { formatDate, formatTimeRemaining, isBetween, isPast } from '@/lib/utils';
import { Calendar, Users, Clock, ArrowRight } from 'lucide-react';
import type { ElectionStatus } from '@/types';
import { ELECTION_STATUS_LABELS } from '@/lib/constants';

interface ElectionCardProps {
  id: string;
  name: string;
  description?: string;
  status: ElectionStatus;
  startTime: string;
  endTime: string;
  totalVoters?: number;
  votesCast?: number;
  onAction?: () => void;
  actionLabel?: string;
  className?: string;
}

const statusVariants: Partial<Record<ElectionStatus, 'default' | 'secondary' | 'success' | 'warning' | 'info' | 'destructive'>> = {
  DRAFT: 'secondary',
  SCHEDULED: 'warning',
  ACTIVE: 'info',
  CLOSED: 'default',
  RESULTS_PUBLISHED: 'success',
};

export function ElectionCard({
  name,
  description,
  status,
  startTime,
  endTime,
  totalVoters,
  votesCast,
  onAction,
  actionLabel,
  className,
}: ElectionCardProps) {
  const isOngoing = isBetween(startTime, endTime);
  const hasEnded = isPast(endTime);

  return (
    <Card className={cn('p-5', className)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-foreground truncate">{name}</h3>
          {description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {description}
            </p>
          )}
        </div>
        <Badge variant={statusVariants[status] ?? 'default'}>
          {ELECTION_STATUS_LABELS[status] || status}
        </Badge>
      </div>

      {/* Stats */}
      <div className="space-y-2 mb-4">
        {/* Dates */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>
            {formatDate(startTime)}{endTime ? ` - ${formatDate(endTime)}` : ''}
          </span>
        </div>

        {/* Time remaining or status */}
        {isOngoing && (
          <div className="flex items-center gap-2 text-sm text-primary">
            <Clock className="h-4 w-4" />
            <span>{formatTimeRemaining(endTime)}</span>
          </div>
        )}

        {/* Voter stats */}
        {totalVoters !== undefined && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>
              {votesCast !== undefined
                ? `${votesCast} / ${totalVoters} voted`
                : `${totalVoters} registered voters`}
            </span>
          </div>
        )}
      </div>

      {/* Action button */}
      {onAction && (
        <Button
          onClick={onAction}
          className="w-full"
          variant={hasEnded ? 'secondary' : 'default'}
        >
          {actionLabel || (hasEnded ? 'View Results' : 'View Election')}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      )}
    </Card>
  );
}
