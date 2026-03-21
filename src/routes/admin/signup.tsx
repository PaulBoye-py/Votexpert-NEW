import * as React from 'react';
import { createRoute, useNavigate, Link } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { rootRoute } from '../__root';
import { AuthLayout } from '@/components/templates';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms';
import { FormField, AlertMessage } from '@/components/molecules';
import { cognitoSignUp } from '@/api/services/cognito.service';
import { setPendingEmail } from '@/stores/auth.store';
import { Loader2 } from 'lucide-react';

export const adminSignupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/signup',
  component: AdminSignupPage,
});

function AdminSignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = React.useState({
    name: '',
    org_name: '',
    email: '',
    password: '',
    confirm_password: '',
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [apiError, setApiError] = React.useState<string | undefined>();

  const signupMutation = useMutation({
    mutationFn: () =>
      cognitoSignUp(form.email.trim(), form.password, form.name.trim(), form.org_name.trim()),
    onSuccess: () => {
      setPendingEmail(form.email.trim());
      navigate({ to: '/admin/otp' });
    },
    onError: (err: Error) => {
      setApiError(err.message);
    },
  });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Your name is required';
    if (!form.org_name.trim()) e.org_name = 'Organisation name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = 'Enter a valid email address';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 8) e.password = 'Minimum 8 characters';
    else if (!/[A-Z]/.test(form.password)) e.password = 'Must contain at least one uppercase letter';
    else if (!/[a-z]/.test(form.password)) e.password = 'Must contain at least one lowercase letter';
    else if (!/[0-9]/.test(form.password)) e.password = 'Must contain at least one number';
    if (form.password !== form.confirm_password)
      e.confirm_password = 'Passwords do not match';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    setApiError(undefined);
    if (validate()) signupMutation.mutate();
  };

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [key]: e.target.value })),
    error: errors[key],
    disabled: signupMutation.isPending,
  });

  return (
    <AuthLayout title="Admin Portal" subtitle="Create your organisation account">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create account</CardTitle>
          <CardDescription>
            Set up your organisation to start running elections
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {apiError && <AlertMessage variant="error">{apiError}</AlertMessage>}

            <FormField label="Your Name" type="text" placeholder="Jane Doe" {...field('name')} required />
            <FormField
              label="Organisation Name"
              type="text"
              placeholder="e.g. Acme Corp Student Union"
              {...field('org_name')}
              required
            />
            <FormField
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              {...field('email')}
              required
              autoComplete="email"
            />
            <FormField
              label="Password"
              type="password"
              placeholder="Min. 8 chars, uppercase, lowercase, number"
              {...field('password')}
              required
              autoComplete="new-password"
            />
            <FormField
              label="Confirm Password"
              type="password"
              placeholder="Repeat your password"
              {...field('confirm_password')}
              required
              autoComplete="new-password"
            />

            <Button type="submit" className="w-full" disabled={signupMutation.isPending}>
              {signupMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Account
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/admin/login" className="text-primary hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
