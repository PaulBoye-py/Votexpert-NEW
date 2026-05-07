import * as React from 'react';
import { Link } from '@tanstack/react-router';
import { Cookie, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/atoms';

type Prefs = { necessary: true; analytics: boolean; marketing: boolean };

const STORAGE_KEY = 'votexpert_cookie_consent';

function loadPrefs(): Prefs | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function savePrefs(prefs: Prefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prefs, savedAt: new Date().toISOString() }));
}

export function CookieBanner() {
  const [visible, setVisible] = React.useState(false);
  const [granular, setGranular] = React.useState(false);
  const [analytics, setAnalytics] = React.useState(false);
  const [marketing, setMarketing] = React.useState(false);

  React.useEffect(() => {
    if (!loadPrefs()) setVisible(true);
  }, []);

  if (!visible) return null;

  const acceptAll = () => { savePrefs({ necessary: true, analytics: true, marketing: true }); setVisible(false); };
  const denyAll   = () => { savePrefs({ necessary: true, analytics: false, marketing: false }); setVisible(false); };
  const saveCustom = () => { savePrefs({ necessary: true, analytics, marketing }); setVisible(false); };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-3 sm:p-4">
      <div className="max-w-4xl mx-auto bg-card border border-border rounded-xl shadow-2xl p-4 sm:p-5 space-y-4">

        {/* Header */}
        <div className="flex items-start gap-3">
          <Cookie className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">We use cookies</span> — to improve
            your experience, analyse traffic, and for marketing. See our{' '}
            <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link> for details.
          </p>
        </div>

        {/* Granular preferences */}
        {granular && (
          <div className="border border-border rounded-lg divide-y divide-border text-sm">
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-medium text-foreground">Necessary</p>
                <p className="text-xs text-muted-foreground mt-0.5">Required for the site to function.</p>
              </div>
              <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded">Always on</span>
            </div>

            {([
              { key: 'analytics' as const, label: 'Analytics', desc: 'Help us understand how visitors use the site.', value: analytics, set: setAnalytics },
              { key: 'marketing' as const, label: 'Marketing',  desc: 'Used to deliver relevant content and ads.', value: marketing, set: setMarketing },
            ]).map(({ label, desc, value, set }) => (
              <div key={label} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
                <button
                  type="button"
                  aria-checked={value}
                  role="switch"
                  onClick={() => set((v) => !v)}
                  className={`relative w-10 h-5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${value ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setGranular((v) => !v)}
            className="gap-1.5 text-muted-foreground text-xs"
          >
            Manage preferences
            {granular ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
          {granular && (
            <Button variant="outline" size="sm" onClick={saveCustom}>Save preferences</Button>
          )}
          <Button variant="outline" size="sm" onClick={denyAll}>Deny all</Button>
          <Button size="sm" onClick={acceptAll}>Accept all</Button>
        </div>

      </div>
    </div>
  );
}
