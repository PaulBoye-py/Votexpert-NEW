import * as React from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { rootRoute } from '../__root';
import { AuthLayout } from '@/components/templates';
import { LoginForm } from '@/components/organisms';
import { voterLoginInitiate } from '@/api/services/voter.service';
import type { VoterLoginCredentials } from '@/types';

export const voterLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/voter/login',
  component: VoterLoginPage,
});

function VoterLoginPage() {
  const navigate = useNavigate();
  const [error, setError] = React.useState<string | undefined>();

  const loginMutation = useMutation({
    mutationFn: voterLoginInitiate,
    onSuccess: (data) => {
      if (data.success) {
        // OTP was sent to email, redirect to OTP page with voter info
        navigate({
          to: '/voter/otp',
          search: {
            voter_id: data.voter_id,
            election_id: data.election_id
          }
        });
      } else {
        setError(data.message || 'Login failed. Please try again.');
      }
    },
    onError: (err: Error) => {
      setError(err.message || 'An error occurred. Please try again.');
    },
  });

  const handleSubmit = (data: Record<string, string>) => {
    setError(undefined);
    const credentials: VoterLoginCredentials = {
      voter_id: data.voter_id,
      email: data.email,
    };
    loginMutation.mutate(credentials);
  };

  return (
    <AuthLayout
      title="Voter Portal"
      subtitle="Enter your credentials to access your ballot"
    >
      <LoginForm
        variant="voter"
        onSubmit={handleSubmit}
        isLoading={loginMutation.isPending}
        error={error}
      />
    </AuthLayout>
  );
}
