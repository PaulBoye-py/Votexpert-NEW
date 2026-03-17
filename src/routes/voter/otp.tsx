import * as React from 'react';
import { createRoute, useNavigate, useSearch } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { rootRoute } from '../__root';
import { AuthLayout } from '@/components/templates';
import { OtpVerificationForm } from '@/components/organisms';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms';
import { voterVerifyOtp } from '@/api/services/voter.service';
import type { VoterOtpPayload } from '@/types';

interface OtpSearchParams {
  voter_id?: string;
  election_id?: string;
}

export const voterOtpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/voter/otp',
  component: VoterOtpPage,
  validateSearch: (search: Record<string, unknown>): OtpSearchParams => ({
    voter_id: search.voter_id as string | undefined,
    election_id: search.election_id as string | undefined,
  }),
});

function VoterOtpPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: '/voter/otp' });
  const [error, setError] = React.useState<string | undefined>();

  const voterId = search.voter_id;
  const electionId = search.election_id;

  const verifyMutation = useMutation({
    mutationFn: voterVerifyOtp,
    onSuccess: (data) => {
      if (data.success && data.voter) {
        // Save voter and election data for face verification
        localStorage.setItem('votexpert_pending_voter', JSON.stringify(data.voter));
        if (data.election) {
          localStorage.setItem('votexpert_election', JSON.stringify(data.election));
        }
        if (data.access_token) {
          localStorage.setItem('votexpert_temp_token', data.access_token);
        }
        // Always go to face verification after OTP
        navigate({ to: '/voter/face-verification' });
      } else {
        setError(data.message || 'OTP verification failed. Please try again.');
      }
    },
    onError: (err: Error) => {
      setError(err.message || 'An error occurred. Please try again.');
    },
  });

  const handleSubmit = (otp: string) => {
    if (!voterId || !electionId) {
      setError('Session expired. Please start over from login.');
      return;
    }

    setError(undefined);
    const payload: VoterOtpPayload = {
      voter_id: voterId,
      election_id: electionId,
      otp,
    };
    verifyMutation.mutate(payload);
  };

  const handleResend = () => {
    // Redirect back to login to resend OTP
    navigate({ to: '/voter/login' });
  };

  // No voter_id or election_id - invalid state
  if (!voterId || !electionId) {
    return (
      <AuthLayout
        title="Session Expired"
        subtitle="Please start the login process again"
      >
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Invalid Session</CardTitle>
            <CardDescription>
              Your verification session has expired or is invalid.
              Please start over from the login page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <button
              onClick={() => navigate({ to: '/voter/login' })}
              className="w-full bg-primary text-primary-foreground py-2 px-4 rounded-md hover:bg-primary/90 transition-colors"
            >
              Go to Login
            </button>
          </CardContent>
        </Card>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Verify Your Identity"
      subtitle="Enter the OTP code sent to your email"
    >
      <OtpVerificationForm
        onSubmit={handleSubmit}
        onResend={handleResend}
        isLoading={verifyMutation.isPending}
        error={error}
      />
    </AuthLayout>
  );
}
