/**
 * /vote/:electionId/lobby — Waiting room before election starts.
 *
 * Polls GET /public/elections/:id/lobby every 3s.
 * When election status becomes ACTIVE:
 *   - Open elections:  create vote session → navigate to ballot
 *   - Closed elections: navigate to ballot directly (invite_token already stored)
 */
import * as React from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { rootRoute } from '../../__root';
import { AlertMessage } from '@/components/molecules';
import { Card, CardContent } from '@/components/atoms';
import { getLobbyState, startVoteSession } from '@/api/services/voter.service';
import { $voterSession, setVoterSession } from '@/stores/auth.store';
import { useStore } from '@nanostores/react';
import { Loader2, Vote, Users, CheckCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LobbyParticipant } from '@/types';
import { VOTER_SESSION_KEY } from '@/lib/constants';

export const voteLobbyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/vote/$electionId/lobby',
  component: LobbyPage,
});

function LobbyPage() {
  const navigate = useNavigate();
  const { electionId } = voteLobbyRoute.useParams();
  const session = useStore($voterSession);
  const [starting, setStarting] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();

  // Redirect if no session
  React.useEffect(() => {
    if (!session || session.election_id !== electionId) {
      navigate({ to: '/vote/join', search: { election: electionId } });
    }
  }, [session, electionId, navigate]);

  // Poll lobby state every 3s
  const { data, isLoading } = useQuery({
    queryKey: ['lobby', electionId],
    queryFn: () => getLobbyState(electionId),
    enabled: !!session && !starting,
    refetchInterval: 3000,
  });

  // Session creation mutation (open elections when ACTIVE)
  const sessionMutation = useMutation({
    mutationFn: async () => {
      const existing = (() => {
        try {
          const s = localStorage.getItem(VOTER_SESSION_KEY);
          return s ? JSON.parse(s) : null;
        } catch { return null; }
      })();
      const existingToken = existing?.election_id === electionId ? existing.session_token : undefined;
      return startVoteSession(electionId, existingToken);
    },
    onSuccess: (sessionData) => {
      setVoterSession({
        ...session!,
        session_token: sessionData.session_token,
      });
      navigate({ to: '/vote/$electionId/ballot', params: { electionId } });
    },
    onError: (err: Error) => {
      setStarting(false);
      setError(err.message);
    },
  });

  // Is this a scheduled election? Detect by absence of participant_id in session
  // (scheduled elections skip joinLobby so never get a participant_id)
  const isScheduled = !session?.participant_id && !session?.invite_token;

  // Detect when election goes ACTIVE → auto-transition to ballot
  React.useEffect(() => {
    if (!data || starting) return;
    if (data.election_status === 'ACTIVE') {
      setStarting(true);
      if (session?.invite_token) {
        // Closed election — already have auth token
        navigate({ to: '/vote/$electionId/ballot', params: { electionId } });
      } else {
        // Open election (immediate or scheduled) — create vote session now
        sessionMutation.mutate();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.election_status]);

  if (!session) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (data?.election_status === 'CLOSED' || data?.election_status === 'RESULTS_PUBLISHED') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-10 text-center space-y-3">
            <p className="text-xl font-bold">Election has ended</p>
            <p className="text-sm text-muted-foreground">Voting is no longer available.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Starting transition screen
  if (starting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto animate-pulse">
            <Vote className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-xl font-bold text-green-600 dark:text-green-400">Election is starting!</p>
          <p className="text-sm text-muted-foreground">Taking you to the ballot…</p>
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
        </div>
      </div>
    );
  }

  const participants: LobbyParticipant[] = data?.participants ?? [];
  const myParticipantId = session.participant_id;
  const electionTitle = data?.election_title ?? 'Election';

  // Scheduled election waiting screen — no participant list, show start/end times
  if (isScheduled) {
    const schedStart = data?.scheduled_start_at;
    const schedEnd = data?.scheduled_end_at;
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="border-b border-border bg-card">
          <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-2">
            <Vote className="h-5 w-5 text-green-600 dark:text-green-400" />
            <span className="font-semibold text-sm truncate">{electionTitle}</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
          <div className="w-full max-w-md space-y-6 text-center">
            <div className="relative mx-auto w-24 h-24">
              <div className="absolute inset-0 rounded-full bg-blue-500/10 animate-ping" />
              <div className="relative w-24 h-24 rounded-full bg-blue-500/15 border-2 border-blue-500/30 flex items-center justify-center">
                <Clock className="h-10 w-10 text-blue-600 dark:text-blue-400" />
              </div>
            </div>

            <div>
              <h1 className="text-2xl font-bold">Voting hasn't started yet</h1>
              <p className="text-muted-foreground text-sm mt-1">
                This page will refresh automatically when voting opens.
              </p>
            </div>

            {(schedStart || schedEnd) && (
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 px-5 py-4 text-left space-y-2.5">
                <p className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wide flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Voting window
                </p>
                {schedStart && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Opens</span>
                    <span className="font-semibold">{new Date(schedStart).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </div>
                )}
                {schedEnd && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Closes</span>
                    <span className="font-semibold">{new Date(schedEnd).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-500/60 animate-bounce [animation-delay:0ms]" />
              <div className="w-2 h-2 rounded-full bg-blue-500/60 animate-bounce [animation-delay:150ms]" />
              <div className="w-2 h-2 rounded-full bg-blue-500/60 animate-bounce [animation-delay:300ms]" />
            </div>

            {error && <AlertMessage variant="error">{error}</AlertMessage>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Vote className="h-5 w-5 text-green-600 dark:text-green-400" />
            <span className="font-semibold text-sm truncate">{electionTitle}</span>
          </div>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
            Lobby
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-6">
          {/* Waiting indicator */}
          <div className="text-center space-y-4">
            <div className="relative mx-auto w-24 h-24">
              {/* Outer pulsing ring */}
              <div className="absolute inset-0 rounded-full bg-green-500/10 animate-ping" />
              <div className="absolute inset-2 rounded-full bg-green-500/20 animate-ping [animation-delay:0.3s]" />
              <div className="relative w-24 h-24 rounded-full bg-green-500/15 border-2 border-green-500/30 flex items-center justify-center">
                <Users className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
            </div>

            <div>
              <h1 className="text-2xl font-bold">Waiting for host</h1>
              <p className="text-muted-foreground text-sm mt-1">
                The election will start soon. You'll be redirected automatically.
              </p>
            </div>

            {/* Animated dots */}
            <div className="flex justify-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500/60 animate-bounce [animation-delay:0ms]" />
              <div className="w-2 h-2 rounded-full bg-green-500/60 animate-bounce [animation-delay:150ms]" />
              <div className="w-2 h-2 rounded-full bg-green-500/60 animate-bounce [animation-delay:300ms]" />
            </div>
          </div>

          {error && <AlertMessage variant="error">{error}</AlertMessage>}

          {/* My identity card */}
          {myParticipantId && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3 flex items-center gap-3">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">You joined as</p>
                <p className="text-sm font-semibold truncate">
                  {session.display_name ?? 'Anonymous'}
                </p>
              </div>
            </div>
          )}

          {/* Participant list */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                In the lobby
              </h2>
              <span className="text-sm font-medium">
                {participants.length} {participants.length === 1 ? 'person' : 'people'}
              </span>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {participants.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No one else here yet…
                </p>
              ) : (
                participants.map((p, idx) => {
                  const isMe = p.participant_id === myParticipantId;
                  const initials = p.display_name.charAt(0).toUpperCase();
                  const colors = [
                    'bg-blue-500/20 text-blue-700 dark:text-blue-300',
                    'bg-purple-500/20 text-purple-700 dark:text-purple-300',
                    'bg-orange-500/20 text-orange-700 dark:text-orange-300',
                    'bg-pink-500/20 text-pink-700 dark:text-pink-300',
                    'bg-teal-500/20 text-teal-700 dark:text-teal-300',
                  ];
                  const color = isMe
                    ? 'bg-green-500/20 text-green-700 dark:text-green-300'
                    : colors[idx % colors.length];

                  return (
                    <div
                      key={p.participant_id}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 border',
                        isMe
                          ? 'border-green-500/30 bg-green-500/5'
                          : 'border-border bg-card'
                      )}
                    >
                      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0', color)}>
                        {initials}
                      </div>
                      <span className={cn('text-sm flex-1 truncate', isMe && 'font-semibold')}>
                        {p.display_name}
                      </span>
                      {isMe && (
                        <span className="text-xs text-green-600 dark:text-green-400 shrink-0">You</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
