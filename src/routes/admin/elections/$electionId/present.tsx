/**
 * /admin/elections/:id/present — Projector-ready presenter page.
 *
 * Phase 1 (DRAFT/SCHEDULED): Lobby view
 *   - Shows who has joined the lobby in real-time
 *   - "Launch Election" button with 2-step confirmation → calls startElection API
 *
 * Phase 2 (ACTIVE): Live voting view
 *   - Shows current position + live vote bars updating every 3s
 *   - All voters see the same ballot position at the same time
 */
import * as React from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { rootRoute } from '../../../__root';
import { CircularCountdown } from '@/components/atoms';
import { getElection, startElection } from '@/api/services/admin.service';
import { getPublicElection, getLobbyState } from '@/api/services/voter.service';
import { $user, $isAuthenticated, logout } from '@/stores/auth.store';
import { useStore } from '@nanostores/react';
import {
  Rocket, ArrowLeft, Maximize2, Vote, Trophy, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LobbyParticipant } from '@/types';

export const adminElectionPresenterRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/elections/$electionId/present',
  component: PresenterPage,
});

function PresenterPage() {
  const navigate = useNavigate();
  const { electionId } = adminElectionPresenterRoute.useParams();
  const user = useStore($user);
  const isAuthenticated = useStore($isAuthenticated);

  const [confirmLaunch, setConfirmLaunch] = React.useState(false);
  const [launchError, setLaunchError] = React.useState<string | undefined>();
  const [countdown, setCountdown] = React.useState(0);

  React.useEffect(() => {
    if (!isAuthenticated) navigate({ to: '/admin/login' });
  }, [isAuthenticated, navigate]);

  // Admin election details (for title, status)
  const { data: election, refetch: refetchElection } = useQuery({
    queryKey: ['presenter', 'election', electionId],
    queryFn: () => getElection(electionId),
    enabled: isAuthenticated,
    refetchInterval: 5000,
  });

  // Lobby state — active when DRAFT/SCHEDULED
  const { data: lobbyData } = useQuery({
    queryKey: ['presenter', 'lobby', electionId],
    queryFn: () => getLobbyState(electionId),
    enabled: isAuthenticated && (election?.status === 'DRAFT' || election?.status === 'SCHEDULED'),
    refetchInterval: 3000,
  });

  // Live vote data — active when ACTIVE
  const { data: liveData } = useQuery({
    queryKey: ['presenter', 'live', electionId],
    queryFn: () => getPublicElection(electionId),
    enabled: isAuthenticated && election?.status === 'ACTIVE',
    refetchInterval: 3000,
  });

  // Smooth local countdown for active position
  const activePos = liveData?.active_position;
  React.useEffect(() => {
    if (activePos?.seconds_remaining !== undefined) setCountdown(activePos.seconds_remaining);
  }, [activePos?.seconds_remaining]);
  React.useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => setCountdown((s) => Math.max(0, +(s - 0.1).toFixed(1))), 100);
    return () => clearInterval(id);
  }, [countdown]);

  // Launch election mutation
  const launchMutation = useMutation({
    mutationFn: () => startElection(electionId),
    onSuccess: () => {
      setConfirmLaunch(false);
      setLaunchError(undefined);
      refetchElection();
    },
    onError: (err: Error) => {
      setLaunchError(err.message);
      setConfirmLaunch(false);
    },
  });

  const requestFullscreen = () => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }
  };

  if (!isAuthenticated) return null;

  const isLive = election?.status === 'ACTIVE';
  const isPreStart = election?.status === 'DRAFT' || election?.status === 'SCHEDULED';
  const participants: LobbyParticipant[] = lobbyData?.participants ?? [];

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate({ to: '/admin/elections/$electionId', params: { electionId } })}
            className="flex items-center gap-1.5 text-white/50 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <Vote className="h-5 w-5 text-green-400" />
            <span className="font-semibold text-sm truncate max-w-xs">{election?.title ?? '…'}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isLive && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-green-400 bg-green-400/10 px-3 py-1 rounded-full border border-green-400/20">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              LIVE
            </span>
          )}
          {user?.name && <span className="text-xs text-white/40">{user.name}</span>}
          <button
            type="button"
            onClick={requestFullscreen}
            title="Fullscreen"
            className="text-white/40 hover:text-white transition-colors"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => { logout(); navigate({ to: '/admin/login' }); }}
            className="text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            Log out
          </button>
        </div>
      </div>

      {/* ── Phase 1: Lobby ───────────────────────────────────────────────────── */}
      {isPreStart && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-10 space-y-10">
          {/* Title */}
          <div className="text-center space-y-2">
            <h1 className="text-5xl font-black tracking-tight">{election?.title}</h1>
            <p className="text-white/50 text-lg">Waiting for participants to join…</p>
          </div>

          {/* Participant count */}
          <div className="text-center">
            <div className="text-[7rem] font-black leading-none text-green-400 tabular-nums">
              {participants.length}
            </div>
            <p className="text-white/60 text-xl mt-2">
              {participants.length === 1 ? 'person in lobby' : 'people in lobby'}
            </p>
          </div>

          {/* Participant grid */}
          {participants.length > 0 && (
            <div className="w-full max-w-3xl">
              <div className="flex flex-wrap justify-center gap-3">
                {participants.map((p, idx) => {
                  const colors = [
                    'bg-blue-500/20 border-blue-500/30 text-blue-300',
                    'bg-purple-500/20 border-purple-500/30 text-purple-300',
                    'bg-orange-500/20 border-orange-500/30 text-orange-300',
                    'bg-pink-500/20 border-pink-500/30 text-pink-300',
                    'bg-teal-500/20 border-teal-500/30 text-teal-300',
                    'bg-yellow-500/20 border-yellow-500/30 text-yellow-300',
                  ];
                  const color = colors[idx % colors.length];
                  return (
                    <div
                      key={p.participant_id}
                      className={cn('flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium', color)}
                    >
                      <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold">
                        {p.display_name.charAt(0).toUpperCase()}
                      </span>
                      {p.display_name}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Error */}
          {launchError && (
            <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-4 py-2">{launchError}</p>
          )}

          {/* Launch button */}
          {!confirmLaunch ? (
            <button
              type="button"
              onClick={() => setConfirmLaunch(true)}
              disabled={participants.length === 0}
              className={cn(
                'flex items-center gap-3 px-10 py-5 rounded-2xl text-xl font-bold transition-all',
                participants.length > 0
                  ? 'bg-green-500 hover:bg-green-400 text-white shadow-lg shadow-green-500/30 hover:shadow-green-400/40 hover:scale-105'
                  : 'bg-white/10 text-white/30 cursor-not-allowed'
              )}
            >
              <Rocket className="h-6 w-6" />
              Launch Election
            </button>
          ) : (
            <div className="text-center space-y-4 bg-white/5 border border-white/10 rounded-2xl px-10 py-8">
              <p className="text-xl font-bold">Ready to start?</p>
              <p className="text-white/60 text-sm">
                All {participants.length} {participants.length === 1 ? 'participant' : 'participants'} in the lobby will be redirected to the ballot immediately.
              </p>
              <div className="flex gap-4 justify-center pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmLaunch(false)}
                  className="px-6 py-3 rounded-xl border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-all text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => launchMutation.mutate()}
                  disabled={launchMutation.isPending}
                  className="flex items-center gap-2 px-8 py-3 rounded-xl bg-green-500 hover:bg-green-400 text-white font-bold transition-all disabled:opacity-60"
                >
                  <Rocket className="h-4 w-4" />
                  {launchMutation.isPending ? 'Starting…' : 'Start Now'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Phase 2: Live voting ─────────────────────────────────────────────── */}
      {isLive && liveData && (
        <div className="flex-1 flex flex-col px-8 py-8 space-y-8 max-w-5xl mx-auto w-full">
          {/* Election title */}
          <h1 className="text-3xl font-black text-center">{election?.title}</h1>

          {/* Active position */}
          {(() => {
            const totalDuration = liveData.positions.reduce((sum, p) => sum + p.duration_seconds, 0);
            const elapsed = election?.started_at
              ? (Date.now() - new Date(election.started_at).getTime()) / 1000
              : 0;
            const allDone = !activePos && totalDuration > 0 && elapsed >= totalDuration;
            if (allDone) return (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-3">
                  <Trophy className="h-12 w-12 text-yellow-400 mx-auto" />
                  <p className="text-white/70 text-lg">All positions completed</p>
                  <p className="text-white/40 text-sm">You can now end the election.</p>
                </div>
              </div>
            );
            return null;
          })()}
          {activePos ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-white/50 text-sm uppercase tracking-widest font-medium flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5" />
                    Now Voting
                  </p>
                  <h2 className="text-4xl font-black">{activePos.position.title}</h2>
                </div>
                <CircularCountdown
                  seconds={countdown}
                  total={activePos.position.duration_seconds}
                  size={120}
                />
              </div>

              {/* Candidate bars */}
              <LiveBars electionId={electionId} positionId={activePos.position.position_id} liveData={liveData} />
            </div>
          ) : null}

          {/* Position progress dots */}
          <div className="flex justify-center gap-3 pt-2">
            {liveData.positions.map((pos, idx) => {
              const isActive = pos.position_id === activePos?.position.position_id;
              const totalVotes = pos.candidates.reduce((s, c) => s + c.vote_count, 0);
              const isDone = !isActive && totalVotes > 0;
              return (
                <div
                  key={pos.position_id}
                  className={cn(
                    'flex flex-col items-center gap-1',
                  )}
                >
                  <div className={cn(
                    'w-3 h-3 rounded-full transition-all',
                    isActive ? 'bg-green-400 scale-125 shadow-lg shadow-green-400/50' : isDone ? 'bg-white/50' : 'bg-white/20'
                  )} />
                  <span className="text-xs text-white/40">{idx + 1}</span>
                </div>
              );
            })}
          </div>

          {/* Completed positions */}
          {liveData.positions
            .filter(pos => {
              const totalVotes = pos.candidates.reduce((s, c) => s + c.vote_count, 0);
              return totalVotes > 0 && pos.position_id !== activePos?.position.position_id;
            })
            .map(pos => {
              const totalVotes = pos.candidates.reduce((s, c) => s + c.vote_count, 0);
              const winner = [...pos.candidates].sort((a, b) => b.vote_count - a.vote_count)[0];
              return (
                <div key={pos.position_id} className="bg-white/5 rounded-xl px-5 py-4 border border-white/10">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white/70">{pos.title}</p>
                    <div className="flex items-center gap-2 text-xs text-white/50">
                      <Trophy className="h-3.5 w-3.5 text-yellow-400" />
                      <span className="text-white font-medium">{winner?.name}</span>
                      <span>·</span>
                      <span>{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Election ended / results published */}
      {(election?.status === 'CLOSED' || election?.status === 'RESULTS_PUBLISHED') && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-6 px-8">
          <Trophy className="h-16 w-16 text-yellow-400" />
          <h1 className="text-4xl font-black text-center">{election?.title}</h1>
          <p className="text-white/50 text-xl">Voting has ended.</p>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => navigate({ to: '/results/$electionId', params: { electionId } })}
              className="px-8 py-3 rounded-xl bg-green-500 hover:bg-green-400 text-white font-bold transition-all"
            >
              View Results
            </button>
            <button
              type="button"
              onClick={() => navigate({ to: '/admin/elections/$electionId', params: { electionId } })}
              className="px-8 py-3 rounded-xl border border-white/20 text-white/70 hover:text-white transition-all font-medium"
            >
              Back to Setup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Live candidate bars component ──────────────────────────────────────────────

function LiveBars({
  positionId,
  liveData,
}: {
  electionId: string;
  positionId: string;
  liveData: ReturnType<typeof getPublicElection> extends Promise<infer T> ? T : never;
}) {
  const pos = liveData.positions.find(p => p.position_id === positionId);
  if (!pos) return null;

  const sorted = [...pos.candidates].sort((a, b) => b.vote_count - a.vote_count);
  const totalVotes = sorted.reduce((s, c) => s + c.vote_count, 0);

  return (
    <div className="space-y-4">
      {sorted.map((c, idx) => {
        const pct = totalVotes > 0 ? Math.round((c.vote_count / totalVotes) * 100) : 0;
        const isLeading = idx === 0 && c.vote_count > 0;
        return (
          <div key={c.candidate_id} className="space-y-2">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className={cn(
                'w-12 h-12 rounded-full overflow-hidden shrink-0 border-2',
                isLeading ? 'border-yellow-400' : 'border-white/20'
              )}>
                {c.photo_url ? (
                  <img src={c.photo_url} alt={c.name} className="w-full h-full object-cover" />
                ) : (
                  <div className={cn(
                    'w-full h-full flex items-center justify-center text-lg font-bold',
                    isLeading ? 'bg-yellow-400/20 text-yellow-300' : 'bg-white/10 text-white/60'
                  )}>
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Name + count */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {isLeading && <Trophy className="h-4 w-4 text-yellow-400 shrink-0" />}
                    <span className={cn('text-xl font-bold truncate', isLeading ? 'text-white' : 'text-white/70')}>
                      {c.name}
                    </span>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <span className={cn('text-2xl font-black tabular-nums', isLeading ? 'text-green-400' : 'text-white/60')}>
                      {pct}%
                    </span>
                    <span className="text-white/40 text-sm ml-2">({c.vote_count})</span>
                  </div>
                </div>
                {/* Vote bar */}
                <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                  {/* eslint-disable-next-line react/forbid-component-props */}
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-700 ease-out w-(--bar-w)',
                      isLeading ? 'bg-green-400' : 'bg-white/30'
                    )}
                    style={{ '--bar-w': `${pct}%` } as React.CSSProperties}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {totalVotes > 0 && (
        <p className="text-white/30 text-sm text-right pt-1">{totalVotes} vote{totalVotes !== 1 ? 's' : ''} cast</p>
      )}
    </div>
  );
}
