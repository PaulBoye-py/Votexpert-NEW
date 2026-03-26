/**
 * /vote/:electionId/waiting — Pre-vote waiting room for scheduled elections.
 *
 * Shows a live countdown to the opening time and the full voting window.
 * Polls every 15 s. Auto-transitions to ballot when the election goes ACTIVE.
 */
import * as React from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { rootRoute } from '../../__root';
import { getLobbyState, startVoteSession } from '@/api/services/voter.service';
import { $voterSession, setVoterSession } from '@/stores/auth.store';
import { useStore } from '@nanostores/react';
import { Vote, Calendar, Loader2 } from 'lucide-react';
import { VOTER_SESSION_KEY } from '@/lib/constants';

export const voteWaitingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/vote/$electionId/waiting',
  component: WaitingPage,
});

// ─── Live countdown hook ────────────────────────────────────────────────────
function useCountdown(targetISO: string | null | undefined) {
  const getMs = () => (targetISO ? Math.max(0, new Date(targetISO).getTime() - Date.now()) : 0);
  const [ms, setMs] = React.useState(getMs);

  React.useEffect(() => {
    if (!targetISO) return;
    setMs(getMs());
    const id = setInterval(() => setMs(getMs()), 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetISO]);

  const totalSec = Math.floor(ms / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    hours:   pad(Math.floor(totalSec / 3600)),
    minutes: pad(Math.floor((totalSec % 3600) / 60)),
    seconds: pad(totalSec % 60),
    done: ms === 0,
  };
}

function WaitingPage() {
  const navigate = useNavigate();
  const { electionId } = voteWaitingRoute.useParams();
  const session = useStore($voterSession);
  const [transitioning, setTransitioning] = React.useState(false);

  React.useEffect(() => {
    if (!session || session.election_id !== electionId) {
      navigate({ to: '/vote/join', search: { election: electionId } });
    }
  }, [session, electionId, navigate]);

  const { data } = useQuery({
    queryKey: ['waiting', electionId],
    queryFn: () => getLobbyState(electionId),
    enabled: !!session && !transitioning,
    refetchInterval: 15000,
  });

  const { hours, minutes, seconds, done } = useCountdown(data?.scheduled_start_at);

  // Forward to ballot when election opens
  React.useEffect(() => {
    if (!data || transitioning) return;

    if (data.election_status === 'RESULTS_PUBLISHED') {
      navigate({ to: '/results/$electionId', params: { electionId } });
      return;
    }

    if (data.election_status === 'ACTIVE') {
      setTransitioning(true);
      const existing = (() => {
        try { const s = localStorage.getItem(VOTER_SESSION_KEY); return s ? JSON.parse(s) : null; }
        catch { return null; }
      })();
      const existingToken = existing?.election_id === electionId ? existing.session_token : undefined;
      startVoteSession(electionId, existingToken)
        .then((sd) => {
          setVoterSession({ ...session!, session_token: sd.session_token, votes_cast: sd.votes_cast ?? {} });
          navigate({ to: '/vote/$electionId/ballot', params: { electionId } });
        })
        .catch(() => navigate({ to: '/vote/$electionId/ballot', params: { electionId } }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.election_status]);

  if (!session) return null;

  const title     = data?.election_title ?? 'Election';
  const schedStart = data?.scheduled_start_at;
  const schedEnd   = data?.scheduled_end_at;

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-2">
          <Vote className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
          <span className="font-semibold text-sm truncate">{title}</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-8 text-center">

          {transitioning ? (
            /* Transition screen */
            <div className="space-y-4">
              <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto animate-pulse">
                <Vote className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">Voting is open!</p>
              <p className="text-sm text-muted-foreground">Taking you to the ballot…</p>
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
            </div>
          ) : (
            <>
              {/* Countdown display */}
              <div>
                <p className="text-sm text-muted-foreground mb-5 uppercase tracking-wide">
                  {done ? 'Starting soon…' : 'Voting opens in'}
                </p>
                <div className="flex items-start justify-center gap-3">
                  {[
                    { v: hours,   label: 'hrs'  },
                    { v: minutes, label: 'min'  },
                    { v: seconds, label: 'sec'  },
                  ].map(({ v, label }, i) => (
                    <React.Fragment key={label}>
                      {i > 0 && (
                        <span className="text-3xl font-bold text-muted-foreground/40 mt-1">:</span>
                      )}
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-16 h-16 rounded-xl bg-blue-500/10 border-2 border-blue-500/20 flex items-center justify-center">
                          <span className="text-2xl font-bold font-mono tabular-nums text-blue-700 dark:text-blue-300">
                            {v}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">{label}</span>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Voting window card */}
              {(schedStart || schedEnd) && (
                <div className="rounded-xl bg-muted/40 border border-border px-5 py-4 text-left space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> Voting window
                  </p>
                  {schedStart && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Opens</span>
                      <span className="font-semibold">{fmt(schedStart)}</span>
                    </div>
                  )}
                  {schedEnd && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Closes</span>
                      <span className="font-semibold">{fmt(schedEnd)}</span>
                    </div>
                  )}
                </div>
              )}

              <p className="text-xs text-muted-foreground leading-relaxed">
                You'll be automatically forwarded when voting opens.<br />
                You can also close this page and come back later.
              </p>

              {/* Pulsing dots */}
              <div className="flex justify-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-500/60 animate-bounce [animation-delay:0ms]" />
                <div className="w-2 h-2 rounded-full bg-blue-500/60 animate-bounce [animation-delay:150ms]" />
                <div className="w-2 h-2 rounded-full bg-blue-500/60 animate-bounce [animation-delay:300ms]" />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
