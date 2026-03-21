import { cn } from '@/lib/utils';

interface CircularCountdownProps {
  seconds: number;
  total: number;
  size?: number;
  className?: string;
}

/**
 * Smooth SVG ring countdown clock.
 * - Ring depletes clockwise as time runs out.
 * - CSS transition handles the smooth animation between ticks.
 * - Turns red when ≤ 30 s remaining.
 */
export function CircularCountdown({ seconds, total, size = 140, className }: CircularCountdownProps) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? Math.max(0, Math.min(1, seconds / total)) : 0;
  const offset = circumference * (1 - progress);
  const urgent = seconds <= 30 && seconds > 0;

  const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = (seconds % 60).toFixed(1).padStart(4, '0');

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={8}
          className="stroke-muted"
        />
        {/* Countdown ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(
            urgent ? 'stroke-destructive' : 'stroke-primary',
          )}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease' }}
        />
      </svg>
      {/* Time label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn(
          'font-mono font-bold tabular-nums leading-none',
          size >= 140 ? 'text-3xl' : 'text-xl',
          urgent ? 'text-destructive' : 'text-foreground',
        )}>
          {mins}:{secs}
        </span>
        {size >= 120 && (
          <span className="text-xs text-muted-foreground mt-1">remaining</span>
        )}
      </div>
    </div>
  );
}
