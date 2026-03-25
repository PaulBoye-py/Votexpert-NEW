import * as React from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { rootRoute } from '../../__root';
import { AdminLayout } from '@/components/templates';
import { AlertMessage, FormField, DateTimePicker } from '@/components/molecules';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '@/components/atoms';
import { createElection } from '@/api/services/admin.service';
import { $user, $isAuthenticated, logout } from '@/stores/auth.store';
import { useStore } from '@nanostores/react';
import { ArrowLeft, CheckCircle, Globe, Lock, Trophy, Timer, Zap, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Admin, ElectionType, LeaderboardMode } from '@/types';

type ElectionMode = 'immediate' | 'scheduled';

export const adminElectionsCreateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/elections/create',
  component: CreateElectionPage,
});

function CreateElectionPage() {
  const navigate = useNavigate();
  const user = useStore($user) as Admin | null;
  const isAuthenticated = useStore($isAuthenticated);

  const [form, setForm] = React.useState({
    title: '',
    description: '',
    type: 'OPEN' as ElectionType,
    mode: 'immediate' as ElectionMode,
    scheduled_start_at: '',
    scheduled_end_at: '',
    show_live_results: true,
    leaderboard_mode: 'at_end' as LeaderboardMode,
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [apiError, setApiError] = React.useState<string | undefined>();
  const [createdId, setCreatedId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isAuthenticated) navigate({ to: '/admin/login' });
  }, [isAuthenticated, navigate]);

  const createMutation = useMutation({
    mutationFn: () =>
      createElection({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        type: form.type,
        show_live_results: form.show_live_results,
        leaderboard_mode: form.leaderboard_mode,
        ...(form.mode === 'scheduled' && form.scheduled_start_at
          ? { scheduled_start_at: new Date(form.scheduled_start_at).toISOString() }
          : {}),
        ...(form.mode === 'scheduled' && form.scheduled_end_at
          ? { scheduled_end_at: new Date(form.scheduled_end_at).toISOString() }
          : {}),
      }),
    onSuccess: (election) => setCreatedId(election.election_id),
    onError: (err: Error) => setApiError(err.message),
  });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = 'Election title is required';
    if (form.mode === 'scheduled') {
      if (!form.scheduled_start_at) e.scheduled_start_at = 'Start time is required';
      if (!form.scheduled_end_at) e.scheduled_end_at = 'End time is required';
      if (form.scheduled_start_at && form.scheduled_end_at &&
          new Date(form.scheduled_end_at) <= new Date(form.scheduled_start_at)) {
        e.scheduled_end_at = 'End time must be after start time';
      }
    }
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    setApiError(undefined);
    if (validate()) createMutation.mutate();
  };

  if (!isAuthenticated) return null;

  if (createdId) {
    return (
      <AdminLayout
        adminName={user?.name || 'Admin'}
        adminEmail={user?.email}
        orgName={user?.org_name}
        currentPath="/admin/elections"
        onNavigate={(path) => navigate({ to: path })}
        onLogout={() => { logout(); navigate({ to: '/admin/login' }); }}
      >
        <div className="max-w-md mx-auto py-8">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-2xl text-green-600 dark:text-green-400">
                Election Created!
              </CardTitle>
              <CardDescription>
                Now add positions and candidates to set it up.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-1">
                <p className="text-sm text-muted-foreground">Election ID</p>
                <p className="font-mono text-sm font-medium break-all">{createdId}</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => navigate({ to: '/admin/elections' })} className="flex-1">
                  Back to Elections
                </Button>
                <Button
                  onClick={() =>
                    navigate({ to: '/admin/elections/$electionId', params: { electionId: createdId } })
                  }
                  className="flex-1"
                >
                  Set Up Election
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      adminName={user?.name || 'Admin'}
      adminEmail={user?.email}
      orgName={user?.org_name}
      currentPath="/admin/elections"
      onNavigate={(path) => navigate({ to: path })}
      onLogout={() => { logout(); navigate({ to: '/admin/login' }); }}
    >
      <div className="max-w-2xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate({ to: '/admin/elections' })} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Elections
        </Button>

        <div>
          <h1 className="text-2xl font-bold text-foreground">Create Election</h1>
          <p className="text-muted-foreground">
            Start with the basics — you'll add positions and candidates next.
          </p>
        </div>

        {apiError && <AlertMessage variant="error">{apiError}</AlertMessage>}

        <Card>
          <CardHeader>
            <CardTitle>Election Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <FormField
                label="Election Title"
                type="text"
                placeholder="e.g. 2026 Board of Directors Election"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                error={errors.title}
                disabled={createMutation.isPending}
                required
              />

              <div className="space-y-2">
                <label className="text-sm font-medium">Description <span className="text-muted-foreground">(optional)</span></label>
                <textarea
                  placeholder="Describe the purpose of this election..."
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  disabled={createMutation.isPending}
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              {/* Election Type */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Election Type</label>
                <div className="grid grid-cols-2 gap-4">
                  {([
                    { value: 'OPEN', label: 'Open', icon: Globe, desc: 'Anyone with the link can vote. Great for live polls and public events.' },
                    { value: 'CLOSED', label: 'Closed', icon: Lock, desc: 'Invite-only via email. Each voter gets a unique link.' },
                  ] as const).map(({ value, label, icon: Icon, desc }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, type: value }))}
                      className={cn(
                        'rounded-lg border-2 p-4 text-left transition-all',
                        form.type === value
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-border hover:border-green-500/50'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={cn('h-4 w-4', form.type === value ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground')} />
                        <span className="font-medium text-sm">{label}</span>
                        {form.type === value && (
                          <Badge className="ml-auto text-xs bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30">Selected</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Election Mode */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Election Mode</label>
                <div className="grid grid-cols-2 gap-4">
                  {([
                    { value: 'immediate' as const, label: 'Immediate', icon: Zap, desc: 'Start manually when you\'re ready. Positions run sequentially with timers.' },
                    { value: 'scheduled' as const, label: 'Scheduled', icon: Calendar, desc: 'Set a time window. All positions open simultaneously for the duration.' },
                  ]).map(({ value, label, icon: Icon, desc }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, mode: value }))}
                      className={cn(
                        'rounded-lg border-2 p-4 text-left transition-all',
                        form.mode === value
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-border hover:border-green-500/50'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={cn('h-4 w-4', form.mode === value ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground')} />
                        <span className="font-medium text-sm">{label}</span>
                        {form.mode === value && (
                          <Badge className="ml-auto text-xs bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30">Selected</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </button>
                  ))}
                </div>

                {form.mode === 'scheduled' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <DateTimePicker
                      label="Start Date & Time"
                      placeholder="When does voting open?"
                      value={form.scheduled_start_at}
                      onChange={(iso) => setForm((p) => ({ ...p, scheduled_start_at: iso }))}
                      minDate={new Date()}
                      error={errors.scheduled_start_at}
                    />
                    <DateTimePicker
                      label="End Date & Time"
                      placeholder="When does voting close?"
                      value={form.scheduled_end_at}
                      onChange={(iso) => setForm((p) => ({ ...p, scheduled_end_at: iso }))}
                      minDate={form.scheduled_start_at ? new Date(form.scheduled_start_at) : new Date()}
                      error={errors.scheduled_end_at}
                    />
                  </div>
                )}
              </div>

              {/* Leaderboard Mode */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Leaderboard Display</label>
                <div className="grid grid-cols-2 gap-4">
                  {([
                    {
                      value: 'after_each_position' as const,
                      label: 'After each position',
                      icon: Trophy,
                      desc: 'Voters see a live leaderboard after submitting each vote.',
                    },
                    {
                      value: 'at_end' as const,
                      label: 'At the end',
                      icon: Timer,
                      desc: 'Results are hidden until the full election ends.',
                    },
                  ]).map(({ value, label, icon: Icon, desc }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, leaderboard_mode: value }))}
                      className={cn(
                        'rounded-lg border-2 p-4 text-left transition-all',
                        form.leaderboard_mode === value
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-border hover:border-green-500/50'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={cn('h-4 w-4', form.leaderboard_mode === value ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground')} />
                        <span className="font-medium text-sm">{label}</span>
                        {form.leaderboard_mode === value && (
                          <Badge className="ml-auto text-xs bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30">Selected</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Results Toggle */}
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="text-sm font-medium">Show Live Results</p>
                  <p className="text-xs text-muted-foreground">
                    Broadcast vote counts in real-time on the admin dashboard
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.show_live_results}
                  aria-label="Toggle live results"
                  title="Toggle live results"
                  onClick={() => setForm((p) => ({ ...p, show_live_results: !p.show_live_results }))}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    form.show_live_results ? 'bg-primary' : 'bg-input'
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
                      form.show_live_results ? 'translate-x-6' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>

              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Election'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
