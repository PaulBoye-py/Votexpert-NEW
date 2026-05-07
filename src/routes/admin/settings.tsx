import * as React from 'react';
import { createRoute, useNavigate, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { rootRoute } from '../__root';
import { AdminLayout } from '@/components/templates';
import { Button, Input, Label, Badge } from '@/components/atoms';
import { AlertMessage } from '@/components/molecules';
import { getOrgUsage } from '@/api/services/admin.service';
import { $user, $isAuthenticated, $isAdmin, logout } from '@/stores/auth.store';
import { useStore } from '@nanostores/react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
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
      adminName={user?.name || 'Admin'}
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
                defaultValue={user?.name || ''}
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

        {/* ── Plan & Usage ── */}
        <PlanUsageSection />

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

function PlanUsageSection() {
  const { data: usage, isLoading, error } = useQuery({
    queryKey: ['org-usage'],
    queryFn: () => getOrgUsage(),
  });

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Plan & Usage</h2>
        <div className="h-12 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (error || !usage) {
    return null;
  }

  const planName = usage.plan.charAt(0).toUpperCase() + usage.plan.slice(1).replace('_', ' ');
  const usagePercent = (usage.electionsThisMonth / usage.electionsLimit) * 100;
  const isNearLimit = usagePercent >= 80;
  const isAtLimit = usage.atLimit;

  return (
    <div className={cn(
      'border border-border rounded-lg p-6 space-y-6',
      isAtLimit ? 'bg-amber-500/5' : 'bg-card'
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">Plan & Usage</h2>
          <p className="text-sm text-muted-foreground">
            Current plan and monthly election usage
          </p>
        </div>
        <Badge variant={usage.plan === 'free' ? 'default' : 'secondary'}>
          {planName}
        </Badge>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Elections This Month</p>
            <p className="text-sm font-semibold text-foreground">
              {usage.electionsThisMonth} of {usage.electionsLimit}
            </p>
          </div>
          <div className="h-2 rounded-full bg-muted-foreground/20 overflow-hidden">
            <div
              className={cn(
                'h-full transition-all',
                isAtLimit ? 'bg-destructive' : isNearLimit ? 'bg-amber-500' : 'bg-green-500'
              )}
              style={{ width: `${Math.min(100, usagePercent)}%` }}
            />
          </div>
          {usage.electionsRemaining > 0 && (
            <p className="text-xs text-muted-foreground">
              {usage.electionsRemaining} election{usage.electionsRemaining !== 1 ? 's' : ''} remaining this month
            </p>
          )}
        </div>

        {isAtLimit && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 space-y-2">
            <p className="text-sm font-medium text-amber-900">You've reached your limit</p>
            <p className="text-xs text-amber-800">
              Upgrade your plan to create more elections and unlock additional features.
            </p>
          </div>
        )}

        {isNearLimit && !isAtLimit && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-4 py-3 space-y-2">
            <p className="text-sm font-medium text-blue-900">Getting close to your limit</p>
            <p className="text-xs text-blue-800">
              You have {usage.electionsRemaining} election{usage.electionsRemaining !== 1 ? 's' : ''} left. Consider upgrading for more capacity.
            </p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button asChild className="gap-2">
            <Link to="/admin/pricing">
              {usage.plan === 'free' ? 'Upgrade Plan' : 'Change Plan'}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/admin/elections">View Elections</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
