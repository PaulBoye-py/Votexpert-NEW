import { createRootRoute, Outlet } from '@tanstack/react-router';
import { ErrorBoundary } from '@/components/templates';
import { CookieBanner } from '@/components/organisms';
import { NotFoundPage } from './not-found';

export const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
});

function RootLayout() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground">
        <Outlet />
        <CookieBanner />
      </div>
    </ErrorBoundary>
  );
}