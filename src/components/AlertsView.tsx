'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { SERVICES } from '@/lib/services';
import { AlertRule, IncidentSeverity } from '@/lib/types';
import PageHeader from './ui/PageHeader';
import Card from './ui/Card';

const SEVERITY_ORDER: IncidentSeverity[] = ['minor', 'major', 'critical'];
const RULES_API = '/api/alerts/rules';
const LEGACY_STORAGE_KEY = 'outage-map-alert-rules';

interface RulesResponse {
  rules: AlertRule[];
}

interface LegacyRule {
  id?: string;
  email?: string;
  services?: string[];
  minSeverity?: IncidentSeverity;
  channels?: { email?: boolean; desktop?: boolean };
  enabled?: boolean;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

interface TestFeedback {
  ruleId: string;
  tone: 'success' | 'error' | 'info';
  message: string;
}

function takeLegacyRules(): LegacyRule[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function AlertsView() {
  const { data, error, mutate, isLoading } = useSWR<RulesResponse>(RULES_API, fetcher, {
    revalidateOnFocus: false,
  });
  const rules = data?.rules ?? [];

  const [draft, setDraft] = useState<{
    email: string;
    services: string[];
    minSeverity: IncidentSeverity;
    emailEnabled: boolean;
    desktopEnabled: boolean;
  }>({
    email: '',
    services: [],
    minSeverity: 'major',
    emailEnabled: true,
    desktopEnabled: false,
  });
  const [showForm, setShowForm] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<TestFeedback | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // One-shot migration: lift any rules left in localStorage from the old
  // client-only implementation up into the server, then clear the key.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!data) return; // wait until current rules are known
    const legacy = takeLegacyRules();
    if (legacy.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const rule of legacy) {
        if (!rule.email) continue;
        try {
          await fetch(RULES_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: rule.email,
              services: rule.services ?? [],
              minSeverity: rule.minSeverity ?? 'major',
              emailEnabled: rule.channels?.email ?? true,
              enabled: rule.enabled ?? true,
            }),
          });
        } catch {
          /* best-effort migration */
        }
      }
      try { localStorage.removeItem(LEGACY_STORAGE_KEY); } catch { /* ignore */ }
      if (!cancelled) mutate();
    })();
    return () => { cancelled = true; };
  }, [data, mutate]);

  const toggleService = (slug: string) => {
    setDraft((d) => ({
      ...d,
      services: d.services.includes(slug)
        ? d.services.filter((s) => s !== slug)
        : [...d.services, slug],
    }));
  };

  const handleCreate = async () => {
    if (!draft.email.includes('@') || draft.services.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(RULES_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: draft.email.trim(),
          services: draft.services,
          minSeverity: draft.minSeverity,
          emailEnabled: draft.emailEnabled,
          enabled: true,
        }),
      });
      if (res.status === 503) {
        setSubmitError('Rules API is disabled on the server. Set ENABLE_RULES_API=true or configure CRON_SECRET.');
        return;
      }
      if (res.status === 401) {
        setSubmitError('Unauthorized. Send Bearer CRON_SECRET, or set ENABLE_RULES_API=true.');
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSubmitError(body.error || `Request failed (HTTP ${res.status})`);
        return;
      }
      setDraft({
        email: '',
        services: [],
        minSeverity: 'major',
        emailEnabled: true,
        desktopEnabled: false,
      });
      setShowForm(false);
      mutate();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleEnabled = async (rule: AlertRule) => {
    // Optimistic update — rollback on failure.
    const next = { rules: rules.map((r) => r.id === rule.id ? { ...r, enabled: !r.enabled } : r) };
    mutate(next, false);
    try {
      const res = await fetch(`${RULES_API}/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      mutate();
    } catch {
      mutate();
    }
  };

  const deleteRule = async (id: string) => {
    mutate({ rules: rules.filter((r) => r.id !== id) }, false);
    try {
      await fetch(`${RULES_API}/${id}`, { method: 'DELETE' });
      mutate();
    } catch {
      mutate();
    }
  };

  const requestDesktop = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      await Notification.requestPermission();
    }
  };

  const showFeedback = (entry: TestFeedback) => {
    setFeedback(entry);
    setTimeout(() => {
      setFeedback((current) => (current === entry ? null : current));
    }, 5000);
  };

  const sendTest = async (rule: AlertRule) => {
    setTesting(rule.id);
    const problems: string[] = [];
    let triggered = 0;

    if (typeof window !== 'undefined' && 'Notification' in window) {
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }
      if (permission === 'granted') {
        new Notification('Outage Dashboard · test notification', {
          body: `Test alert routed to ${rule.email}.`,
          tag: `test-${rule.id}`,
        });
        triggered++;
      }
    }

    if (rule.emailEnabled) {
      try {
        const res = await fetch('/api/alerts/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: rule.email }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          triggered++;
        } else if (data?.reason === 'smtp_not_configured') {
          problems.push('SMTP not configured on the server');
        } else if (data?.reason === 'invalid_email') {
          problems.push('invalid email address');
        } else {
          problems.push('email send failed');
        }
      } catch {
        problems.push('network error contacting the server');
      }
    }

    setTesting(null);

    if (problems.length === 0 && triggered > 0) {
      showFeedback({ ruleId: rule.id, tone: 'success', message: 'Test sent.' });
    } else if (triggered > 0) {
      showFeedback({ ruleId: rule.id, tone: 'info', message: `Partial: ${problems.join(', ')}.` });
    } else {
      showFeedback({ ruleId: rule.id, tone: 'error', message: problems.join(', ') || 'Test failed.' });
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Notifications"
        title="Alert subscriptions"
        description="Rules persist on the server and fire when matching incidents are detected. Set ENABLE_RULES_API=true (or send Bearer CRON_SECRET) to allow writes."
        actions={
          <button
            onClick={() => setShowForm((s) => !s)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:opacity-90 text-white text-sm font-medium transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New rule
          </button>
        }
      />

      {error && (
        <Card>
          <p className="text-sm text-red-400">Failed to load rules: {String((error as Error).message)}</p>
        </Card>
      )}

      {showForm && (
        <Card elevated className="animate-fade-in">
          <h3 className="text-sm font-semibold text-foreground mb-4">New alert rule</h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium text-muted mb-2" htmlFor="rule-email">Email destination</label>
              <input
                id="rule-email"
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                placeholder="team@company.com"
                className="w-full px-3 py-2 rounded-md bg-white/5 border border-subtle text-sm text-foreground placeholder:text-muted-strong focus:outline-none focus:border-accent/50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-2">Minimum severity</label>
              <div className="flex items-center gap-0.5 p-1 rounded-lg bg-surface border border-subtle">
                {SEVERITY_ORDER.map((s) => (
                  <button
                    key={s}
                    onClick={() => setDraft({ ...draft, minSeverity: s })}
                    aria-pressed={draft.minSeverity === s}
                    className={`flex-1 px-3 py-1.5 rounded-md text-xs capitalize transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      draft.minSeverity === s
                        ? 'bg-surface-elevated text-foreground font-semibold shadow-sm'
                        : 'font-medium text-muted hover:text-foreground'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-muted mb-2">
                Services ({draft.services.length} selected)
              </label>
              <div className="flex flex-wrap gap-2">
                {SERVICES.map((s) => {
                  const selected = draft.services.includes(s.slug);
                  return (
                    <button
                      key={s.slug}
                      onClick={() => toggleService(s.slug)}
                      aria-pressed={selected}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                        selected
                          ? 'border-accent bg-surface-elevated text-foreground shadow-sm'
                          : 'border-subtle text-muted hover:border-strong hover:text-foreground'
                      }`}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: s.color }}
                        role="presentation"
                      />
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-muted mb-2">Channels</label>
              <div className="flex flex-wrap gap-3">
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-subtle cursor-pointer hover:border-strong">
                  <input
                    type="checkbox"
                    checked={draft.emailEnabled}
                    onChange={(e) =>
                      setDraft({ ...draft, emailEnabled: e.target.checked })
                    }
                    className="accent-accent"
                  />
                  <span className="text-xs text-foreground">Email</span>
                </label>
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-subtle cursor-pointer hover:border-strong">
                  <input
                    type="checkbox"
                    checked={draft.desktopEnabled}
                    onChange={(e) => {
                      setDraft({ ...draft, desktopEnabled: e.target.checked });
                      if (e.target.checked) requestDesktop();
                    }}
                    className="accent-accent"
                  />
                  <span className="text-xs text-foreground">Desktop push (browser only)</span>
                </label>
              </div>
            </div>
          </div>

          {submitError && (
            <p className="text-xs text-red-400 mt-3">{submitError}</p>
          )}

          <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-subtle">
            <button
              onClick={() => { setShowForm(false); setSubmitError(null); }}
              className="px-4 py-2 rounded-md text-xs font-medium text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={submitting || !draft.email.includes('@') || draft.services.length === 0}
              className="px-4 py-2 rounded-md bg-accent hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-medium transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {submitting ? 'Saving…' : 'Save rule'}
            </button>
          </div>
        </Card>
      )}

      <section className="space-y-3">
        {isLoading ? (
          <Card className="text-center text-sm text-muted py-10">Loading rules…</Card>
        ) : rules.length === 0 ? (
          <Card className="text-center py-14">
            <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1">No alert rules yet</h3>
            <p className="text-xs text-muted max-w-sm mx-auto">
              Create your first rule to get notified the moment a monitored service degrades.
            </p>
          </Card>
        ) : (
          rules.map((r) => {
            const serviceNames = r.services.length === 0
              ? ['All services']
              : r.services
                  .map((slug) => SERVICES.find((s) => s.slug === slug)?.name)
                  .filter(Boolean);
            const ruleFeedback = feedback?.ruleId === r.id ? feedback : null;
            const isTesting = testing === r.id;
            return (
              <Card key={r.id} className="flex flex-col gap-3">
                <div className="flex items-center gap-4 flex-wrap">
                  <button
                    onClick={() => toggleEnabled(r)}
                    aria-label={`Toggle rule for ${r.email}`}
                    aria-pressed={r.enabled}
                    className={`relative w-11 h-6 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      r.enabled ? 'bg-accent' : 'bg-white/10'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                        r.enabled ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">{r.email}</span>
                      <span
                        className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          r.minSeverity === 'critical'
                            ? 'bg-red-500/10 text-red-400'
                            : r.minSeverity === 'major'
                              ? 'bg-orange-500/10 text-orange-400'
                              : 'bg-yellow-500/10 text-yellow-400'
                        }`}
                      >
                        {r.minSeverity}+
                      </span>
                      {r.emailEnabled && (
                        <span className="text-[10px] text-muted">· email</span>
                      )}
                    </div>
                    <p className="text-xs text-muted mt-1 truncate">
                      {serviceNames.join(', ')}
                    </p>
                  </div>
                  <button
                    onClick={() => sendTest(r)}
                    disabled={isTesting}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-subtle text-xs font-medium text-foreground hover:border-strong hover:bg-white/5 disabled:opacity-40 disabled:cursor-wait transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.125A59.769 59.769 0 0121.485 12 59.768 59.768 0 013.27 20.875L5.999 12zm0 0h7.5" />
                    </svg>
                    {isTesting ? 'Sending…' : 'Send test'}
                  </button>
                  <button
                    onClick={() => deleteRule(r.id)}
                    className="p-2 rounded-md text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    aria-label={`Delete rule for ${r.email}`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
                {ruleFeedback && (
                  <div
                    role="status"
                    className={`text-[11px] px-3 py-2 rounded-md border ${
                      ruleFeedback.tone === 'success'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : ruleFeedback.tone === 'error'
                          ? 'border-red-500/30 bg-red-500/10 text-red-300'
                          : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                    }`}
                  >
                    {ruleFeedback.message}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </section>
    </div>
  );
}
