import * as React from 'react';
import { createRoute, Link } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { Vote, Menu, X, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/atoms';
import { APP_NAME } from '@/lib/constants';
import { useStore } from '@nanostores/react';
import { $isAuthenticated } from '@/stores';

export const termsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/terms',
  component: TermsPage,
});

const LAST_UPDATED = 'May 7, 2026';

function TermsPage() {
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
          <h1 className="text-4xl font-extrabold tracking-tight">Terms of Use</h1>
          <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
          <p className="text-muted-foreground leading-relaxed">
            Please read these Terms of Use ("Terms") carefully before using the {APP_NAME} platform
            operated by {APP_NAME} ("we", "us", "our"). By creating an account or using the service
            you agree to be bound by these Terms.
          </p>
        </div>

        <Section title="1. Acceptance of Terms">
          <p>By accessing or using {APP_NAME}, you confirm that you are at least 18 years old (or the age of majority in your jurisdiction), have the authority to bind the organisation you represent, and accept these Terms in full. If you do not agree, do not use the platform.</p>
        </Section>

        <Section title="2. Description of Service">
          <p>{APP_NAME} is a cloud-based electronic voting platform that allows organisations to create, manage, and run elections with real-time results. The service includes election management, voter management, live results, and plan-based access tiers.</p>
        </Section>

        <Section title="3. Account Registration">
          <ul className="list-disc pl-5 space-y-1">
            <li>You must provide accurate and complete information when registering.</li>
            <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
            <li>You are responsible for all activities that occur under your account.</li>
            <li>You must notify us immediately of any unauthorised use of your account.</li>
            <li>One account per organisation. Multiple accounts for the same organisation are not permitted.</li>
          </ul>
        </Section>

        <Section title="4. Permitted Use">
          <p>You may use {APP_NAME} only for lawful purposes and in accordance with these Terms. You agree not to:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Use the platform for any unlawful, fraudulent, or deceptive elections.</li>
            <li>Attempt to manipulate, tamper with, or interfere with election results.</li>
            <li>Upload voter data you are not authorised to process.</li>
            <li>Reverse-engineer, decompile, or attempt to extract the source code of the platform.</li>
            <li>Transmit malware, viruses, or any code of a destructive nature.</li>
            <li>Violate the privacy rights of voters or other users.</li>
          </ul>
        </Section>

        <Section title="5. Payment Terms">
          <ul className="list-disc pl-5 space-y-1">
            <li>All paid plans are charged on a per-election basis with no recurring subscription.</li>
            <li>Payments are processed by Paystack. By making a payment you agree to Paystack's terms.</li>
            <li>Plan activation occurs immediately upon confirmed payment.</li>
            <li>All fees are non-refundable except where required by applicable law.</li>
            <li>We reserve the right to change plan pricing with reasonable notice.</li>
          </ul>
        </Section>

        <Section title="6. Data and Privacy">
          <p>Your use of the platform is also governed by our <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>, which is incorporated into these Terms. You are responsible for ensuring you have the appropriate legal basis to upload and process voter data on the platform.</p>
        </Section>

        <Section title="7. Intellectual Property">
          <p>{APP_NAME} and its content, features, and functionality are owned by us and are protected by copyright, trademark, and other intellectual property laws. You retain ownership of the election data you create. You grant us a limited licence to process that data solely for the purpose of providing the service.</p>
        </Section>

        <Section title="8. Disclaimers and Limitation of Liability">
          <p>The platform is provided "as is" without warranties of any kind. To the maximum extent permitted by law:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>We do not warrant that the service will be uninterrupted, error-free, or completely secure.</li>
            <li>We are not liable for the outcome of any election conducted on the platform.</li>
            <li>Our total liability for any claim shall not exceed the amount you paid us in the three months preceding the claim.</li>
            <li>We are not liable for indirect, incidental, special, consequential, or punitive damages.</li>
          </ul>
        </Section>

        <Section title="9. Termination">
          <p>We may suspend or terminate your account at any time if you violate these Terms. You may delete your account at any time from your account settings. Upon termination, your data will be retained per our Privacy Policy and then deleted.</p>
        </Section>

        <Section title="10. Governing Law">
          <p>These Terms are governed by and construed in accordance with the laws of the Federal Republic of Nigeria. Any disputes shall be resolved in the competent courts of Nigeria.</p>
        </Section>

        <Section title="11. Changes to These Terms">
          <p>We may update these Terms at any time. Material changes will be communicated via email or an in-app notice. Continued use of the platform after changes take effect constitutes acceptance of the revised Terms.</p>
        </Section>

        <Section title="12. Contact Us">
          <p>For questions about these Terms, contact us at:</p>
          <p className="mt-2 font-medium text-foreground">{APP_NAME} — legal@votexpert.online</p>
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
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="text-foreground font-medium transition-colors">Terms of Use</Link>
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
