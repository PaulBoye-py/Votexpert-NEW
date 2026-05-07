// src/routes/admin/payment-success.tsx

import * as React from 'react';
import { createRoute, useNavigate, useSearch } from '@tanstack/react-router';
import { rootRoute } from '../__root';
import { AdminLayout } from '@/components/templates';
import { Button } from '@/components/atoms';
import { $user, $isAuthenticated, $isAdmin, logout } from '@/stores/auth.store';
import { useStore } from '@nanostores/react';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { verifyPayment } from '@/api/services/payment.service';
import type { Admin } from '@/types';

// ─── Route Definition ─────────────────────────────────────────────────────────

export const adminPaymentSuccessRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/payment-success',
  component: AdminPaymentSuccessPage,
  validateSearch: (search: Record<string, unknown>) => ({
    reference: (search.reference as string) ?? '',
    trxref: (search.trxref as string) ?? '',
  }),
});

// ─── Payment Success Page ─────────────────────────────────────────────────────

type VerifyStatus = 'verifying' | 'success' | 'failed';

function AdminPaymentSuccessPage() {
  const navigate = useNavigate();
  const user = useStore($user) as Admin | null;
  const isAuthenticated = useStore($isAuthenticated);
  const isAdmin = useStore($isAdmin);

  // Paystack sends back `reference` and `trxref` as query params
  const { reference, trxref } = useSearch({ from: adminPaymentSuccessRoute.id });
  const paymentReference = reference || trxref;

  const [status, setStatus] = React.useState<VerifyStatus>('verifying');
  const [planName, setPlanName] = React.useState<string>('');
  const [errorMessage, setErrorMessage] = React.useState<string>('');

  // ─── Auth Guard ───────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!isAuthenticated || !isAdmin) {
      navigate({ to: '/admin/login' });
    }
  }, [isAuthenticated, isAdmin, navigate]);

  // ─── Verify Payment on Mount ──────────────────────────────────────────────
  React.useEffect(() => {
    if (!paymentReference) {
      setStatus('failed');
      setErrorMessage('No payment reference found. Please contact support.');
      return;
    }

    const verify = async () => {
      try {
        const result = await verifyPayment(paymentReference);

        if (result.success) {
          setPlanName(result.plan);
          setStatus('success');
        } else {
          setStatus('failed');
          setErrorMessage('Payment could not be verified. Please contact support.');
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Verification failed. Please contact support.';
        setErrorMessage(message);
        setStatus('failed');
      }
    };

    verify();
  }, [paymentReference]);

  if (!isAuthenticated || !isAdmin) return null;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <AdminLayout
      adminName={user?.name || 'Admin'}
      adminEmail={user?.email}
      orgName={user?.org_name}
      currentPath="/admin/pricing"
      onNavigate={(path) => navigate({ to: path })}
      onLogout={() => {
        logout();
        navigate({ to: '/admin/login' });
      }}
    >
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-card border border-border rounded-xl p-10 max-w-md w-full text-center space-y-6">

          {/* ── Verifying ── */}
          {status === 'verifying' && (
            <>
              <Loader2 className="w-14 h-14 text-primary animate-spin mx-auto" />
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-foreground">Verifying Payment</h1>
                <p className="text-muted-foreground text-sm">
                  Please wait while we confirm your payment...
                </p>
              </div>
            </>
          )}

          {/* ── Success ── */}
          {status === 'success' && (
            <>
              <CheckCircle className="w-14 h-14 text-green-500 mx-auto" />
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-foreground">Payment Successful!</h1>
                <p className="text-muted-foreground text-sm">
                  Your <span className="font-semibold text-foreground">{planName}</span> is
                  now active. You can now create elections with your new plan limits.
                </p>
              </div>
              {paymentReference && (
                <p className="text-xs text-muted-foreground bg-muted/40 rounded px-3 py-2">
                  Reference: <span className="font-mono">{paymentReference}</span>
                </p>
              )}
              <Button
                className="w-full"
                onClick={() => navigate({ to: '/admin/dashboard' })}
              >
                Go to Dashboard
              </Button>
            </>
          )}

          {/* ── Failed ── */}
          {status === 'failed' && (
            <>
              <XCircle className="w-14 h-14 text-destructive mx-auto" />
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-foreground">Payment Failed</h1>
                <p className="text-muted-foreground text-sm">{errorMessage}</p>
              </div>
              <div className="flex flex-col gap-3">
                <Button
                  className="w-full"
                  onClick={() => navigate({ to: '/admin/pricing' })}
                >
                  Try Again
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate({ to: '/admin/dashboard' })}
                >
                  Back to Dashboard
                </Button>
              </div>
            </>
          )}

        </div>
      </div>
    </AdminLayout>
  );
}