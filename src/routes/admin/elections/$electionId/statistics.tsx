import * as React from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { rootRoute } from '../../../__root';
import { AdminLayout } from '@/components/templates';
import { AlertMessage } from '@/components/molecules';
import { Button, Card, CardContent, CardHeader, CardTitle, ProgressBar, CircularCountdown } from '@/components/atoms';
import { getElection, getPositions, getVoters } from '@/api/services/admin.service';
import { getPublicElection } from '@/api/services/voter.service';
import { $user, $isAuthenticated, logout } from '@/stores/auth.store';
import { useStore } from '@nanostores/react';
import { ArrowLeft, RefreshCw, Users, Vote, Clock, TrendingUp } from 'lucide-react';
import type { Admin } from '@/types';

export const adminElectionStatisticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/elections/$electionId/statistics',
  component: ElectionStatisticsPage,
});

function ElectionStatisticsPage() {
  const navigate = useNavigate();
  const { electionId } = adminElectionStatisticsRoute.useParams();
  const user = useStore($user) as Admin | null;
  const isAuthenticated = useStore($isAuthenticated);

  React.useEffect(() => {
    if (!isAuthenticated) navigate({ to: '/admin/login' });
  }, [isAuthenticated, navigate]);

  const { data: election } = useQuery({
    queryKey: ['admin', 'election', electionId],
    queryFn: () => getElection(electionId),
    enabled: isAuthenticated,
  });

  // Live vote counts — poll every 10s
  const { data: publicData, isLoading, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['admin', 'election', electionId, 'live'],
    queryFn: () => getPublicElection(electionId),
    enabled: isAuthenticated && !!election,
    refetchInterval: 3000,
  });

  const { data: voters = [] } = useQuery({
    queryKey: ['admin', 'election', electionId, 'voters'],
    queryFn: () => getVoters(electionId),
    enabled: isAuthenticated && election?.type === 'CLOSED',
  });

  const { data: positions = [] } = useQuery({
    queryKey: ['admin', 'election', electionId, 'positions'],
    queryFn: () => getPositions(electionId),
    enabled: isAuthenticated,
  });

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : 'N/A';

  // Compute live totals
  const totalVotesCast = React.useMemo(() => {
    if (!publicData?.positions) return 0;
    return publicData.positions.reduce(
      (sum, pos) => sum + pos.candidates.reduce((s, c) => s + c.vote_count, 0),
      0
    );
  }, [publicData]);

  const totalVoters = voters.length;
  const turnout = totalVoters > 0 ? Math.round((totalVotesCast / totalVoters) * 100) : 0;

  const activePosition = publicData?.active_position;

  // Local countdown that ticks every second, seeded from server value on each poll
  const [countdown, setCountdown] = React.useState<number>(0);
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

  if (!isAuthenticated) return null;

  return (
    <AdminLayout
      adminName={user?.name || 'Admin'}
      adminEmail={user?.email}
      orgName={user?.org_name}
      currentPath="/admin/elections"
      onNavigate={(path) => navigate({ to: path })}
      onLogout={() => { logout(); navigate({ to: '/admin/login' }); }}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate({ to: '/admin/elections/$electionId', params: { electionId } })}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Live Statistics</h1>
              <p className="text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
            </div>
          </div>
          <Button onClick={() => refetch()} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {error && (
          <AlertMessage variant="error">Failed to load live data. Please refresh.</AlertMessage>
        )}

        {/* Overview cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Voters', value: totalVoters || '—', icon: Users },
            { label: 'Votes Cast', value: totalVotesCast, icon: Vote },
            { label: 'Positions', value: positions.length, icon: Clock },
            { label: 'Turnout', value: totalVoters > 0 ? `${turnout}%` : '—', icon: TrendingUp },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label}>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{isLoading ? '…' : value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Turnout progress (closed elections only) */}
        {totalVoters > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Voter Turnout</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ProgressBar
                value={turnout}
                showLabel
                size="lg"
                variant={turnout >= 50 ? 'success' : 'default'}
              />
              <p className="text-sm text-muted-foreground text-center">
                {totalVotesCast} of {totalVoters} voters have participated
              </p>
            </CardContent>
          </Card>
        )}

        {/* Active position */}
        {activePosition && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-green-500" />
                Now Voting: {activePosition.position.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <CircularCountdown
                  seconds={countdown}
                  total={activePosition.position.duration_seconds}
                  size={160}
                />
                <div className="space-y-1 text-center sm:text-left">
                  <p className="text-sm text-muted-foreground">Position</p>
                  <p className="font-semibold text-lg">{activePosition.position.title}</p>
                  {countdown <= 30 && countdown > 0 && (
                    <p className="text-sm text-destructive animate-pulse font-medium">Closing soon</p>
                  )}
                  {countdown === 0 && (
                    <p className="text-sm text-muted-foreground">Waiting for next position…</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Live vote counts per position */}
        {publicData?.positions.map((pos) => {
          const totalPosVotes = pos.candidates.reduce((s, c) => s + c.vote_count, 0);
          return (
            <Card key={pos.position_id}>
              <CardHeader>
                <CardTitle className="text-base">{pos.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pos.candidates
                  .sort((a, b) => b.vote_count - a.vote_count)
                  .map((c) => {
                    const pct = totalPosVotes > 0
                      ? Math.round((c.vote_count / totalPosVotes) * 100)
                      : 0;
                    return (
                      <div key={c.candidate_id} className="space-y-1.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 bg-muted">
                            {c.photo_url ? (
                              <img src={c.photo_url} alt={c.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                                {c.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="font-medium truncate">{c.name}</span>
                              <span className="text-muted-foreground shrink-0 ml-2">{c.vote_count} · {pct}%</span>
                            </div>
                            <ProgressBar value={pct} size="sm" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                {pos.candidates.length === 0 && (
                  <p className="text-sm text-muted-foreground">No candidates</p>
                )}
              </CardContent>
            </Card>
          );
        })}

        <p className="text-sm text-muted-foreground text-center">
          Automatically refreshes every 10 seconds
        </p>
      </div>
    </AdminLayout>
  );
}
