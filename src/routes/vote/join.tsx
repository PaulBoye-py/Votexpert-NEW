/**
 * /vote/join — Universal voter entry point.
 *
 * Step 1: Enter 6-digit code (or scan QR → ?code=XXXXXX pre-fills it)
 * Step 2: See election info + enter display name (optional, open elections only)
 * Step 3: Join lobby → /vote/:id/lobby
 *
 * If election is already ACTIVE when joining, goes straight to ballot.
 */
import * as React from 'react';
import { createRoute, useNavigate, useSearch } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { rootRoute } from '../__root';
import { AuthLayout } from '@/components/templates';
import { AlertMessage } from '@/components/molecules';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '@/components/atoms';
import {
  getElectionByCode, startVoteSession, joinLobby,
  type ElectionByCodeResponse,
} from '@/api/services/voter.service';
import { setVoterSession } from '@/stores/auth.store';
import { Loader2, Vote, Users, ArrowRight, Hash, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VOTER_SESSION_KEY } from '@/lib/constants';

interface JoinSearch {
  code?: string;
  election?: string; // legacy UUID fallback
}

export const voteJoinRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/vote/join',
  component: VoteJoinPage,
  validateSearch: (s: Record<string, unknown>): JoinSearch => ({
    // Coerce to string — TanStack Router v1 parses numeric-looking params as numbers
    code: s.code != null ? String(s.code) : undefined,
    election: s.election != null ? String(s.election) : undefined,
  }),
});

