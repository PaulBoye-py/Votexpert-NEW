/**
 * /vote/:electionId — Entry point for invite links from closed elections.
 *
 * If a ?token= param is present (invite link): verify the token, store the
 * voter session, then route to the appropriate screen.
 *
 * If no token (QR code / direct link): redirect to /vote/join.
 */
import * as React from 'react';
import { createRoute, useNavigate, useSearch, redirect } from '@tanstack/react-router';
import { rootRoute } from '../../__root';
import { AlertMessage } from '@/components/molecules';
import { Button } from '@/components/atoms';
import { verifyInviteToken, joinLobby } from '@/api/services/voter.service';
import { setVoterSession } from '@/stores/auth.store';
import { Loader2 } from 'lucide-react';

interface InviteSearch {
  token?: string;
}

export const voteElectionRedirectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/vote/$electionId',
  validateSearch: (s: Record<string, unknown>): InviteSearch => ({
    token: s.token as string | undefined,
  }),
  beforeLoad: ({ params, search }) => {
    // No token → this is a QR/direct link, send to the code-entry join page
    if (!search.token) {
      throw redirect({ to: '/vote/join', search: { election: params.electionId } });
    }
  },
  component: InviteTokenHandler,
});

function InviteTokenHandler() {
  const navigate = useNavigate();
  const { electionId } = voteElectionRedirectRoute.useParams();
  const { token } = useSearch({ from: '/vote/$electionId' });
  const [error, setError] = React.useState<string | undefined>();

  React.useEffect(() => {
    if (!token) return;

    verifyInviteToken(token)
      .then(async (data) => {
        const status = data.election.status;

        if (status === 'RESULTS_PUBLISHED') {
          navigate({ to: '/results/$electionId', params: { electionId } });
          return;
        }
        if (status === 'CLOSED') {
          setError('This election has ended and results are not yet published.');
          return;
        }

        if (status === 'ACTIVE') {
          // Already live — store session and go straight to ballot
          setVoterSession({
            session_token: '',
            invite_token: token,
            election_id: electionId,
          });
          navigate({ to: '/vote/$electionId/ballot', params: { electionId } });
          return;
        }

        // DRAFT or SCHEDULED — join lobby first so the presenter can see us
        const lobby = await joinLobby(electionId);
        setVoterSession({
          session_token: '',
          invite_token: token,
          election_id: electionId,
          participant_id: lobby.participant_id,
          display_name: lobby.display_name,
        });
        navigate({ to: '/vote/$electionId/lobby', params: { electionId } });
      })
      .catch((err: Error) => setError(err.message));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <AlertMessage variant="error">{error}</AlertMessage>
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/vote/join' })}>
            Join a different election
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">Verifying your invite…</p>
      </div>
    </div>
  );
}
