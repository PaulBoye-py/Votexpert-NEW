import * as React from 'react';
import { createRoute, Link } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { Vote, Shield, Zap, Eye, Lock, Globe, CheckCircle, ArrowRight, BarChart3, Users, Menu, X, LayoutDashboard } from 'lucide-react';
import { APP_NAME, APP_TAGLINE } from '@/lib/constants';
import { Button } from '@/components/atoms';
import { cn } from '@/lib/utils';
import { useStore } from '@nanostores/react';
import { $isAuthenticated } from '@/stores';

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
});

function HomePage() {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const isAuthenticated = useStore($isAuthenticated);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Vote className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">{APP_NAME}</span>
          </div>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <Button size="sm" asChild className="gap-1.5">
                <Link to="/admin/dashboard">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/admin/login">Admin Login</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/vote/join">Join an Election</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            type="button"
            className="md:hidden p-2 rounded-md text-muted-foreground hover:text-foreground"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-border bg-background px-4 py-4 space-y-3">
            <a href="#features" className="block text-sm text-muted-foreground hover:text-foreground py-1" onClick={() => setMenuOpen(false)}>Features</a>
            <a href="#how-it-works" className="block text-sm text-muted-foreground hover:text-foreground py-1" onClick={() => setMenuOpen(false)}>How it works</a>
            <div className="pt-2 flex flex-col gap-2">
              {isAuthenticated ? (
                <Button size="sm" className="w-full gap-1.5" asChild>
                  <Link to="/admin/dashboard" onClick={() => setMenuOpen(false)}>
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </Link>
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link to="/admin/login" onClick={() => setMenuOpen(false)}>Admin Login</Link>
                  </Button>
                  <Button size="sm" className="w-full" asChild>
                    <Link to="/vote/join" onClick={() => setMenuOpen(false)}>Join an Election</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative px-4 sm:px-6 pt-20 pb-24 sm:pt-28 sm:pb-32 text-center overflow-hidden">
        {/* Background glow */}
        <div className="hero-glow absolute inset-0 pointer-events-none" />

        <div className="relative max-w-4xl mx-auto space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary">
            <Zap className="h-3.5 w-3.5" />
            <span>Secure, real-time e-voting for organizations</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight tracking-tight">
            Run{' '}
            <span className="hero-headline-gradient">transparent</span>{' '}
            elections your organization trusts
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {APP_TAGLINE} From student unions to corporate boards — create elections, invite voters, and watch results come in live.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button size="lg" className="w-full sm:w-auto gap-2 px-8" asChild>
              <Link to="/vote/join">
                <Vote className="h-4 w-4" />
                Join an Election
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2 px-8" asChild>
              <Link to="/admin/login">
                <Shield className="h-4 w-4" />
                Admin Portal
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          {/* Social proof */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-4 text-sm text-muted-foreground">
            {[
              { icon: CheckCircle, text: 'No account needed to vote' },
              { icon: CheckCircle, text: 'Live results dashboard' },
              { icon: CheckCircle, text: 'Open & closed elections' },
            ].map(({ icon: Icon, text }) => (
              <span key={text} className="flex items-center gap-1.5">
                <Icon className="h-4 w-4 text-primary" />
                {text}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats bar ────────────────────────────────────────────────────────── */}
      <div className="border-y border-border bg-card/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { value: 'Real-time', label: 'Vote counting' },
            { value: '2 types', label: 'Open & Closed elections' },
            { value: 'Sequential', label: 'Position-by-position voting' },
            { value: 'Instant', label: 'Results publishing' },
          ].map(({ value, label }) => (
            <div key={label} className="space-y-1">
              <p className="text-2xl font-bold text-primary">{value}</p>
              <p className="text-sm text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Features ─────────────────────────────────────────────────────────── */}
      <section id="features" className="px-4 sm:px-6 py-20 sm:py-24">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-3xl sm:text-4xl font-bold">Everything you need to run a great election</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Built for organizations that take governance seriously.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Lock,
                title: 'Invite-only or open voting',
                desc: 'Run closed elections with invite tokens sent to verified voters, or open elections anyone can join with a link.',
                color: 'text-blue-400',
                bg: 'bg-blue-500/10',
              },
              {
                icon: Zap,
                title: 'Sequential positions',
                desc: 'Each position gets its own timed voting window. Voters move through them one by one — no skipping, no going back.',
                color: 'text-primary',
                bg: 'bg-primary/10',
              },
              {
                icon: BarChart3,
                title: 'Live statistics',
                desc: "Watch vote counts update in real-time on the admin dashboard. Auto-refreshes every 10 seconds during active elections.",
                color: 'text-purple-400',
                bg: 'bg-purple-500/10',
              },
              {
                icon: Eye,
                title: 'Transparent results',
                desc: 'Publish results publicly when ready. Voters and stakeholders get a clear breakdown with percentages and winners.',
                color: 'text-amber-400',
                bg: 'bg-amber-500/10',
              },
              {
                icon: Users,
                title: 'Voter management',
                desc: 'Import voter lists by email, track who has voted, and send invite emails in one click.',
                color: 'text-pink-400',
                bg: 'bg-pink-500/10',
              },
              {
                icon: Globe,
                title: 'No friction for voters',
                desc: "Voters don't need to create an account. Open elections use a session token. Closed elections use a link from their email.",
                color: 'text-teal-400',
                bg: 'bg-teal-500/10',
              },
            ].map(({ icon: Icon, title, desc, color, bg }) => (
              <div
                key={title}
                className="rounded-xl border border-border bg-card p-6 space-y-3 hover:border-primary/40 transition-colors"
              >
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', bg)}>
                  <Icon className={cn('h-5 w-5', color)} />
                </div>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="px-4 sm:px-6 py-20 sm:py-24 bg-card/30">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-3xl sm:text-4xl font-bold">Up and running in minutes</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">For admins and voters alike.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-10 lg:gap-16">
            {/* Admin steps */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <Shield className="h-4 w-4 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-semibold">For Admins</h3>
              </div>
              <ol className="space-y-5 relative before:absolute before:left-4 before:top-3 before:bottom-3 before:w-px before:bg-border">
                {[
                  { step: 1, title: 'Create an election', desc: 'Set a title, choose open or closed, toggle live results.' },
                  { step: 2, title: 'Add positions & candidates', desc: 'Define each position with a voting window and list the candidates.' },
                  { step: 3, title: 'Add voters (closed) or share the link (open)', desc: 'Import voter emails and send invite links, or share your public election URL.' },
                  { step: 4, title: 'Start, monitor, publish', desc: 'Launch with one click, watch live stats, then publish results when ready.' },
                ].map(({ step, title, desc }) => (
                  <li key={step} className="flex items-start gap-4 pl-2">
                    <div className="relative z-10 w-8 h-8 rounded-full border-2 border-primary bg-background flex items-center justify-center text-sm font-bold text-primary shrink-0">
                      {step}
                    </div>
                    <div className="pt-0.5">
                      <p className="font-medium text-sm">{title}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <Button asChild className="gap-2">
                <Link to="/admin/login">
                  Get started as Admin
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            {/* Voter steps */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <Vote className="h-4 w-4 text-secondary-foreground" />
                </div>
                <h3 className="text-xl font-semibold">For Voters</h3>
              </div>
              <ol className="space-y-5 relative before:absolute before:left-4 before:top-3 before:bottom-3 before:w-px before:bg-border">
                {[
                  { step: 1, title: 'Get your link', desc: 'Open elections: use the shared URL. Closed elections: check your invitation email.' },
                  { step: 2, title: 'Join in one click', desc: "No account, no password. Just open the link and you're in." },
                  { step: 3, title: 'Vote position by position', desc: 'Each position opens in sequence. Select your candidate and submit before time runs out.' },
                  { step: 4, title: 'See the results', desc: 'Once the admin publishes results, view the full breakdown instantly.' },
                ].map(({ step, title, desc }) => (
                  <li key={step} className="flex items-start gap-4 pl-2">
                    <div className="relative z-10 w-8 h-8 rounded-full border-2 border-muted-foreground/50 bg-background flex items-center justify-center text-sm font-bold text-muted-foreground shrink-0">
                      {step}
                    </div>
                    <div className="pt-0.5">
                      <p className="font-medium text-sm">{title}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <Button variant="outline" asChild className="gap-2">
                <Link to="/vote/join">
                  Join an election
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA banner ───────────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 py-20 sm:py-24">
        <div className="cta-banner-glow max-w-3xl mx-auto rounded-2xl border border-primary/20 p-8 sm:p-12 text-center space-y-5">
          <h2 className="text-3xl sm:text-4xl font-bold">Ready to run your first election?</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Sign up in seconds. No credit card required. Your first election is free.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button size="lg" className="w-full sm:w-auto gap-2 px-8" asChild>
              <Link to="/admin/signup">
                Create your account
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="ghost" className="w-full sm:w-auto" asChild>
              <Link to="/vote/join">I'm a voter</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border px-4 sm:px-6 py-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
              <Vote className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-semibold">{APP_NAME}</span>
          </div>
          <p className="text-sm text-muted-foreground text-center sm:text-right">
            Secure e-voting platform for organizations. &copy; {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
