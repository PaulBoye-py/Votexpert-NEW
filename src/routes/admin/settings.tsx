import * as React from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { rootRoute } from '../__root';
import { AdminLayout } from '@/components/templates';
import { Button, Input, Label } from '@/components/atoms';
import { AlertMessage } from '@/components/molecules';
import { $user, $isAuthenticated, $isAdmin, logout } from '@/stores/auth.store';
import { useStore } from '@nanostores/react';
import type { Admin } from '@/types';

export const adminSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/settings',
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  const navigate = useNavigate();
  const user = useStore($user) as Admin | null;
  const isAuthenticated = useStore($isAuthenticated);
  const isAdmin = useStore($isAdmin);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    if (!isAuthenticated || !isAdmin) {
      navigate({ to: '/admin/login' });
    }
  }, [isAuthenticated, isAdmin, navigate]);

  const handleLogout = () => {
    logout();
    navigate({ to: '/admin/login' });
  };

  const handleNavigate = (path: string) => {
    navigate({ to: path });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  return (
    <AdminLayout
      adminName={user?.username || 'Admin'}
      adminEmail={user?.email}
      currentPath="/admin/settings"
      onNavigate={handleNavigate}
      onLogout={handleLogout}
    >
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account and application settings
          </p>
        </div>

        {saved && (
          <AlertMessage variant="success">
            Settings saved successfully.
          </AlertMessage>
        )}

        <div className="bg-card border border-border rounded-lg p-6 space-y-6">
          <h2 className="text-lg font-semibold text-foreground">Profile Information</h2>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                defaultValue={user?.username || ''}
                placeholder="Enter username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                defaultValue={user?.email || ''}
                placeholder="Enter email"
              />
            </div>

            <Button type="submit">
              Save Changes
            </Button>
          </form>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 space-y-6">
          <h2 className="text-lg font-semibold text-foreground">Security</h2>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                placeholder="Enter current password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Enter new password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Confirm new password"
              />
            </div>

            <Button variant="outline">
              Update Password
            </Button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Danger Zone</h2>
          <p className="text-sm text-muted-foreground">
            Once you delete your account, there is no going back. Please be certain.
          </p>
          <Button variant="destructive">
            Delete Account
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
