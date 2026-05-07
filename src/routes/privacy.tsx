import * as React from 'react';
import { createRoute, Link } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { Vote, Menu, X, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/atoms';
import { APP_NAME } from '@/lib/constants';
import { useStore } from '@nanostores/react';
import { $isAuthenticated } from '@/stores';

export const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/privacy',
  component: PrivacyPage,
});

const LAST_UPDATED = 'May 7, 2026';

function PrivacyPage() {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const isAuthenticated = useStore($isAuthenticated);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ── Nav ───────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Vote className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">{APP_NAME}</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/" hash="features" className="hover:text-foreground transition-colors">Features</Link>
            <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <Button size="sm" asChild className="gap-1.5">
                <Link to="/admin/dashboard"><LayoutDashboard className="h-4 w-4" />Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild><Link to="/admin/login">Admin Login</Link></Button>
                <Button size="sm" asChild><Link to="/vote/join">Join an Election</Link></Button>
              </>
            )}
          </div>

          <button type="button" className="md:hidden p-2 rounded-md text-muted-foreground hover:text-foreground" onClick={() => setMenuOpen((v) => !v)} aria-label="Toggle menu">
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-border bg-background px-4 py-4 space-y-3">
            <Link to="/pricing" className="block text-sm text-muted-foreground hover:text-foreground py-1" onClick={() => setMenuOpen(false)}>Pricing</Link>
            <div className="pt-2 flex flex-col gap-2">
              <Button variant="outline" size="sm" className="w-full" asChild><Link to="/admin/login" onClick={() => setMenuOpen(false)}>Admin Login</Link></Button>
              <Button size="sm" className="w-full" asChild><Link to="/vote/join" onClick={() => setMenuOpen(false)}>Join an Election</Link></Button>
            </div>
          </div>
        )}
      </header>

      {/* ── Content ───────────────────────────────────────────────────────────── */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16 space-y-10">
        <div className="space-y-3">
          <h1 className="text-4xl font-extrabold tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
          <p className="text-muted-foreground leading-relaxed">
            {APP_NAME} ("we", "us", or "our") is committed to protecting your privacy. This policy
            explains what data we collect, how we use it, and your rights.
          </p>
        </div>

        <Section title="1. Information We Collect">
          <p>We collect information in the following ways:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong>Account data</strong> — name, organisation name, and email address when you register.</li>
            <li><strong>Usage data</strong> — pages visited, features used, device type, and browser, collected automatically via cookies and server logs.</li>
            <li><strong>Election data</strong> — elections, positions, candidates, and voter lists you create or upload.</li>
            <li><strong>Payment data</strong> — transaction reference and plan details. Card numbers are never stored; they are handled entirely by Paystack.</li>
            <li><strong>Voter data</strong> — email addresses and vote submissions provided by organisation admins for closed elections.</li>
          </ul>
        </Section>

        <Section title="2. How We Use Your Information">
          <ul className="list-disc pl-5 space-y-1">
            <li>To create and manage your account and organisation.</li>
            <li>To operate the election platform and deliver results.</li>
            <li>To process payments and activate your plan via Paystack.</li>
            <li>To send transactional emails (OTP codes, voter invites, payment confirmations).</li>
            <li>To improve the platform through anonymised usage analytics.</li>
            <li>To respond to support requests and enforce our Terms of Use.</li>
          </ul>
        </Section>

        <Section title="3. Cookies">
          <p>
            We use the following categories of cookies:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong>Necessary</strong> — session management and security. These cannot be disabled.</li>
            <li><strong>Analytics</strong> — anonymous traffic analysis to understand how the platform is used (e.g., page views). Only set with your consent.</li>
            <li><strong>Marketing</strong> — used to deliver relevant content. Only set with your consent.</li>
          </ul>
          <p className="mt-2">You can manage your cookie preferences at any time via the cookie banner shown at the bottom of each page.</p>
        </Section>

        <Section title="4. Data Sharing">
          <p>We do not sell your personal data. We share it only with:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong>Paystack</strong> — to process payments securely (PCI-DSS compliant).</li>
            <li><strong>AWS</strong> — cloud infrastructure for hosting, storage, and authentication (Cognito).</li>
            <li><strong>Email providers</strong> — to deliver transactional emails.</li>
            <li><strong>Legal authorities</strong> — when required by applicable law.</li>
          </ul>
        </Section>

        <Section title="5. Data Retention">
          <p>We retain your data for as long as your account is active, plus a reasonable period thereafter. Election data is retained according to the data retention period of your active plan (30 days for Free, up to 1 year for Standard Pro). You may request deletion of your data at any time by contacting us.</p>
        </Section>

        <Section title="6. Security">
          <p>We use industry-standard security measures including HTTPS, encrypted authentication tokens via AWS Cognito, and role-based access controls. However, no method of transmission over the internet is 100% secure.</p>
        </Section>

        <Section title="7. Your Rights">
          <p>Depending on your jurisdiction you may have the right to:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Access the personal data we hold about you.</li>
            <li>Request correction of inaccurate data.</li>
            <li>Request deletion of your data ("right to be forgotten").</li>
            <li>Object to or restrict certain processing.</li>
            <li>Data portability.</li>
          </ul>
          <p className="mt-2">To exercise any of these rights, contact us at the address below.</p>
        </Section>

        <Section title="8. Children's Privacy">
          <p>{APP_NAME} is not directed at children under 13. We do not knowingly collect personal data from children. If you believe a child has provided us with data, please contact us immediately.</p>
        </Section>

        <Section title="9. Changes to This Policy">
          <p>We may update this policy from time to time. We will notify you of material changes by email or by posting a notice on the platform. Continued use after changes constitutes acceptance.</p>
        </Section>

        <Section title="10. Contact Us">
          <p>If you have questions about this policy or wish to exercise your rights, please contact us at:</p>
          <p className="mt-2 font-medium text-foreground">{APP_NAME} — privacy@votexpert.online</p>
        </Section>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border px-4 sm:px-6 py-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
              <Vote className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-semibold">{APP_NAME}</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link to="/privacy" className="text-foreground font-medium transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Use</Link>
            <span>&copy; {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>

    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      <div className="text-muted-foreground leading-relaxed space-y-2 text-sm">
        {children}
      </div>
    </div>
  );
}
