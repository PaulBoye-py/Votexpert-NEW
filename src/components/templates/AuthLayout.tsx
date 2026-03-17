import * as React from 'react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/atoms';

interface AuthLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
}

export function AuthLayout({
  children,
  title,
  subtitle,
  className,
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?q=80&w=2070&auto=format&fit=crop')`,
        }}
      />

      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="py-6 px-4">
          <div className="container mx-auto">
            <Logo size="md" />
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 flex items-center justify-center px-4 py-8">
          <div className={cn('w-full max-w-md', className)}>
            {(title || subtitle) && (
              <div className="text-center mb-8">
                {title && (
                  <h1 className="text-3xl font-bold text-white drop-shadow-lg">{title}</h1>
                )}
                {subtitle && (
                  <p className="mt-2 text-gray-200 drop-shadow">{subtitle}</p>
                )}
              </div>
            )}
            {children}
          </div>
        </main>

        {/* Footer */}
        <footer className="py-4 px-4 border-t border-white/20">
          <div className="container mx-auto text-center text-sm text-gray-300">
            <p>&copy; {new Date().getFullYear()} VoteXpert. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
