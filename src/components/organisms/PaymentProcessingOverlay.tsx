import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/atoms';

interface PaymentProcessingOverlayProps {
  isOpen: boolean;
  step: 1 | 2 | 3 | 'success' | 'error';
  error?: string;
  plan?: string;
  onRetry?: () => void;
  onClose?: () => void;
}

export function PaymentProcessingOverlay({
  isOpen,
  step,
  error,
  plan,
  onRetry,
  onClose,
}: PaymentProcessingOverlayProps) {
  if (!isOpen) return null;

  const steps = [
    { num: 1, label: 'Processing payment' },
    { num: 2, label: 'Verifying with our servers' },
    { num: 3, label: 'Updating your plan' },
  ];

  const isProcessing = step === 1 || step === 2 || step === 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-sm w-full space-y-6 p-8">
        {step === 'success' && (
          <>
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-xl font-bold text-foreground">Payment Successful!</h2>
                <p className="text-sm text-muted-foreground">
                  Your plan has been updated to <span className="font-semibold capitalize">{plan}</span>
                </p>
              </div>
            </div>

            <Button onClick={onClose} className="w-full">
              Continue to Dashboard
            </Button>
          </>
        )}

        {step === 'error' && (
          <>
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-xl font-bold text-foreground">Payment Failed</h2>
                <p className="text-sm text-muted-foreground">
                  {error || 'Something went wrong. Please try again.'}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button onClick={onRetry} className="flex-1">
                Try Again
              </Button>
            </div>
          </>
        )}

        {isProcessing && (
          <>
            <div className="flex items-center justify-center">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-4 border-muted opacity-25" />
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
              </div>
            </div>

            <div className="space-y-3">
              {steps.map((s) => {
                const isActive = s.num === step;
                const isDone = typeof step === 'number' && s.num < step;

                return (
                  <div key={s.num} className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                        isDone
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                          : isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {isDone ? <CheckCircle className="w-5 h-5" /> : s.num}
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        isDone || isActive ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {s.label}
                    </span>
                    {isActive && <Loader2 className="w-4 h-4 ml-auto animate-spin text-primary" />}
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Please don't close this window
            </p>
          </>
        )}
      </div>
    </div>
  );
}
