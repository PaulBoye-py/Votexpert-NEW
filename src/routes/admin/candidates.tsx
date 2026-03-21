import * as React from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { rootRoute } from '../__root';
import { AdminLayout } from '@/components/templates';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/atoms';
import { getElections, getPositions, getCandidates } from '@/api/services/admin.service';
import { $user, $isAuthenticated, logout } from '@/stores/auth.store';
import { useStore } from '@nanostores/react';
import { ArrowUpRight } from 'lucide-react';
import type { Admin, Election, Candidate } from '@/types';

export const adminCandidatesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/candidates',
  component: AdminCandidatesPage,
});

type FlatCandidate = Candidate & { electionTitle: string; positionTitle: string };

function AdminCandidatesPage() {
  const navigate = useNavigate();
  const user = useStore($user) as Admin | null;
  const isAuthenticated = useStore($isAuthenticated);

  React.useEffect(() => {
    if (!isAuthenticated) navigate({ to: '/admin/login' });
  }, [isAuthenticated, navigate]);

  // Fetch all elections, then positions + candidates for each
  const { data: elections = [], isLoading } = useQuery({
    queryKey: ['admin', 'elections'],
    queryFn: getElections,
    enabled: isAuthenticated,
  });

  const { data: flatCandidates = [], isLoading: cLoading } = useQuery({
    queryKey: ['admin', 'all-candidates', elections.map((e: Election) => e.election_id).join(',')],
    queryFn: async () => {
      const result: FlatCandidate[] = [];
      for (const election of elections) {
        const positions = await getPositions(election.election_id);
        for (const pos of positions) {
          const candidates = await getCandidates(election.election_id, pos.position_id);
          candidates.forEach((c) =>
            result.push({ ...c, electionTitle: election.title, positionTitle: pos.title })
          );
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
      currentPath="/admin/candidates"
      onNavigate={(path) => navigate({ to: path })}
      onLogout={() => { logout(); navigate({ to: '/admin/login' }); }}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Candidates</h1>
            <p className="text-muted-foreground">All candidates across your elections</p>
          </div>
          <Button variant="outline" onClick={() => navigate({ to: '/admin/elections' })}>
            <ArrowUpRight className="mr-2 h-4 w-4" />
            Manage in Elections
          </Button>
        </div>

        {(isLoading || cLoading) ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">Loading…</CardContent></Card>
        ) : flatCandidates.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <p className="text-muted-foreground">No candidates yet.</p>
              <Button onClick={() => navigate({ to: '/admin/elections/create' })}>
                Create an Election
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>All Candidates ({flatCandidates.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border divide-y divide-border">
                {flatCandidates.map((c) => (
                  <div key={c.candidate_id} className="flex items-center justify-between px-4 py-3">
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
                      <div>
                        <p className="font-medium text-sm">{c.name}</p>
                        {c.bio && <p className="text-xs text-muted-foreground">{c.bio}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <Badge variant="secondary" className="text-xs">{c.positionTitle}</Badge>
                        <p className="text-xs text-muted-foreground mt-0.5">{c.electionTitle}</p>
                      </div>
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
