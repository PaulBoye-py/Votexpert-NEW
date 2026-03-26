/**
 * /vote/:electionId/ballot — Sequential position voting booth.
 * Works for both OPEN (session_token) and CLOSED (invite_token) elections.
 * Polls GET /public/elections/:id every 5s to track active_position.
 */
import * as React from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rootRoute } from '../../__root';
import { AlertMessage } from '@/components/molecules';
import { Button, Card, CardContent, Badge, CircularCountdown } from '@/components/atoms';
import { getPublicElection, castVote } from '@/api/services/voter.service';
import type { PublicElectionResponse } from '@/types';
import { $voterSession } from '@/stores/auth.store';
import { useStore } from '@nanostores/react';
import { CheckCircle, ChevronRight, Clock, Loader2, Trophy, Vote } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Candidate, PublicPosition } from '@/types';

export const voteBallotRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/vote/$electionId/ballot',
  component: BallotPage,
});

function BallotPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { electionId } = voteBallotRoute.useParams();
  const session = useStore($voterSession);

  const [selectedCandidate, setSelectedCandidate] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | undefined>();
  const [positionErrors, setPositionErrors] = React.useState<Record<string, string>>({});
  const [votedPositions, setVotedPositions] = React.useState<Set<string>>(new Set());
  // Scheduled: track selected candidate per position before confirming
  const [selectedCandidates, setSelectedCandidates] = React.useState<Record<string, string>>({});
  // Scheduled: track which candidate was actually voted for (for collapsed display)
  const [votedCandidates, setVotedCandidates] = React.useState<Record<string, string>>({});

  // Redirect if no session
  React.useEffect(() => {
    if (!session || session.election_id !== electionId) {
      navigate({ to: '/vote/join', search: { election: electionId } });
    }
  }, [session, electionId, navigate]);

  // Poll election state every 5s to track active position
  const { data, isLoading } = useQuery({
    queryKey: ['vote', 'election', electionId],
    queryFn: () => getPublicElection(electionId),
    enabled: !!session,
    refetchInterval: 3000,
  });

  const activePosition = data?.active_position;
  const election = data?.election;
  const isScheduled = !!(election?.scheduled_start_at || election?.scheduled_end_at);

  // Smooth local countdown seeded from server value on each poll
  const [countdown, setCountdown] = React.useState(0);
  React.useEffect(() => {
    if (activePosition?.seconds_remaining !== undefined) {
      setCountdown(activePosition.seconds_remaining);
    }
  }, [activePosition?.seconds_remaining]);
  React.useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => setCountdown((s) => Math.max(0, +(s - 0.1).toFixed(1))), 100);
    return () => clearInterval(id);
  }, [countdown]);

  // Mark positions already voted (from session votes_cast)
  React.useEffect(() => {
    if (session && 'votes_cast' in (session as object)) {
      // votes_cast may be populated from verify-token response
    }
  }, [session]);

  const voteMutation = useMutation({
    mutationFn: () => {
      if (!activePosition || !selectedCandidate) throw new Error('No selection');
      return castVote({
        election_id: electionId,
        position_id: activePosition.position.position_id,
        candidate_id: selectedCandidate,
        ...(session?.invite_token
          ? { invite_token: session.invite_token }
          : { session_token: session?.session_token }),
      });
    },
    onSuccess: (voteResult) => {
      setVotedPositions((prev) => new Set([...prev, voteResult.position_id]));
      setSelectedCandidate(null);
      setError(undefined);
      // Immediately write the server-confirmed vote count into the cache so the
      // leaderboard shows the correct number before the next background refetch
      queryClient.setQueryData(
        ['vote', 'election', electionId],
        (old: PublicElectionResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            positions: old.positions.map((pos) => {
              if (pos.position_id !== voteResult.position_id) return pos;
              return {
                ...pos,
                candidates: pos.candidates.map((c) =>
                  c.candidate_id === voteResult.candidate_id
                    ? { ...c, vote_count: voteResult.vote_count }
                    : c
                ),
              };
            }),
          };
        }
      );
      // Background refetch to pick up other voters' counts too
      queryClient.invalidateQueries({ queryKey: ['vote', 'election', electionId] });
    },
    onError: (err: Error) => {
      // If the backend says we already voted (e.g. after page reload), treat it as a successful vote
      if (err.message.toLowerCase().includes('already voted') && activePosition) {
        setVotedPositions((prev) => new Set([...prev, activePosition.position.position_id]));
        setError(undefined);
        queryClient.invalidateQueries({ queryKey: ['vote', 'election', electionId] });
      } else {
        setError(err.message);
      }
    },
  });

  // Mutation for scheduled elections (position + candidate passed directly)
  const scheduledVoteMutation = useMutation({
    mutationFn: ({ positionId, candidateId }: { positionId: string; candidateId: string }) =>
      castVote({
        election_id: electionId,
        position_id: positionId,
        candidate_id: candidateId,
        ...(session?.invite_token
          ? { invite_token: session.invite_token }
          : { session_token: session?.session_token }),
      }),
    onSuccess: (voteResult, vars) => {
      setVotedPositions((prev) => new Set([...prev, voteResult.position_id]));
      setVotedCandidates((prev) => ({ ...prev, [vars.positionId]: vars.candidateId }));
      setPositionErrors((prev) => { const n = { ...prev }; delete n[voteResult.position_id]; return n; });
      queryClient.setQueryData(
        ['vote', 'election', electionId],
        (old: PublicElectionResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            positions: old.positions.map((pos) => {
              if (pos.position_id !== voteResult.position_id) return pos;
              return {
                ...pos,
                candidates: pos.candidates.map((c) =>
                  c.candidate_id === voteResult.candidate_id
                    ? { ...c, vote_count: voteResult.vote_count }
                    : c
                ),
              };
            }),
          };
        }
      );
      queryClient.invalidateQueries({ queryKey: ['vote', 'election', electionId] });
    },
    onError: (err: Error, vars) => {
      if (err.message.toLowerCase().includes('already voted')) {
        setVotedPositions((prev) => new Set([...prev, vars.positionId]));
        queryClient.invalidateQueries({ queryKey: ['vote', 'election', electionId] });
      } else {
        setPositionErrors((prev) => ({ ...prev, [vars.positionId]: err.message }));
      }
    },
  });

  if (!session) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!election) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <AlertMessage variant="error">Election not found.</AlertMessage>
      </div>
    );
  }

  // Auto-redirect to results when published
  if (election.status === 'RESULTS_PUBLISHED') {
    navigate({ to: '/results/$electionId', params: { electionId } });
    return null;
  }

  // Election ended but results not yet published
  if (election.status !== 'ACTIVE') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-10 text-center space-y-4">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold">Voting has ended</h2>
            <p className="text-sm text-muted-foreground">Results will be available shortly.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Scheduled election ballot ────────────────────────────────────────────────
  if (isScheduled) {
    const allPositions = data?.positions ?? [];
    const votedCount = allPositions.filter(p => votedPositions.has(p.position_id)).length;
    const allVoted = allPositions.length > 0 && votedCount === allPositions.length;
    const endTime = election.scheduled_end_at
      ? new Date(election.scheduled_end_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
      : null;
    const progressPct = allPositions.length > 0 ? Math.round((votedCount / allPositions.length) * 100) : 0;

    // All done screen
    if (allVoted) {
      return (
        <div className="min-h-screen bg-background flex flex-col">
          <div className="border-b border-border bg-card">
            <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
              <Vote className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
              <span className="font-semibold text-sm truncate">{election.title}</span>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center space-y-4 max-w-sm">
              <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
              <h1 className="text-2xl font-bold">All votes submitted!</h1>
              <p className="text-sm text-muted-foreground">
                Your votes have been recorded. Thank you for participating.
              </p>
              {endTime && (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-4 py-2">
                  Results available after voting closes · {endTime}
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background pb-8">
        {/* Sticky header with progress */}
        <div className="border-b border-border bg-card sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Vote className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                <span className="font-semibold text-sm truncate">{election.title}</span>
              </div>
              {endTime && (
                <span className="text-xs text-muted-foreground shrink-0">Closes {endTime}</span>
              )}
            </div>
            {/* Progress bar */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                {/* eslint-disable-next-line react/forbid-component-props */}
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-500 w-(--prog)"
                  style={{ '--prog': `${progressPct}%` } as React.CSSProperties}
                />
              </div>
              <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                {votedCount}/{allPositions.length}
              </span>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 pt-6 space-y-4">
          {allPositions.map((pos) => {
            const hasVoted   = votedPositions.has(pos.position_id);
            const selected   = selectedCandidates[pos.position_id];
            const posErr     = positionErrors[pos.position_id];
            const isPending  = scheduledVoteMutation.isPending &&
                               scheduledVoteMutation.variables?.positionId === pos.position_id;
            const votedForId = votedCandidates[pos.position_id];
            const votedFor   = pos.candidates.find(c => c.candidate_id === votedForId);

            // Collapsed "voted" row
            if (hasVoted) {
              return (
                <div
                  key={pos.position_id}
                  className="flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/5 px-4 py-3"
                >
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{pos.title}</p>
                    {votedFor && (
                      <p className="text-xs text-muted-foreground truncate">
                        Voted · {votedFor.name}
                      </p>
                    )}
                  </div>
                </div>
              );
            }

            // Open position card — select then confirm
            return (
              <Card key={pos.position_id}>
                <CardContent className="pt-5 pb-5 space-y-4">
                  <div>
                    <h2 className="font-semibold text-base">{pos.title}</h2>
                    {pos.description && (
                      <p className="text-sm text-muted-foreground mt-0.5">{pos.description}</p>
                    )}
                  </div>

                  {posErr && <AlertMessage variant="error">{posErr}</AlertMessage>}

                  {/* Candidate selection */}
                  <div className="grid gap-2">
                    {pos.candidates.map((c) => {
                      const isSelected = selected === c.candidate_id;
                      return (
                        <button
                          key={c.candidate_id}
                          type="button"
                          disabled={isPending}
                          onClick={() => setSelectedCandidates(prev => ({
                            ...prev,
                            [pos.position_id]: c.candidate_id,
                          }))}
                          className={cn(
                            'w-full rounded-lg border-2 p-3 text-left transition-all',
                            isSelected
                              ? 'border-green-500 bg-green-500/5'
                              : 'border-border bg-card hover:border-green-500/40',
                            isPending && 'opacity-60 cursor-not-allowed'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            {/* Radio indicator */}
                            <div className={cn(
                              'w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors',
                              isSelected ? 'border-green-500 bg-green-500' : 'border-muted-foreground/40'
                            )}>
                              {isSelected && (
                                <div className="w-1.5 h-1.5 rounded-full bg-white" />
                              )}
                            </div>
                            {/* Photo */}
                            <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 border border-border">
                              {c.photo_url ? (
                                <img src={c.photo_url} alt={c.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className={cn(
                                  'w-full h-full flex items-center justify-center text-xs font-bold',
                                  isSelected ? 'bg-green-500/20 text-green-700 dark:text-green-300' : 'bg-muted text-muted-foreground'
                                )}>
                                  {c.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{c.name}</p>
                              {c.bio && (
                                <p className="text-xs text-muted-foreground truncate">{c.bio}</p>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Confirm button — only appears after selection */}
                  {selected && (
                    <Button
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                      disabled={isPending}
                      onClick={() => {
                        setPositionErrors(prev => { const n = { ...prev }; delete n[pos.position_id]; return n; });
                        scheduledVoteMutation.mutate({ positionId: pos.position_id, candidateId: selected });
                      }}
                    >
                      {isPending ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…</>
                      ) : (
                        <><CheckCircle className="mr-2 h-4 w-4" /> Cast Vote for {pos.title}</>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Immediate election: sequential position flow ─────────────────────────────

  // No active position — either between positions or all done
  if (!activePosition) {
    const totalDuration = (data?.positions ?? []).reduce((sum, p) => sum + p.duration_seconds, 0);
    const elapsed = election.started_at
      ? (Date.now() - new Date(election.started_at).getTime()) / 1000
      : 0;
    const allDone = totalDuration > 0 && elapsed >= totalDuration;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-10 text-center space-y-3">
            {allDone ? (
              <>
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                <h2 className="text-xl font-bold">Voting has ended</h2>
                <p className="text-sm text-muted-foreground">
                  All positions have been voted on. Thank you for participating!
                </p>
              </>
            ) : (
              <>
                <Clock className="h-12 w-12 text-primary mx-auto animate-pulse" />
                <h2 className="text-xl font-bold">Waiting for next position…</h2>
                <p className="text-sm text-muted-foreground">
                  The next voting position will open shortly. This page updates automatically.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasVotedThisPosition = votedPositions.has(activePosition.position.position_id);
  const totalPositions = data?.positions.length ?? 0;
  const posIndex = data?.positions.findIndex(
    (p) => p.position_id === activePosition.position.position_id
  ) ?? 0;

  // Find candidates for the active position from the positions array
  const posData = data?.positions.find(
    (p: PublicPosition) => p.position_id === activePosition.position.position_id
  );
  const candidates: (Candidate & { vote_count: number })[] = posData?.candidates ?? [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Vote className="h-5 w-5 text-primary shrink-0" />
            <span className="font-semibold text-sm truncate">{election.title}</span>
          </div>
          <Badge variant="secondary" className="text-xs shrink-0">
            {posIndex + 1} / {totalPositions}
          </Badge>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Position header with circular timer */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold">{activePosition.position.title}</h1>
            {activePosition.position.description && (
              <p className="text-muted-foreground text-sm mt-1">{activePosition.position.description}</p>
            )}
          </div>
          <CircularCountdown
            seconds={countdown}
            total={activePosition.position.duration_seconds}
            size={120}
            className="shrink-0"
          />
        </div>

        {error && <AlertMessage variant="error">{error}</AlertMessage>}

        {hasVotedThisPosition ? (
          election.leaderboard_mode === 'after_each_position' ? (
            // Show live leaderboard for this position
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="h-5 w-5" />
                <p className="font-medium">Vote recorded! Here's the current standings:</p>
              </div>
              <Card>
                <CardContent className="pt-4 pb-4 space-y-3">
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">{activePosition.position.title}</span>
                  </div>
                  {[...candidates]
                    .sort((a, b) => b.vote_count - a.vote_count)
                    .map((c, idx) => {
                      const maxVotes = Math.max(...candidates.map((x) => x.vote_count), 1);
                      const pct = Math.round((c.vote_count / maxVotes) * 100);
                      return (
                        <div key={c.candidate_id} className="space-y-1">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-border">
                              {c.photo_url ? (
                                <img src={c.photo_url} alt={c.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-muted text-xs font-bold text-muted-foreground">
                                  {c.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <span className={cn('flex-1 text-sm font-medium', idx === 0 && 'text-primary')}>
                              {idx === 0 && <Trophy className="inline h-3.5 w-3.5 mr-1 text-yellow-500" />}
                              {c.name}
                            </span>
                            <span className="text-sm text-muted-foreground">{c.vote_count}</span>
                          </div>
                          <div className="ml-11 h-1.5 rounded-full bg-muted overflow-hidden">
                            {/* eslint-disable-next-line react/forbid-component-props */}
                            <div
                              className={cn('h-full rounded-full transition-all duration-500 w-(--bar-pct)', idx === 0 ? 'bg-primary' : 'bg-muted-foreground/40')}
                              style={{ '--bar-pct': `${pct}%` } as React.CSSProperties}
                            />
                          </div>
                        </div>
                      );
                    })}
                  <p className="text-xs text-muted-foreground pt-2 text-center">
                    Waiting for next position…
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center space-y-3">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                <p className="font-medium">Vote recorded for this position!</p>
                <p className="text-sm text-muted-foreground">
                  Waiting for the next position to open…
                </p>
              </CardContent>
            </Card>
          )
        ) : (
          <>
            <div className="grid gap-3">
              {candidates.map((c) => (
                <button
                  key={c.candidate_id}
                  type="button"
                  onClick={() => setSelectedCandidate(c.candidate_id)}
                  className={cn(
                    'w-full rounded-lg border-2 p-4 text-left transition-all',
                    selectedCandidate === c.candidate_id
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/50 bg-card'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-12 h-12 rounded-full overflow-hidden shrink-0 border-2',
                      selectedCandidate === c.candidate_id ? 'border-primary' : 'border-transparent'
                    )}>
                      {c.photo_url ? (
                        <img src={c.photo_url} alt={c.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className={cn(
                          'w-full h-full flex items-center justify-center text-sm font-bold',
                          selectedCandidate === c.candidate_id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        )}>
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{c.name}</p>
                      {c.bio && <p className="text-sm text-muted-foreground truncate">{c.bio}</p>}
                    </div>
                    {selectedCandidate === c.candidate_id && (
                      <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            <Button
              className="w-full"
              size="lg"
              disabled={!selectedCandidate || voteMutation.isPending}
              onClick={() => { setError(undefined); voteMutation.mutate(); }}
            >
              {voteMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…</>
              ) : (
                <>Submit Vote <ChevronRight className="ml-2 h-4 w-4" /></>
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
