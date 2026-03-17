import * as React from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { rootRoute } from '../__root';
import { AdminLayout } from '@/components/templates';
import { DataTable } from '@/components/organisms';
import { AlertMessage } from '@/components/molecules';
import { Button, Badge } from '@/components/atoms';
import { getAdminVoters } from '@/api/services/admin.service';
import { $user, $isAuthenticated, $isAdmin, logout } from '@/stores/auth.store';
import { useStore } from '@nanostores/react';
import { Plus } from 'lucide-react';
import type { Admin } from '@/types';

export const adminVotersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/voters',
  component: AdminVotersPage,
});

function AdminVotersPage() {
  const navigate = useNavigate();
  const user = useStore($user) as Admin | null;
  const isAuthenticated = useStore($isAuthenticated);
  const isAdmin = useStore($isAdmin);

  React.useEffect(() => {
    if (!isAuthenticated || !isAdmin) {
      navigate({ to: '/admin/login' });
    }
  }, [isAuthenticated, isAdmin, navigate]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'voters'],
    queryFn: getAdminVoters,
    enabled: isAuthenticated && isAdmin,
  });

  const handleLogout = () => {
    logout();
    navigate({ to: '/admin/login' });
  };

  const handleNavigate = (path: string) => {
    navigate({ to: path });
  };

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  type Voter = {
    voter_id: string;
    user_id?: string;
    name?: string;
    email?: string;
    election_id: string;
    has_voted: boolean;
    verified?: boolean;
    verification_status?: string;
  };

  const columns = [
    { key: 'voter_id' as const, header: 'Voter ID' },
    {
      key: 'name' as const,
      header: 'Name',
      render: (item: Voter) => item.name || item.user_id || '-'
    },
    {
      key: 'email' as const,
      header: 'Email',
      render: (item: Voter) => item.email || '-'
    },
    {
      key: 'has_voted' as const,
      header: 'Voted',
      render: (item: Voter) => (
        <Badge variant={item.has_voted ? 'default' : 'secondary'}>
          {item.has_voted ? 'Yes' : 'No'}
        </Badge>
      )
    },
    {
      key: 'verification_status' as const,
      header: 'Status',
      render: (item: Voter) => (
        <Badge variant={item.verification_status === 'verified' ? 'default' : 'outline'}>
          {item.verification_status || 'pending'}
        </Badge>
      )
    },
  ];

  return (
    <AdminLayout
      adminName={user?.username || 'Admin'}
      adminEmail={user?.email}
      currentPath="/admin/voters"
      onNavigate={handleNavigate}
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Voters</h1>
            <p className="text-muted-foreground">
              Manage all registered voters across elections
            </p>
          </div>
          <Button onClick={() => handleNavigate('/admin/elections/create')}>
            <Plus className="mr-2 h-4 w-4" />
            Add via Election
          </Button>
        </div>

        {error && (
          <AlertMessage variant="error">
            Failed to load voters. Please try again later.
          </AlertMessage>
        )}

        <DataTable
          columns={columns}
          data={data?.voters || []}
          keyField="voter_id"
          isLoading={isLoading}
          emptyMessage="No voters found. Add voters when creating an election."
        />
      </div>
    </AdminLayout>
  );
}
