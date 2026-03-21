import * as React from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { rootRoute } from '../__root';
import { AdminLayout } from '@/components/templates';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/atoms';
import { getElections, getVoters } from '@/api/services/admin.service';
import { $user, $isAuthenticated, logout } from '@/stores/auth.store';
import { useStore } from '@nanostores/react';
import { ArrowUpRight } from 'lucide-react';
import type { Admin, Election, Voter } from '@/types';

export const adminVotersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/voters',
  component: AdminVotersPage,
});

type FlatVoter = Voter & { electionTitle: string };

function AdminVotersPage() {
  const navigate = useNavigate();
  const user = useStore($user) as Admin | null;
  const isAuthenticated = useStore($isAuthenticated);

  React.useEffect(() => {
    if (!isAuthenticated) navigate({ to: '/admin/login' });
  }, [isAuthenticated, navigate]);

  const { data: elections = [], isLoading } = useQuery({
    queryKey: ['admin', 'elections'],
    queryFn: getElections,
    enabled: isAuthenticated,
  });

  const { data: flatVoters = [], isLoading: vLoading } = useQuery({
    queryKey: ['admin', 'all-voters', elections.map((e: Election) => e.election_id).join(',')],
    queryFn: async () => {
      const result: FlatVoter[] = [];
      for (const election of elections) {
        if (election.type === 'CLOSED') {
          const voters = await getVoters(election.election_id);
          voters.forEach((v) => result.push({ ...v, electionTitle: election.title }));
        }
      }
      return result;
    },
    enabled: elections.length > 0,
  });

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Voters</h1>
            <p className="text-muted-foreground">All voters across your closed elections</p>
          </div>
          <Button variant="outline" onClick={() => navigate({ to: '/admin/elections' })}>
            <ArrowUpRight className="mr-2 h-4 w-4" />
            Manage in Elections
          </Button>
        </div>

        {(isLoading || vLoading) ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">Loading…</CardContent></Card>
        ) : flatVoters.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <p className="text-muted-foreground">No voters yet. Add voters to a closed election.</p>
              <Button onClick={() => navigate({ to: '/admin/elections' })}>
                Go to Elections
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>All Voters ({flatVoters.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border divide-y divide-border">
                {flatVoters.map((v) => (
                  <div key={v.voter_id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="font-medium text-sm">{v.email}</p>
                      <p className="text-xs text-muted-foreground">{v.electionTitle}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={Object.keys(v.votes_cast).length > 0 ? 'default' : 'secondary'}>
                        {Object.keys(v.votes_cast).length > 0 ? 'Voted' : 'Pending'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
