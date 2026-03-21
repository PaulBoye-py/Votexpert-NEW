import * as React from 'react';
import { createRoute, useNavigate, Link } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { rootRoute } from '../__root';
import { AuthLayout } from '@/components/templates';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms';
import { FormField, AlertMessage } from '@/components/molecules';
import { cognitoSignIn, decodeIdToken } from '@/api/services/cognito.service';
import { setTokens, setUser } from '@/stores/auth.store';
import { Loader2 } from 'lucide-react';

export const adminLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/login',
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = React.useState({ email: '', password: '' });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [apiError, setApiError] = React.useState<string | undefined>();

  const loginMutation = useMutation({
    mutationFn: () => cognitoSignIn(form.email.trim(), form.password),
    onSuccess: (result) => {
      const claims = decodeIdToken(result.IdToken);
      if (!claims) {
        setApiError('Failed to read authentication token.');
        return;
      }
      setTokens({ accessToken: result.IdToken, refreshToken: result.RefreshToken });
      setUser({
        name: claims.name ?? claims.email,
        email: claims.email,
        org_name: claims['custom:org_name'] ?? '',
      });
      navigate({ to: '/admin/dashboard' });
    },
    onError: (err: Error) => {
      setApiError(err.message);
    },
  });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.email.trim()) e.email = 'Email is required';
    if (!form.password) e.password = 'Password is required';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    setApiError(undefined);
    if (validate()) loginMutation.mutate();
  };

  return (
    <AuthLayout title="Admin Portal" subtitle="Sign in to manage your elections">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>Enter your credentials to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {apiError && <AlertMessage variant="error">{apiError}</AlertMessage>}

            <FormField
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              error={errors.email}
              disabled={loginMutation.isPending}
              required
              autoComplete="email"
            />
            <FormField
              label="Password"
              type="password"
              placeholder="Enter your password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              error={errors.password}
              disabled={loginMutation.isPending}
              required
              autoComplete="current-password"
            />

            <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
              {loginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link to="/admin/signup" className="text-primary hover:underline font-medium">
                Create one
              </Link>
            </p>
            <p className="text-center text-sm text-muted-foreground">
              <Link to="/admin/forgot-password" className="text-primary hover:underline">
                Forgot password?
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
