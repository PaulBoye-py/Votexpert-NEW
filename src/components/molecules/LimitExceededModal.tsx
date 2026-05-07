import * as React from 'react';
import { Link } from '@tanstack/react-router';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/atoms';
import { cn } from '@/lib/utils';

interface LimitExceededModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: string;
  current: number;
  limit: number;
  limitType: 'elections' | 'positions';
}

export function LimitExceededModal({
  isOpen,
  onClose,
  plan,
  current,
  limit,
  limitType,
}: LimitExceededModalProps) {
  if (!isOpen) return null;

  const typeLabel = limitType === 'elections' ? 'elections per month' : 'positions per election';
  const upgradeMessage = plan === 'free'
    ? 'Upgrade to Standard or higher'
    : plan === 'standard'
    ? 'Upgrade to Pro or Standard Pro'
    : 'Upgrade to Standard Pro';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full space-y-6 p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
          </div>
          <div className="space-y-1 flex-1">
            <h2 className="text-lg font-bold text-foreground">Plan Limit Reached</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You've reached your limit of{' '}
              <span className="font-semibold text-foreground">{limit} {typeLabel}</span> on
              your <span className="font-semibold capitalize">{plan}</span> plan.
            </p>
          </div>
        </div>

        <div className="bg-muted/40 rounded-lg p-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Your current usage</p>
          <div className="flex items-center justify-between">
            <p className="text-sm text-foreground">{current} of {limit}</p>
            <div className="h-2 flex-1 ml-3 rounded-full bg-muted-foreground/20 overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all"
                style={{ width: `${Math.min(100, (current / limit) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Button
            className="w-full gap-2 bg-primary hover:bg-primary/90"
            asChild
            onClick={onClose}
          >
            <Link to="/admin/pricing">
              {upgradeMessage}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
