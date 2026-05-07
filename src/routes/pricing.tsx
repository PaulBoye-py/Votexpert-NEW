import * as React from 'react';
import { createRoute, Link } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { Vote, Zap, Star, Check, X, Shield, Menu, ArrowRight, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/atoms';
import { APP_NAME } from '@/lib/constants';
import { PLANS, type PlanKey } from '@/api/services/payment.service';
import { useStore } from '@nanostores/react';
import { $isAuthenticated } from '@/stores';
import { cn } from '@/lib/utils';

export const pricingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pricing',
  component: PublicPricingPage,
});

function PublicPricingPage() {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const isAuthenticated = useStore($isAuthenticated);

  // If authenticated, plan cards link to admin pricing (where they can pay).
  // If not, they go to signup first.
  const ctaTarget = isAuthenticated ? '/admin/pricing' : '/admin/signup';

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
            <Link to="/" hash="how-it-works" className="hover:text-foreground transition-colors">How it works</Link>
            <Link to="/pricing" className="text-foreground font-medium transition-colors">Pricing</Link>
          </nav>

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

          <button
            type="button"
            className="md:hidden p-2 rounded-md text-muted-foreground hover:text-foreground"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-border bg-background px-4 py-4 space-y-3">
            <Link to="/" hash="features" className="block text-sm text-muted-foreground hover:text-foreground py-1" onClick={() => setMenuOpen(false)}>Features</Link>
            <Link to="/" hash="how-it-works" className="block text-sm text-muted-foreground hover:text-foreground py-1" onClick={() => setMenuOpen(false)}>How it works</Link>
            <Link to="/pricing" className="block text-sm text-foreground font-medium py-1" onClick={() => setMenuOpen(false)}>Pricing</Link>
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

      {/* ── Page header ───────────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 pt-16 pb-10 text-center space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary">
          <Zap className="h-3.5 w-3.5" />
          <span>Simple, per-election pricing</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
          Choose your plan
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          Pay only when you run an election. No monthly lock-ins, no hidden fees.
          Your first election is free.
        </p>
      </section>

      {/* ── Plan cards ────────────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 pb-20">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-start">
          {(Object.keys(PLANS) as PlanKey[]).map((planKey) => {
            const plan = PLANS[planKey];
            const isFeatured  = plan.badge === 'Most Popular';
            const isBestValue = plan.badge === 'Best Value';

            return (
              <div
                key={planKey}
                className={cn(
                  'relative flex flex-col rounded-xl border p-6 space-y-6 transition-shadow hover:shadow-md',
                  isFeatured  ? 'border-primary shadow-lg bg-primary/5'
                  : isBestValue ? 'border-amber-500/60 shadow-md bg-amber-500/5'
                  : 'border-border bg-card'
                )}
              >
                {plan.badge && (
                  <div className={cn(
                    'absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold text-white flex items-center gap-1 whitespace-nowrap',
                    isFeatured ? 'bg-primary' : 'bg-amber-500'
                  )}>
                    {isFeatured  && <Zap className="w-3 h-3" />}
                    {isBestValue && <Star className="w-3 h-3" />}
                    {plan.badge}
                  </div>
                )}

                <div className="space-y-1 pt-2">
                  <h2 className="text-lg font-bold text-foreground">{plan.name}</h2>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-foreground">{plan.priceLabel}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.subLabel}</p>
                </div>

                <div className="bg-muted/40 rounded-lg p-3 space-y-1 text-sm">
                  <p className="font-medium text-foreground">
                    {plan.maxPositions === Infinity ? 'Unlimited positions' : `Up to ${plan.maxPositions} positions`}
                  </p>
                  <p className="text-muted-foreground">
                    {plan.electionsPerMonth} election{plan.electionsPerMonth > 1 ? 's' : ''} / month
                  </p>
                  <p className="text-muted-foreground">{plan.dataRetention}</p>
                </div>

                <ul className="space-y-2 flex-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      {feature.included
                        ? <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                        : <X className="w-4 h-4 text-muted-foreground/40 mt-0.5 shrink-0" />}
                      <span className={feature.included ? 'text-foreground' : 'text-muted-foreground/50'}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={plan.ctaVariant}
                  className="w-full"
                  asChild
                >
                  <Link to={ctaTarget}>
                    {isAuthenticated ? plan.cta : planKey === 'free' ? 'Get Started Free' : 'Get Started'}
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Trust signals ─────────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 pb-16">
        <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: <Shield className="w-5 h-5 text-primary" />,          title: 'Secure Payments',    desc: 'All payments processed via Paystack — PCI-DSS compliant.' },
            { icon: <Check className="w-5 h-5 text-green-500" />,         title: 'Instant Activation', desc: 'Your plan activates immediately after a successful payment.' },
            { icon: <Zap className="w-5 h-5 text-amber-500" />,           title: 'No Hidden Fees',     desc: 'Pay per election only. No monthly subscriptions.' },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3 bg-card border border-border rounded-lg p-4">
              <div className="mt-0.5 shrink-0">{item.icon}</div>
              <div>
                <p className="font-semibold text-sm text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 pb-20">
        <div className="max-w-3xl mx-auto bg-card border border-border rounded-xl p-8 space-y-6">
          <h2 className="text-xl font-bold text-foreground text-center">Frequently asked questions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { q: 'Is the Free Plan really free?',             a: 'Yes — free forever. 1 election per month with up to 2 positions at no cost.' },
              { q: 'How does per-election pricing work?',       a: 'You pay once per election. No monthly fee — only pay when you need to run an election.' },
              { q: 'What happens when I hit my limit?',         a: "You'll be prompted to upgrade your plan or purchase an additional slot." },
              { q: 'Can I upgrade at any time?',                a: 'Yes. Upgrade to any higher plan from the pricing page inside your account.' },
              { q: 'What payment methods are accepted?',        a: 'Cards, bank transfers, and USSD via Paystack. All major Nigerian banks supported.' },
              { q: 'Is my payment information secure?',         a: 'All payments are processed by Paystack (PCI-DSS compliant). We never store card details.' },
            ].map((item) => (
              <div key={item.q} className="space-y-1">
                <p className="font-semibold text-sm text-foreground">{item.q}</p>
                <p className="text-sm text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ────────────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 pb-24">
        <div className="max-w-2xl mx-auto cta-banner-glow rounded-2xl border border-primary/20 p-8 sm:p-12 text-center space-y-5">
          <h2 className="text-2xl sm:text-3xl font-bold">Ready to run your first election?</h2>
          <p className="text-muted-foreground">Sign up in seconds. No credit card required for the Free Plan.</p>
          <Button size="lg" className="gap-2 px-8" asChild>
            <Link to="/admin/signup">
              Create your account
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

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
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Use</Link>
            <span>&copy; {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
