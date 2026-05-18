'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { useServiceStatus, useAlertLog } from '@/hooks/useStatus';
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
  const { data: statusData } = useServiceStatus();
  const services = statusData?.services ?? [];

  const [draft, setDraft] = useState<{
    email: string;
    services: string[];
    minSeverity: IncidentSeverity;
    emailEnabled: boolean;
    desktopEnabled: boolean;
    webhookUrl: string;
    webhookEnabled: boolean;
  }>({
    email: '',
    services: [],
    minSeverity: 'major',
    emailEnabled: true,
    desktopEnabled: false,
    webhookUrl: '',
    webhookEnabled: false,
  });
  const [showForm, setShowForm] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<TestFeedback | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<typeof draft | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const { data: logData } = useAlertLog(logOpen);

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
      const webhookUrlTrimmed = draft.webhookUrl.trim();
      const res = await fetch(RULES_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: draft.email.trim(),
          services: draft.services,
          minSeverity: draft.minSeverity,
          emailEnabled: draft.emailEnabled,
          webhookUrl: webhookUrlTrimmed || undefined,
          webhookEnabled: draft.webhookEnabled && !!webhookUrlTrimmed,
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
        webhookUrl: '',
        webhookEnabled: false,
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

  const startEdit = (rule: AlertRule) => {
    setEditingId(rule.id);
    setEditDraft({
      email: rule.email,
      services: rule.services ?? [],
      minSeverity: rule.minSeverity,
      emailEnabled: rule.emailEnabled ?? true,
      desktopEnabled: false,
      webhookUrl: rule.webhookUrl ?? '',
      webhookEnabled: rule.webhookEnabled ?? false,
    });
  };

  const handleSave = async (id: string) => {
    if (!editDraft) return;
    const webhookUrlTrimmed = editDraft.webhookUrl.trim();
    try {
      const res = await fetch(`${RULES_API}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          services: editDraft.services,
          minSeverity: editDraft.minSeverity,
          emailEnabled: editDraft.emailEnabled,
          webhookUrl: webhookUrlTrimmed || undefined,
          webhookEnabled: editDraft.webhookEnabled && !!webhookUrlTrimmed,
        }),
      });
      if (res.ok) {
        setEditingId(null);
        setEditDraft(null);
        mutate();
      }
    } catch {
      /* ignore */
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
                {services.map((s) => {
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

            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-muted mb-2">Webhook URL <span className="text-muted-strong font-normal">(optional — Slack, Teams, or any HTTP endpoint)</span></label>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={draft.webhookUrl}
                  onChange={(e) => setDraft({ ...draft, webhookUrl: e.target.value, webhookEnabled: draft.webhookEnabled && !!e.target.value.trim() })}
                  placeholder="https://hooks.slack.com/services/..."
                  className="flex-1 px-3 py-2 rounded-md bg-white/5 border border-subtle text-sm text-foreground placeholder:text-muted-strong focus:outline-none focus:border-accent/50"
                />
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-subtle cursor-pointer hover:border-strong whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={draft.webhookEnabled}
                    disabled={!draft.webhookUrl.trim() || !/^https?:\/\//i.test(draft.webhookUrl.trim())}
                    onChange={(e) => setDraft({ ...draft, webhookEnabled: e.target.checked })}
                    className="accent-accent"
                  />
                  <span className="text-xs text-foreground">Enable</span>
                </label>
              </div>
              {draft.webhookUrl.trim() && !/^https?:\/\//i.test(draft.webhookUrl.trim()) && (
                <p className="text-[11px] text-red-400 mt-1">URL must start with https://</p>
              )}
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
                  .map((slug) => services.find((s) => s.slug === slug)?.name)
                  .filter(Boolean);
            const ruleFeedback = feedback?.ruleId === r.id ? feedback : null;
            const isTesting = testing === r.id;
            return (
              <Card key={r.id} className="flex flex-col gap-3">
                <div className="flex items-center gap-4 flex-wrap">
                  <button
                    role="switch"
                    aria-checked={r.enabled}
                    onClick={() => toggleEnabled(r)}
                    aria-label={`Toggle rule for ${r.email}`}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      r.enabled ? 'bg-accent' : 'bg-white/10'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                        r.enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
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
                      {r.webhookEnabled && r.webhookUrl && (
                        <span className="text-[10px] text-muted" title={r.webhookUrl}>
                          · webhook ({(() => { try { return new URL(r.webhookUrl).hostname; } catch { return r.webhookUrl.slice(0, 30); } })()})
                        </span>
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
                    onClick={() => editingId === r.id ? (setEditingId(null), setEditDraft(null)) : startEdit(r)}
                    className="p-2 rounded-md text-muted hover:text-accent-cyan hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    aria-label={`Edit rule for ${r.email}`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                    </svg>
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
                {editingId === r.id && editDraft && (
                  <div className="mt-3 pt-3 border-t border-subtle space-y-4">
                    <p className="text-xs text-muted">Editing rule for <span className="text-foreground font-medium">{r.email}</span></p>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-muted mb-1.5">Minimum severity</label>
                        <div className="flex items-center gap-0.5 p-1 rounded-lg bg-surface border border-subtle">
                          {SEVERITY_ORDER.map((s) => (
                            <button
                              key={s}
                              onClick={() => setEditDraft({ ...editDraft, minSeverity: s })}
                              aria-pressed={editDraft.minSeverity === s}
                              className={`flex-1 px-3 py-1.5 rounded-md text-xs capitalize transition-all duration-150 ${
                                editDraft.minSeverity === s
                                  ? 'bg-surface-elevated text-foreground font-semibold shadow-sm'
                                  : 'font-medium text-muted hover:text-foreground'
                              }`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted mb-1.5">Channels</label>
                        <div className="flex flex-wrap gap-2">
                          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-subtle cursor-pointer hover:border-strong">
                            <input type="checkbox" checked={editDraft.emailEnabled}
                              onChange={(e) => setEditDraft({ ...editDraft, emailEnabled: e.target.checked })}
                              className="accent-accent" />
                            <span className="text-xs text-foreground">Email</span>
                          </label>
                        </div>
                      </div>
                      <div className="lg:col-span-2">
                        <label className="block text-xs font-medium text-muted mb-1.5">Services ({editDraft.services.length} selected)</label>
                        <div className="flex flex-wrap gap-2">
                          {services.map((s) => {
                            const sel = editDraft.services.includes(s.slug);
                            return (
                              <button
                                key={s.slug}
                                onClick={() => setEditDraft({
                                  ...editDraft,
                                  services: sel
                                    ? editDraft.services.filter((x) => x !== s.slug)
                                    : [...editDraft.services, s.slug],
                                })}
                                aria-pressed={sel}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                  sel ? 'border-accent bg-surface-elevated text-foreground' : 'border-subtle text-muted hover:border-strong'
                                }`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                                {s.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="lg:col-span-2">
                        <label className="block text-xs font-medium text-muted mb-1.5">Webhook URL</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="url"
                            value={editDraft.webhookUrl}
                            onChange={(e) => setEditDraft({ ...editDraft, webhookUrl: e.target.value })}
                            placeholder="https://hooks.slack.com/..."
                            className="flex-1 px-3 py-2 rounded-md bg-white/5 border border-subtle text-sm text-foreground placeholder:text-muted-strong focus:outline-none focus:border-accent/50"
                          />
                          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-subtle cursor-pointer hover:border-strong whitespace-nowrap">
                            <input type="checkbox" checked={editDraft.webhookEnabled}
                              disabled={!editDraft.webhookUrl.trim() || !/^https?:\/\//i.test(editDraft.webhookUrl.trim())}
                              onChange={(e) => setEditDraft({ ...editDraft, webhookEnabled: e.target.checked })}
                              className="accent-accent" />
                            <span className="text-xs text-foreground">Enable</span>
                          </label>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-subtle">
                      <button
                        onClick={() => { setEditingId(null); setEditDraft(null); }}
                        className="px-4 py-2 rounded-md text-xs font-medium text-muted hover:text-foreground"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSave(r.id)}
                        className="px-4 py-2 rounded-md bg-accent hover:opacity-90 text-white text-xs font-medium transition-opacity"
                      >
                        Save changes
                      </button>
                    </div>
                  </div>
                )}
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

      <section>
        <button
          onClick={() => setLogOpen((o) => !o)}
          className="inline-flex items-center gap-2 text-xs font-medium text-muted hover:text-foreground transition-colors mb-3"
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform ${logOpen ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          Alert history
        </button>
        {logOpen && (
          <Card padded={false} className="overflow-hidden">
            {!logData ? (
              <p className="px-5 py-4 text-xs text-muted">Loading…</p>
            ) : logData.log.length === 0 ? (
              <p className="px-5 py-4 text-xs text-muted">No alerts have been sent yet.</p>
            ) : (
              <ul className="divide-y divide-white/[0.04]">
                {logData.log.map((entry) => {
                  const dotColor = entry.alert_type === 'email' ? '#268bd2'
                    : entry.alert_type === 'webhook' ? '#6c71c4'
                    : '#2aa198';
                  const ts = new Date(entry.sent_at);
                  const diffMs = Date.now() - ts.getTime();
                  const diffMin = Math.floor(diffMs / 60000);
                  const timeLabel = diffMin < 60 ? `${diffMin}m ago`
                    : diffMin < 1440 ? `${Math.floor(diffMin / 60)}h ago`
                    : `${Math.floor(diffMin / 1440)}d ago`;
                  return (
                    <li key={entry.id} className="flex items-center gap-3 px-5 py-2.5 text-xs">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
                      <span className="text-muted-strong tabular-nums w-16 flex-shrink-0">{timeLabel}</span>
                      <span className="text-foreground font-medium">{entry.service_slug}</span>
                      <span className="text-muted">·</span>
                      <span className="text-muted">{entry.alert_type}</span>
                      {entry.incident_id && (
                        <span className="ml-auto text-muted text-[10px] tabular-nums">#{entry.incident_id.slice(0, 8)}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        )}
      </section>
    </div>
  );
}