function VoteJoinPage() {
  const navigate = useNavigate();
  const { code: codeParam, election: electionParam } = useSearch({ from: '/vote/join' });

  // Step 1: code entry   Step 2: name + join
  const [step, setStep] = React.useState<'code' | 'name'>(
    codeParam || electionParam ? 'name' : 'code'
  );
  const [digits, setDigits] = React.useState<string[]>(
    codeParam ? codeParam.slice(0, 6).split('') : ['', '', '', '', '', '']
  );
  const [electionInfo, setElectionInfo] = React.useState<ElectionByCodeResponse | null>(null);
  const [displayName, setDisplayName] = React.useState('');
  const [error, setError] = React.useState<string | undefined>();
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  // Auto-fetch when code param is provided in URL
  React.useEffect(() => {
    if (codeParam && step === 'name' && !electionInfo) {
      lookupMutation.mutate(codeParam);
    }
    // legacy UUID param support
    if (electionParam && !codeParam && step === 'name' && !electionInfo) {
      setElectionInfo({
        election_id: electionParam,
        title: 'Election',
        type: 'OPEN',
        status: 'DRAFT',
        election_code: '',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Code lookup ────────────────────────────────────────────────────────────
  const lookupMutation = useMutation({
    mutationFn: (code: string) => getElectionByCode(code),
    onSuccess: (data) => {
      if (data.type === 'CLOSED') {
        setError('This is a closed election. Please use your personal invite link sent to your email.');
        return;
      }
      setElectionInfo(data);
      setError(undefined);
      setStep('name');
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleCodeSubmit = () => {
    const code = digits.join('');
    if (code.length < 6) { setError('Please enter the full 6-digit code.'); return; }
    setError(undefined);
    lookupMutation.mutate(code);
  };

  // Is this a scheduled election (time window mode)?
  const isScheduled = !!(electionInfo?.scheduled_end_at);

  // ── Join / enter ────────────────────────────────────────────────────────────
  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!electionInfo) throw new Error('No election selected');
      const eid = electionInfo.election_id;

      if (isScheduled) {
        // Scheduled elections: no lobby — either go to ballot (if ACTIVE) or show waiting screen
        if (electionInfo.status === 'ACTIVE') {
          const existing = (() => {
            try { const s = localStorage.getItem(VOTER_SESSION_KEY); return s ? JSON.parse(s) : null; }
            catch { return null; }
          })();
          const existingToken = existing?.election_id === eid ? existing.session_token : undefined;
          const sessionData = await startVoteSession(eid, existingToken);
          setVoterSession({
            session_token: sessionData.session_token,
            election_id: eid,
            display_name: displayName.trim() || 'Anonymous',
          });
          navigate({ to: '/vote/$electionId/ballot', params: { electionId: eid } });
        } else {
          // SCHEDULED (not yet ACTIVE) — go to dedicated waiting/countdown page
          setVoterSession({
            session_token: '',
            election_id: eid,
            display_name: displayName.trim() || 'Anonymous',
          });
          navigate({ to: '/vote/$electionId/waiting', params: { electionId: eid } });
        }
        return;
      }

      // Immediate election: join lobby as usual
      const lobby = await joinLobby(eid, displayName.trim() || undefined);

      if (electionInfo.status === 'ACTIVE') {
        // Already live — create session and go straight to ballot
        if (electionInfo.type === 'OPEN') {
          const existing = (() => {
            try { const s = localStorage.getItem(VOTER_SESSION_KEY); return s ? JSON.parse(s) : null; }
            catch { return null; }
          })();
          const existingToken = existing?.election_id === eid ? existing.session_token : undefined;
          const sessionData = await startVoteSession(eid, existingToken);
          setVoterSession({
            session_token: sessionData.session_token,
            election_id: eid,
            participant_id: lobby.participant_id,
            display_name: lobby.display_name,
          });
          navigate({ to: '/vote/$electionId/ballot', params: { electionId: eid } });
        }
      } else {
        // Pre-active — go to waiting lobby
        setVoterSession({
          session_token: '',
          election_id: eid,
          participant_id: lobby.participant_id,
          display_name: lobby.display_name,
        });
        navigate({ to: '/vote/$electionId/lobby', params: { electionId: eid } });
      }
    },
    onError: (err: Error) => setError(err.message),
  });

  // ── Digit input handlers ───────────────────────────────────────────────────
  const handleDigit = (idx: number, val: string) => {
    const char = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[idx] = char;
    setDigits(next);
    setError(undefined);
    if (char && idx < 5) inputRefs.current[idx + 1]?.focus();
    if (next.every((d) => d !== '')) {
      setError(undefined);
      setTimeout(() => lookupMutation.mutate(next.join('')), 50);
    }
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
    if (e.key === 'Enter') handleCodeSubmit();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(''));
      setError(undefined);
      setTimeout(() => lookupMutation.mutate(pasted), 50);
    }
  };

  return (
    <AuthLayout title="VoteXpert" subtitle="Join an election">
      <Card className="w-full max-w-sm">
        {step === 'code' ? (
          // ── Step 1: Code entry ────────────────────────────────────────────
          <>
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
                <Hash className="h-7 w-7 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-xl">Enter Election Code</CardTitle>
              <CardDescription>
                Enter the 6-digit code shared by your host.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* 6-box OTP input */}
              <div className="flex justify-center gap-2" onPaste={handlePaste}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    title={`Digit ${i + 1} of 6`}
                    aria-label={`Digit ${i + 1} of 6`}
                    value={d}
                    onChange={(e) => handleDigit(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onFocus={(e) => e.target.select()}
                    disabled={lookupMutation.isPending}
                    className={cn(
                      'w-11 h-14 text-center text-2xl font-bold rounded-lg border-2 bg-background transition-all focus:outline-none focus:border-green-500',
                      d ? 'border-green-500/60' : 'border-border',
                      lookupMutation.isPending && 'opacity-50'
                    )}
                  />
                ))}
              </div>

              {error && <AlertMessage variant="error">{error}</AlertMessage>}

              <Button
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                onClick={handleCodeSubmit}
                disabled={lookupMutation.isPending || digits.some((d) => !d)}
              >
                {lookupMutation.isPending
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Looking up…</>
                  : <><ArrowRight className="mr-2 h-4 w-4" /> Continue</>}
              </Button>
            </CardContent>
          </>
        ) : electionInfo ? (
          // ── Step 2: Name entry + join ─────────────────────────────────────
          <>
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
                <Vote className="h-7 w-7 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-xl">{electionInfo.title}</CardTitle>
              {electionInfo.description && (
                <CardDescription>{electionInfo.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-2.5">
                <span className="text-sm text-muted-foreground">Code</span>
                <span className="font-mono font-bold text-lg tracking-widest">
                  {electionInfo.election_code || digits.join('')}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-2.5">
                <span className="text-sm text-muted-foreground">Status</span>
                <StatusBadge status={electionInfo.status} />
              </div>

              {isScheduled && (electionInfo.scheduled_start_at || electionInfo.scheduled_end_at) && (
                <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 px-4 py-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                      {electionInfo.status === 'ACTIVE' ? 'Voting in progress' : 'Voting window'}
                    </span>
                  </div>
                  {electionInfo.scheduled_start_at && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Opens</span>
                      <span className="font-medium">{new Date(electionInfo.scheduled_start_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </div>
                  )}
                  {electionInfo.scheduled_end_at && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Closes</span>
                      <span className="font-medium">{new Date(electionInfo.scheduled_end_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Name input — open elections only */}
              {electionInfo.type === 'OPEN' && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Your name <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <input
                    type="text"
                    placeholder="Enter your name, or leave blank for Anonymous"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={40}
                    disabled={joinMutation.isPending}
                    onKeyDown={(e) => { if (e.key === 'Enter') joinMutation.mutate(); }}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 disabled:opacity-50"
                  />
                </div>
              )}

              {error && <AlertMessage variant="error">{error}</AlertMessage>}

              {electionInfo.status === 'CLOSED' || electionInfo.status === 'RESULTS_PUBLISHED' ? (
                <AlertMessage variant="warning">This election has ended.</AlertMessage>
              ) : (
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => joinMutation.mutate()}
                  disabled={joinMutation.isPending}
                >
                  {joinMutation.isPending
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Joining…</>
                    : isScheduled && electionInfo.status === 'ACTIVE'
                      ? <><ArrowRight className="mr-2 h-4 w-4" /> Vote Now</>
                      : <><Users className="mr-2 h-4 w-4" /> {isScheduled ? 'Wait for Election' : 'Join Lobby'}</>}
                </Button>
              )}

              <button
                type="button"
                onClick={() => { setStep('code'); setElectionInfo(null); setError(undefined); setDigits(['','','','','','']); }}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Enter a different code
              </button>
            </CardContent>
          </>
        ) : (
          <CardContent className="py-12 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        )}
      </Card>
    </AuthLayout>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    DRAFT:             { label: 'Not started yet',  className: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-0' },
    SCHEDULED:         { label: 'Scheduled',        className: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-0' },
    ACTIVE:            { label: 'Live now',          className: 'bg-green-500/15 text-green-700 dark:text-green-300 border-0' },
    CLOSED:            { label: 'Ended',             className: 'bg-muted text-muted-foreground border-0' },
    RESULTS_PUBLISHED: { label: 'Results published', className: 'bg-muted text-muted-foreground border-0' },
  };
  const { label, className } = map[status] ?? { label: status, className: '' };
  return <Badge className={cn('text-xs', className)}>{label}</Badge>;
}
