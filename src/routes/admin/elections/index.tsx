import * as React from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { rootRoute } from '../../__root';
import { AdminLayout } from '@/components/templates';
import { ElectionList } from '@/components/organisms';
import { AlertMessage } from '@/components/molecules';
import { Button } from '@/components/atoms';
import { getElections } from '@/api/services/admin.service';
import { $user, $isAuthenticated, logout } from '@/stores/auth.store';
import { useStore } from '@nanostores/react';
import { Plus } from 'lucide-react';
import type { Admin } from '@/types';

export const adminElectionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/elections',
  component: AdminElectionsPage,
});

function AdminElectionsPage() {
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

  const electionsList = React.useMemo(() =>
    elections.map((e) => ({
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
      currentPath="/admin/elections"
      onNavigate={(path) => navigate({ to: path })}
      onLogout={() => { logout(); navigate({ to: '/admin/login' }); }}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Elections</h1>
            <p className="text-muted-foreground">Manage all your elections</p>
          </div>
          <Button onClick={() => navigate({ to: '/admin/elections/create' })}>
            <Plus className="mr-2 h-4 w-4" />
            Create Election
          </Button>
        </div>

        {error && (
          <AlertMessage variant="error">
            Failed to load elections. Please try again later.
          </AlertMessage>
        )}

        <ElectionList
          elections={electionsList}
          isLoading={isLoading}
          emptyMessage="No elections yet. Create your first election!"
          onElectionClick={(id) =>
            navigate({ to: '/admin/elections/$electionId', params: { electionId: id } })
          }
          getActionLabel={(e) => {
            if (e.status === 'DRAFT') return 'Set Up';
            if (e.status === 'ACTIVE') return 'Monitor';
            if (e.status === 'RESULTS_PUBLISHED') return 'View Results';
            return 'Manage';
          }}
        />
      </div>
    </AdminLayout>
  );
}
