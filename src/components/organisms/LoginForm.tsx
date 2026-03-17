import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms';
import { FormField, AlertMessage } from '@/components/molecules';
import { Loader2 } from 'lucide-react';

// Shared props for both login forms
interface BaseLoginFormProps {
  onSubmit: (data: Record<string, string>) => void;
  isLoading?: boolean;
  error?: string;
  className?: string;
}

// Admin Login Form
interface AdminLoginFormProps extends BaseLoginFormProps {
  variant: 'admin';
}

// Voter Login Form
interface VoterLoginFormProps extends BaseLoginFormProps {
  variant: 'voter';
}

type LoginFormProps = AdminLoginFormProps | VoterLoginFormProps;

export function LoginForm({
  variant,
  onSubmit,
  isLoading = false,
  error,
  className,
}: LoginFormProps) {
  const [formData, setFormData] = React.useState<Record<string, string>>(
    variant === 'admin'
      ? { username_or_email: '', password: '' }
      : { voter_id: '', email: '' }
  );
  const [formErrors, setFormErrors] = React.useState<Record<string, string>>({});

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    // Clear field error on change
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const { [field]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (variant === 'admin') {
      if (!formData.username_or_email?.trim()) {
        errors.username_or_email = 'Username or email is required';
      }
      if (!formData.password) {
        errors.password = 'Password is required';
      }
    } else {
      if (!formData.voter_id?.trim()) {
        errors.voter_id = 'Voter ID is required';
      }
      if (!formData.email?.trim()) {
        errors.email = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        errors.email = 'Please enter a valid email address';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  };

  const isAdmin = variant === 'admin';

  return (
    <Card className={cn('w-full max-w-md', className)}>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">
          {isAdmin ? 'Admin Login' : 'Voter Login'}
        </CardTitle>
        <CardDescription>
          {isAdmin
            ? 'Enter your credentials to access the admin dashboard'
            : 'Enter your voter ID and email to receive an OTP'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <AlertMessage variant="error" className="mb-4">
              {error}
            </AlertMessage>
          )}

          {isAdmin ? (
            <>
              <FormField
                label="Username or Email"
                type="text"
                placeholder="Enter username or email"
                value={formData.username_or_email || ''}
                onChange={handleChange('username_or_email')}
                error={formErrors.username_or_email}
                disabled={isLoading}
                required
                autoComplete="username"
              />
              <FormField
                label="Password"
                type="password"
                placeholder="Enter password"
                value={formData.password || ''}
                onChange={handleChange('password')}
                error={formErrors.password}
                disabled={isLoading}
                required
                autoComplete="current-password"
              />
            </>
          ) : (
            <>
              <FormField
                label="Voter ID"
                type="text"
                placeholder="e.g., VTR-2026-001234"
                value={formData.voter_id || ''}
                onChange={handleChange('voter_id')}
                error={formErrors.voter_id}
                disabled={isLoading}
                required
              />
              <FormField
                label="Email Address"
                type="email"
                placeholder="Enter your registered email"
                value={formData.email || ''}
                onChange={handleChange('email')}
                error={formErrors.email}
                disabled={isLoading}
                required
                autoComplete="email"
              />
            </>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isAdmin ? 'Login' : 'Send OTP'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

