import * as React from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { rootRoute } from '../__root';
import { AuthLayout } from '@/components/templates';
import { FaceCapture } from '@/components/organisms';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms';
import { logout, setTokens, setUser } from '@/stores/auth.store';
import { AlertTriangle } from 'lucide-react';

export const voterFaceVerificationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/voter/face-verification',
  component: FaceVerificationPage,
});

function FaceVerificationPage() {
  const navigate = useNavigate();
  const [error, setError] = React.useState<string | undefined>();
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [pendingVoter, setPendingVoter] = React.useState<{
    voter_id: string;
    name: string;
    email: string;
    election_id: string;
    has_voted: boolean;
  } | null>(null);

  // Load pending voter from localStorage
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem('votexpert_pending_voter');
      if (stored) {
        setPendingVoter(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load pending voter:', e);
    }
  }, []);

  const handleCapture = async (_imageBase64: string) => {
    if (!pendingVoter) {
      setError('Session expired. Please start over.');
      return;
    }

    setError(undefined);
    setIsVerifying(true);

    try {
      // For now, complete the login after face capture
      // In production, this would call a face verification API
      const tempToken = localStorage.getItem('votexpert_temp_token');

      // Clear any existing auth (e.g., admin tokens) before setting voter auth
      logout();

      // Set up auth with stored data
      setTokens({
        accessToken: tempToken || 'verified-session',
        refreshToken: tempToken || 'verified-session',
      });

      setUser({
        voter_id: pendingVoter.voter_id,
        name: pendingVoter.name,
        email: pendingVoter.email,
        has_voted: pendingVoter.has_voted,
        voted_at: null,
      }, 'voter');

      // Clean up temporary storage
      localStorage.removeItem('votexpert_pending_voter');
      localStorage.removeItem('votexpert_temp_token');

      // Navigate to elections
      navigate({ to: '/voter/elections' });
    } catch (err) {
      setError('Face verification failed. Please try again.');
      setIsVerifying(false);
    }
  };

  // No pending voter - invalid state
  if (!pendingVoter) {
    return (
      <AuthLayout
        title="Session Expired"
        subtitle="Please start the login process again"
      >
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle className="text-xl">Session Expired</CardTitle>
            <CardDescription>
              Your verification session has expired.
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
      title="Face Verification"
      subtitle="Complete your identity verification"
    >
      <FaceCapture
        onCapture={handleCapture}
        isVerifying={isVerifying}
        error={error}
      />
    </AuthLayout>
  );
}
