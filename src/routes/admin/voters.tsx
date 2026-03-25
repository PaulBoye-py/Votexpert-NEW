import * as React from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rootRoute } from '../__root';
import { AdminLayout } from '@/components/templates';
import { AlertMessage } from '@/components/molecules';
import { Button, Card, CardContent, CardHeader, CardTitle} from '@/components/atoms';
import { getOrgVoters, addOrgVoters, deleteOrgVoter } from '@/api/services/admin.service';
import { $user, $isAuthenticated, logout } from '@/stores/auth.store';
import { useStore } from '@nanostores/react';
import { Plus, Trash2, Users, Upload, X as XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Admin } from '@/types';

export const adminVotersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/voters',
  component: AdminVotersPage,
});

function AdminVotersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useStore($user) as Admin | null;
  const isAuthenticated = useStore($isAuthenticated);

  const [showAddForm, setShowAddForm] = React.useState(false);
  const [emailInput, setEmailInput] = React.useState('');
  const [addMsg, setAddMsg] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isAuthenticated) navigate({ to: '/admin/login' });
  }, [isAuthenticated, navigate]);

  const { data: pool = [], isLoading } = useQuery({
    queryKey: ['admin', 'org-voters'],
    queryFn: getOrgVoters,
    enabled: isAuthenticated,
  });

  const addMutation = useMutation({
    mutationFn: (emails: string[]) => addOrgVoters(emails),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'org-voters'] });
      setEmailInput('');
      setShowAddForm(false);
      setAddMsg({
        type: 'success',
        text: `Added ${result.added} voter${result.added !== 1 ? 's' : ''}${result.skipped > 0 ? ` (${result.skipped} already in pool)` : ''}.`,
      });
      setTimeout(() => setAddMsg(null), 4000);
    },
    onError: (err: Error) => setAddMsg({ type: 'error', text: err.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (orgVoterId: string) => deleteOrgVoter(orgVoterId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'org-voters'] });
      setConfirmDeleteId(null);
    },
  });

  const handleAdd = () => {
    const emails = emailInput
      .split(/[\n,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (!emails.length) {
      setAddMsg({ type: 'error', text: 'Enter at least one valid email address.' });
      return;
    }
    setAddMsg(null);
    addMutation.mutate(emails);
  };

  if (!isAuthenticated) return null;

  return (
    <AdminLayout
      adminName={user?.name || 'Admin'}
      adminEmail={user?.email}
      orgName={user?.org_name}
      currentPath="/admin/voters"
      onNavigate={(path) => navigate({ to: path })}
      onLogout={() => { logout(); navigate({ to: '/admin/login' }); }}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Voter Pool</h1>
            <p className="text-muted-foreground text-sm">
              Manage your reusable list of voters. Select from this pool when setting up closed elections.
            </p>
          </div>
          <Button onClick={() => { setShowAddForm(true); setAddMsg(null); }} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Voters
          </Button>
        </div>

        {addMsg && (
          <AlertMessage variant={addMsg.type === 'error' ? 'error' : 'success'}>
            {addMsg.text}
          </AlertMessage>
        )}

        {/* Add voters form */}
        {showAddForm && (
          <Card className="border-dashed">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Add to Voter Pool
              </CardTitle>
              <button type="button" onClick={() => setShowAddForm(false)} className="text-muted-foreground hover:text-foreground">
                <XIcon className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Email addresses</label>
                <textarea
                  placeholder="Enter emails separated by newlines, commas, or semicolons&#10;alice@example.com&#10;bob@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  rows={5}
                  disabled={addMutation.isPending}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Separate multiple addresses with newlines, commas, or semicolons.
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAdd} disabled={addMutation.isPending || !emailInput.trim()}>
                  {addMutation.isPending ? 'Adding…' : 'Add to Pool'}
                </Button>
                <Button variant="ghost" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pool list */}
        {isLoading ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">Loading…</CardContent></Card>
        ) : pool.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <div className="mx-auto w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                <Users className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="font-medium">No voters in your pool yet</p>
              <p className="text-sm text-muted-foreground">
                Add voters here, then select them when setting up a closed election.
              </p>
              <Button onClick={() => setShowAddForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Voters
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                Pool ({pool.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border divide-y divide-border">
                {pool.map((v) => (
                  <div key={v.org_voter_id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="font-medium text-sm">{v.email}</p>
                      {v.name && <p className="text-xs text-muted-foreground">{v.name}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {confirmDeleteId === v.org_voter_id ? (
                        <>
                          <span className="text-xs text-muted-foreground">Remove?</span>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteMutation.mutate(v.org_voter_id)}
                            disabled={deleteMutation.isPending}
                          >
                            Yes
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(v.org_voter_id)}
                          className={cn(
                            'p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors',
                          )}
                          title="Remove from pool"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Usage tip */}
        {pool.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Tip:</span> Go to a closed election's setup page and click{' '}
              <span className="font-medium text-foreground">Select from Pool</span> to add these voters to that election.
            </p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
