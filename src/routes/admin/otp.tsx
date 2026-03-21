import * as React from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { rootRoute } from '../__root';
import { AuthLayout } from '@/components/templates';
import { OtpVerificationForm } from '@/components/organisms';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms';
import { cognitoConfirmSignUp, cognitoResendCode } from '@/api/services/cognito.service';
import { $pendingEmail, setPendingEmail } from '@/stores/auth.store';
import { useStore } from '@nanostores/react';
import { AlertTriangle } from 'lucide-react';

export const adminOtpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/otp',
  component: AdminOtpPage,
});

function AdminOtpPage() {
  const navigate = useNavigate();
  const email = useStore($pendingEmail);
  const [error, setError] = React.useState<string | undefined>();

  const confirmMutation = useMutation({
    mutationFn: (code: string) => cognitoConfirmSignUp(email!, code),
    onSuccess: () => {
      setPendingEmail(null);
      navigate({ to: '/admin/login' });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const resendMutation = useMutation({
    mutationFn: () => cognitoResendCode(email!),
    onSuccess: () => setError(undefined),
    onError: (err: Error) => setError(err.message),
  });

  if (!email) {
    return (
      <AuthLayout title="Session Expired" subtitle="Please start the process again">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle className="text-xl">Session Expired</CardTitle>
            <CardDescription>Please go back and sign up again.</CardDescription>
          </CardHeader>
          <CardContent>
            <button
              onClick={() => navigate({ to: '/admin/signup' })}
              type="button"
              className="w-full bg-primary text-primary-foreground py-2 px-4 rounded-md hover:bg-primary/90 transition-colors"
            >
              Back to Sign Up
            </button>
          </CardContent>
        </Card>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Verify Your Email"
      subtitle={`Enter the 6-digit code sent to ${email}`}
    >
      <OtpVerificationForm
        onSubmit={(code) => {
          setError(undefined);
          confirmMutation.mutate(code);
        }}
        onResend={() => resendMutation.mutate()}
        isLoading={confirmMutation.isPending || resendMutation.isPending}
        error={error}
      />
    </AuthLayout>
  );
}
