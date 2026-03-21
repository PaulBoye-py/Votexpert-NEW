/**
 * /admin/forgot-password — Two-step password reset via Cognito.
 *
 * Step 1: Enter email → Cognito sends a reset code
 * Step 2: Enter the code + new password → password updated → redirect to login
 */
import * as React from 'react';
import { createRoute, useNavigate, Link } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { rootRoute } from '../__root';
import { AuthLayout } from '@/components/templates';
import {
  Button, Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/atoms';
import { FormField, AlertMessage } from '@/components/molecules';
import {
  cognitoForgotPassword, cognitoConfirmForgotPassword,
} from '@/api/services/cognito.service';
import { Loader2, CheckCircle, Mail, KeyRound } from 'lucide-react';

export const adminForgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/forgot-password',
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = React.useState<'email' | 'reset' | 'done'>('email');
  const [email, setEmail] = React.useState('');
  const [code, setCode] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [passwordConfirm, setPasswordConfirm] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [apiError, setApiError] = React.useState<string | undefined>();

  // Step 1: send reset code
  const sendMutation = useMutation({
    mutationFn: () => cognitoForgotPassword(email.trim()),
    onSuccess: () => { setApiError(undefined); setStep('reset'); },
    onError: (err: Error) => setApiError(err.message),
  });

  // Step 2: confirm reset
  const resetMutation = useMutation({
    mutationFn: () =>
      cognitoConfirmForgotPassword(email.trim(), code.trim(), password),
    onSuccess: () => { setApiError(undefined); setStep('done'); },
    onError: (err: Error) => setApiError(err.message),
  });

  const validateEmail = () => {
    const e: Record<string, string> = {};
    if (!email.trim()) e.email = 'Email is required';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const validateReset = () => {
    const e: Record<string, string> = {};
    if (!code.trim()) e.code = 'Reset code is required';
    if (password.length < 8) e.password = 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(password)) e.password = 'Must include an uppercase letter';
    if (!/[a-z]/.test(password)) e.password = 'Must include a lowercase letter';
    if (!/[0-9]/.test(password)) e.password = 'Must include a number';
    if (password !== passwordConfirm) e.passwordConfirm = 'Passwords do not match';
    setErrors(e);
    return !Object.keys(e).length;
  };

  return (
    <AuthLayout title="Admin Portal" subtitle="Reset your password">
      <Card className="w-full max-w-md">
        {step === 'email' && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl">Forgot your password?</CardTitle>
              <CardDescription>
                Enter your email and we'll send a reset code.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {apiError && <AlertMessage variant="error">{apiError}</AlertMessage>}
              <FormField
                label="Email Address"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
                disabled={sendMutation.isPending}
                required
                autoComplete="email"
              />
              <Button
                className="w-full"
                disabled={sendMutation.isPending}
                onClick={() => { setApiError(undefined); if (validateEmail()) sendMutation.mutate(); }}
              >
                {sendMutation.isPending
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…</>
                  : 'Send Reset Code'}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                <Link to="/admin/login" className="text-primary hover:underline">
                  Back to sign in
                </Link>
              </p>
            </CardContent>
          </>
        )}

        {step === 'reset' && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <KeyRound className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl">Enter reset code</CardTitle>
              <CardDescription>
                We sent a code to <span className="font-medium text-foreground">{email}</span>. Check your inbox.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {apiError && <AlertMessage variant="error">{apiError}</AlertMessage>}
              <FormField
                label="Reset Code"
                type="text"
                placeholder="6-digit code from email"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                error={errors.code}
                disabled={resetMutation.isPending}
                required
                autoComplete="one-time-code"
              />
              <FormField
                label="New Password"
                type="password"
                placeholder="Min 8 chars, upper, lower, number"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                disabled={resetMutation.isPending}
                required
                autoComplete="new-password"
              />
              <FormField
                label="Confirm New Password"
                type="password"
                placeholder="Repeat your new password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                error={errors.passwordConfirm}
                disabled={resetMutation.isPending}
                required
                autoComplete="new-password"
              />
              <Button
                className="w-full"
                disabled={resetMutation.isPending}
                onClick={() => { setApiError(undefined); if (validateReset()) resetMutation.mutate(); }}
              >
                {resetMutation.isPending
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resetting…</>
                  : 'Reset Password'}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Didn't receive it?{' '}
                <button
                  type="button"
                  onClick={() => { setApiError(undefined); sendMutation.mutate(); }}
                  disabled={sendMutation.isPending}
                  className="text-primary hover:underline"
                >
                  Resend code
                </button>
              </p>
            </CardContent>
          </>
        )}

        {step === 'done' && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-xl text-green-600 dark:text-green-400">Password reset!</CardTitle>
              <CardDescription>Your password has been updated successfully.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => navigate({ to: '/admin/login' })}>
                Sign in with new password
              </Button>
            </CardContent>
          </>
        )}
      </Card>
    </AuthLayout>
  );
}
