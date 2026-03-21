import * as React from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { rootRoute } from '../__root';
import { AdminLayout } from '@/components/templates';
import { ElectionDashboardStats, ElectionList } from '@/components/organisms';
import { AlertMessage } from '@/components/molecules';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/atoms';
import { getElections } from '@/api/services/admin.service';
import { $user, $isAuthenticated, logout } from '@/stores/auth.store';
import { useStore } from '@nanostores/react';
import { Plus } from 'lucide-react';
import type { Admin } from '@/types';

export const adminDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/dashboard',
  component: AdminDashboardPage,
});

function AdminDashboardPage() {
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

  const stats = React.useMemo(() => ({
    totalElections: elections.length,
    activeElections: elections.filter((e) => e.status === 'ACTIVE').length,
    totalVoters: 0,
    totalVotesCast: 0,
  }), [elections]);

  const recentElections = React.useMemo(() =>
    elections.slice(0, 5).map((e) => ({
      id: e.election_id,
      name: e.title,
      description: e.description ?? '',
      status: e.status,
      startTime: e.started_at ?? e.scheduled_start_at ?? e.created_at,
      endTime: e.ended_at ?? '',
    })), [elections]);

  if (!isAuthenticated) return null;

  return (
    <AdminLayout
      adminName={user?.name || 'Admin'}
      adminEmail={user?.email}
      orgName={user?.org_name}
      currentPath="/admin/dashboard"
      onNavigate={(path) => navigate({ to: path })}
      onLogout={() => { logout(); navigate({ to: '/admin/login' }); }}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">Welcome back, {user?.name || 'Admin'}</p>
          </div>
          <Button onClick={() => navigate({ to: '/admin/elections/create' })}>
            <Plus className="mr-2 h-4 w-4" />
            Create Election
          </Button>
        </div>

        {error && (
          <AlertMessage variant="error">
            Failed to load dashboard data. Please try again later.
          </AlertMessage>
        )}

        <ElectionDashboardStats
          totalElections={stats.totalElections}
          activeElections={stats.activeElections}
          totalVoters={stats.totalVoters}
          totalVotesCast={stats.totalVotesCast}
          isLoading={isLoading}
        />

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Elections</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/admin/elections' })}>
              View All
            </Button>
          </CardHeader>
          <CardContent>
            <ElectionList
              elections={recentElections}
              isLoading={isLoading}
              emptyMessage="No elections yet. Create your first election!"
              onElectionClick={(id) =>
                navigate({ to: '/admin/elections/$electionId', params: { electionId: id } })
              }
              getActionLabel={() => 'Manage'}
            />
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
