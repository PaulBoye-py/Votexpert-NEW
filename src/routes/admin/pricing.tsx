// src/routes/admin/pricing.tsx

import * as React from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { rootRoute } from '../__root';
import { AdminLayout } from '@/components/templates';
import { Button } from '@/components/atoms';
import { $user, $isAuthenticated, $isAdmin, logout } from '@/stores/auth.store';
import { useStore } from '@nanostores/react';
import { Check, X, Zap, Shield, Star } from 'lucide-react';
import { PLANS, type PlanKey, initializePayment } from '@/api/services/payment.service';
import { apiClient } from '@/api/client';
import type { Admin } from '@/types';

// ─── Route Definition ─────────────────────────────────────────────────────────

export const adminPricingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/pricing',
  component: AdminPricingPage,
});

// ─── Pricing Page ─────────────────────────────────────────────────────────────

function AdminPricingPage() {
  const navigate = useNavigate();
  const user = useStore($user) as Admin | null;
  const isAuthenticated = useStore($isAuthenticated);
  const isAdmin = useStore($isAdmin);

  const [loadingPlan, setLoadingPlan] = React.useState<PlanKey | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [orgId, setOrgId] = React.useState<string | null>(null);

  // ─── Auth Guard ───────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!isAuthenticated || !isAdmin) {
      navigate({ to: '/admin/login' });
    }
  }, [isAuthenticated, isAdmin, navigate]);

  // ─── Fetch Org ID ─────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!isAuthenticated) return;

    const fetchOrg = async () => {
      try {
        const response = await apiClient.get('/orgs/me');
        setOrgId(response.data.org_id);
      } catch (err) {
        console.error('Failed to fetch org:', err);
        setError('Failed to load your organisation details. Please refresh the page.');
      }
    };

    fetchOrg();
  }, [isAuthenticated]);

  if (!isAuthenticated || !isAdmin) return null;

  // ─── Handle Plan Selection ────────────────────────────────────────────────
  const handleSelectPlan = async (planKey: PlanKey) => {
    // Free plan — just go to dashboard
    if (planKey === 'free') {
      navigate({ to: '/admin/dashboard' });
      return;
    }

    if (!user?.email || !orgId) {
      setError('Unable to retrieve your organisation details. Please refresh the page.');
      return;
    }

    setLoadingPlan(planKey);
    setError(null);

    try {
      const plan = PLANS[planKey];

      const result = await initializePayment({
        email: user.email,
        amount: plan.amount,
        plan: plan.name,
        org_id: orgId as string,
      });

      // Redirect user to Paystack hosted payment page
      window.location.href = result.authorization_url;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Payment initialization failed. Please try again.';
      setError(message);
      setLoadingPlan(null);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <AdminLayout
      adminName={user?.name || 'Admin'}
      adminEmail={user?.email}
      orgName={user?.org_name}
      currentPath="/admin/pricing"
      onNavigate={(path) => navigate({ to: path })}
      onLogout={() => {
        logout();
        navigate({ to: '/admin/login' });
      }}
    >
      <div className="space-y-12">

        {/* ── Page Header ── */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold text-foreground">Choose Your Plan</h1>
          <p className="text-muted-foreground max-w-xl mx-auto text-base">
            Run secure, transparent elections with VoteXpert. Pay only per
            election — no monthly lock-ins, no hidden fees.
          </p>
        </div>

        {/* ── Error Message ── */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm text-center max-w-xl mx-auto">
            {error}
          </div>
        )}

        {/* ── Plan Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-start">
          {(Object.keys(PLANS) as PlanKey[]).map((planKey) => {
            const plan = PLANS[planKey];
            const isLoading = loadingPlan === planKey;
            const isFeatured = plan.badge === 'Most Popular';
            const isBestValue = plan.badge === 'Best Value';

            return (
              <div
                key={planKey}
                className={`relative flex flex-col rounded-xl border p-6 space-y-6 transition-shadow hover:shadow-md ${
                  isFeatured
                    ? 'border-primary shadow-lg bg-primary/5'
                    : isBestValue
                    ? 'border-amber-500/60 shadow-md bg-amber-500/5'
                    : 'border-border bg-card'
                }`}
              >
                {/* ── Badge ── */}
                {plan.badge && (
                  <div
                    className={`absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold text-white flex items-center gap-1 whitespace-nowrap ${
                      isFeatured ? 'bg-primary' : 'bg-amber-500'
                    }`}
                  >
                    {isFeatured && <Zap className="w-3 h-3" />}
                    {isBestValue && <Star className="w-3 h-3" />}
                    {plan.badge}
                  </div>
                )}

                {/* ── Plan Name & Price ── */}
                <div className="space-y-1 pt-2">
                  <h2 className="text-lg font-bold text-foreground">{plan.name}</h2>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-foreground">
                      {plan.priceLabel}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.subLabel}</p>
                </div>

                {/* ── Key Stats ── */}
                <div className="bg-muted/40 rounded-lg p-3 space-y-1 text-sm">
                  <p className="font-medium text-foreground">
                    {plan.maxPositions === Infinity
                      ? 'Unlimited positions'
                      : `Up to ${plan.maxPositions} positions`}
                  </p>
                  <p className="text-muted-foreground">
                    {plan.electionsPerMonth} election
                    {plan.electionsPerMonth > 1 ? 's' : ''} / month
                  </p>
                  <p className="text-muted-foreground">{plan.dataRetention}</p>
                </div>

                {/* ── Features List ── */}
                <ul className="space-y-2 flex-1">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      {feature.included ? (
                        <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                      ) : (
                        <X className="w-4 h-4 text-muted-foreground/40 mt-0.5 shrink-0" />
                      )}
                      <span
                        className={
                          feature.included
                            ? 'text-foreground'
                            : 'text-muted-foreground/50'
                        }
                      >
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* ── CTA Button ── */}
                <Button
                  variant={plan.ctaVariant}
                  className="w-full"
                  onClick={() => handleSelectPlan(planKey)}
                  disabled={loadingPlan !== null}
                >
                  {isLoading ? 'Redirecting to payment...' : plan.cta}
                </Button>
              </div>
            );
          })}
        </div>

        {/* ── How It Works ── */}
        <div className="bg-card border border-border rounded-xl p-8 space-y-6">
          <h2 className="text-xl font-bold text-foreground text-center">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            {[
              {
                step: '1',
                title: 'Choose a Plan',
                description: 'Select the plan that best fits your election size and requirements.',
              },
              {
                step: '2',
                title: 'Complete Payment',
                description: 'Pay securely via Paystack. Your plan activates immediately after payment.',
              },
              {
                step: '3',
                title: 'Run Your Election',
                description: 'Create positions, upload candidates, invite voters and go live.',
              },
            ].map((item) => (
              <div key={item.step} className="space-y-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-lg flex items-center justify-center mx-auto">
                  {item.step}
                </div>
                <h3 className="font-semibold text-foreground">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Trust Signals ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: <Shield className="w-5 h-5 text-primary" />,
              title: 'Secure Payments',
              description: 'All payments processed securely via Paystack — PCI-DSS compliant.',
            },
            {
              icon: <Check className="w-5 h-5 text-green-500" />,
              title: 'Instant Activation',
              description: 'Your plan activates immediately after a successful payment.',
            },
            {
              icon: <Zap className="w-5 h-5 text-amber-500" />,
              title: 'No Hidden Fees',
              description: 'Pay per election only. No monthly subscriptions or surprises.',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="flex items-start gap-3 bg-card border border-border rounded-lg p-4"
            >
              <div className="mt-0.5 shrink-0">{item.icon}</div>
              <div>
                <p className="font-semibold text-sm text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── FAQ ── */}
        <div className="bg-card border border-border rounded-xl p-8 space-y-6">
          <h2 className="text-xl font-bold text-foreground text-center">
            Frequently Asked Questions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                q: 'Is the Free Plan really free?',
                a: 'Yes! The Free Plan is completely free forever. You get 1 election per month with up to 2 positions at no cost.',
              },
              {
                q: 'How does per-election pricing work?',
                a: 'You pay once per election. There are no monthly subscriptions — you only pay when you need to run an election.',
              },
              {
                q: 'What happens when I reach my election limit?',
                a: 'You will be prompted to upgrade your plan or purchase an additional election slot to continue.',
              },
              {
                q: 'Can I upgrade my plan at any time?',
                a: 'Yes. You can upgrade to a higher plan at any time directly from this pricing page.',
              },
              {
                q: 'What payment methods are accepted?',
                a: 'We accept all major debit/credit cards, bank transfers, and USSD payments via Paystack.',
              },
              {
                q: 'Is my payment information secure?',
                a: 'Absolutely. All payments are processed by Paystack, a PCI-DSS compliant processor. We never store your card details.',
              },
            ].map((item) => (
              <div key={item.q} className="space-y-1">
                <p className="font-semibold text-sm text-foreground">{item.q}</p>
                <p className="text-sm text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Bottom CTA Banner ── */}
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-8 text-center space-y-4">
          <h2 className="text-xl font-bold text-foreground">
            Ready to run your first election?
          </h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Get started for free today. Upgrade whenever you need more power.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Button
              variant="default"
              onClick={() => handleSelectPlan('free')}
              disabled={loadingPlan !== null}
            >
              Start for Free
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSelectPlan('pro')}
              disabled={loadingPlan !== null}
            >
              View Pro Plan
            </Button>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}