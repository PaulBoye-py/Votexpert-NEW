import * as React from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { rootRoute } from '../__root';
import { AdminLayout } from '@/components/templates';
import { AlertMessage } from '@/components/molecules';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from '@/components/atoms';
import { getElections } from '@/api/services/admin.service';
import { $user, $isAuthenticated, logout } from '@/stores/auth.store';
import { useStore } from '@nanostores/react';
import { BarChart3, Trophy } from 'lucide-react';
import type { Admin, Election } from '@/types';

export const adminResultsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/results',
  component: AdminResultsPage,
});

function AdminResultsPage() {
  const navigate = useNavigate();
  const user = useStore($user) as Admin | null;
  const isAuthenticated = useStore($isAuthenticated);

  React.useEffect(() => {
    if (!isAuthenticated) navigate({ to: '/admin/login' });
  }, [isAuthenticated, navigate]);

  const { data: elections = [], isLoading, error } = useQuery({
    queryKey: ['admin', 'elections'],
    queryFn: getElections,
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) return null;

  const activeElections = elections.filter((e: Election) => e.status === 'ACTIVE');
  const completedElections = elections.filter((e: Election) =>
    e.status === 'CLOSED' || e.status === 'RESULTS_PUBLISHED'
  );

  return (
    <AdminLayout
      adminName={user?.name || 'Admin'}
      adminEmail={user?.email}
      orgName={user?.org_name}
      currentPath="/admin/results"
      onNavigate={(path) => navigate({ to: path })}
      onLogout={() => { logout(); navigate({ to: '/admin/login' }); }}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Election Results</h1>
          <p className="text-muted-foreground">View statistics and results for your elections</p>
        </div>

        {error && (
          <AlertMessage variant="error">Failed to load elections. Please try again.</AlertMessage>
        )}

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader><div className="h-6 bg-muted rounded w-3/4" /></CardHeader>
                <CardContent><div className="h-4 bg-muted rounded w-1/2" /></CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            {activeElections.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Live Elections
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {activeElections.map((election: Election) => (
                    <Card key={election.election_id}>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-lg">{election.title}</CardTitle>
                        <Badge variant="default">Live</Badge>
                      </CardHeader>
                      <CardContent>
                        <Button
                          className="w-full"
                          onClick={() => navigate({ to: '/admin/elections/$electionId/statistics', params: { electionId: election.election_id } })}
                        >
                          <BarChart3 className="mr-2 h-4 w-4" />
                          View Live Stats
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Completed Elections
              </h2>
              {completedElections.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No completed elections yet.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {completedElections.map((election: Election) => (
                    <Card key={election.election_id}>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-lg">{election.title}</CardTitle>
                        <Badge variant={election.status === 'RESULTS_PUBLISHED' ? 'default' : 'secondary'}>
                          {election.status === 'RESULTS_PUBLISHED' ? 'Published' : 'Closed'}
                        </Badge>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {election.description && (
                          <p className="text-sm text-muted-foreground">{election.description}</p>
                        )}
                        <div className="flex gap-2">
                          <Button
                            className="flex-1"
                            variant="outline"
                            onClick={() => navigate({ to: '/admin/elections/$electionId/statistics', params: { electionId: election.election_id } })}
                          >
                            <BarChart3 className="mr-2 h-4 w-4" />
                            Statistics
                          </Button>
                          {election.status === 'RESULTS_PUBLISHED' && (
                            <Button
                              className="flex-1"
                              variant="outline"
                              onClick={() => navigate({ to: '/results/$electionId', params: { electionId: election.election_id } })}
                            >
                              <Trophy className="mr-2 h-4 w-4" />
                              Public Results
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
