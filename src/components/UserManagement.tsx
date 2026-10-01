'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useSession } from '@/hooks/useSession';
import Card from './ui/Card';

interface UserEntry {
  id: string;
  email: string;
  role: 'admin' | 'viewer';
  createdAt: string;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/**
 * Admin-only account management. Rendered by SettingsView only when the
 * current session's role is 'admin' — the API routes it calls enforce the
 * same restriction independently (isAuthorized), so this is a UI
 * convenience, not the actual access boundary.
 */
export default function UserManagement() {
  const { user: me } = useSession();
  const { data, mutate, error } = useSWR<{ users: UserEntry[] }>('/api/auth/users', fetcher, {
    revalidateOnFocus: false,
  });
  const [draft, setDraft] = useState({ email: '', password: '', role: 'viewer' as 'admin' | 'viewer' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(body.error || `Request failed (HTTP ${res.status})`);
        return;
      }
      setDraft({ email: '', password: '', role: 'viewer' });
      await mutate();
    } catch {
      setFormError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const changeRole = async (id: string, role: 'admin' | 'viewer') => {
    await fetch(`/api/auth/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    await mutate();
  };

  const removeUser = async (id: string) => {
    if (!confirm('Delete this account? They will be logged out immediately.')) return;
    await fetch(`/api/auth/users/${id}`, { method: 'DELETE' });
    await mutate();
  };

  return (
    <Card>
      <h3 className="text-sm font-semibold text-foreground mb-1">Team accounts</h3>
      <p className="text-[11px] text-muted mb-4">
        Admins can manage alert rules, maintenance windows, and sources. Viewers can log in but can&apos;t change anything.
      </p>

      {error && <p className="text-xs text-red-400 mb-3">Failed to load accounts.</p>}

      {data && (
        <ul className="divide-y divide-white/[0.04] mb-4">
          {data.users.map((u) => (
            <li key={u.id} className="flex items-center gap-3 py-2 text-xs">
              <span className="text-foreground flex-1 min-w-0 truncate">{u.email}</span>
              <select
                value={u.role}
                onChange={(e) => changeRole(u.id, e.target.value as 'admin' | 'viewer')}
                className="px-2 py-1 rounded-md bg-white/5 border border-subtle text-xs text-foreground focus:outline-none focus:border-accent/50"
              >
                <option value="viewer">Viewer</option>
                <option value="admin">Admin</option>
              </select>
              <button
                onClick={() => removeUser(u.id)}
                disabled={u.email === me?.email}
                title={u.email === me?.email ? "You can't delete your own account" : 'Delete account'}
                className="text-muted hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors p-1"
                aria-label={`Delete ${u.email}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 pt-3 border-t border-subtle">
        <div className="flex-1 min-w-[160px]">
          <label className="block text-[11px] text-muted mb-1">Email</label>
          <input
            type="email"
            required
            value={draft.email}
            onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
            className="w-full px-2 py-1.5 rounded-md bg-white/5 border border-subtle text-xs text-foreground focus:outline-none focus:border-accent/50"
            placeholder="person@example.com"
          />
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="block text-[11px] text-muted mb-1">Password</label>
          <input
            type="password"
            required
            minLength={8}
            value={draft.password}
            onChange={(e) => setDraft((d) => ({ ...d, password: e.target.value }))}
            className="w-full px-2 py-1.5 rounded-md bg-white/5 border border-subtle text-xs text-foreground focus:outline-none focus:border-accent/50"
          />
        </div>
        <div>
          <label className="block text-[11px] text-muted mb-1">Role</label>
          <select
            value={draft.role}
            onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value as 'admin' | 'viewer' }))}
            className="px-2 py-1.5 rounded-md bg-white/5 border border-subtle text-xs text-foreground focus:outline-none focus:border-accent/50"
          >
            <option value="viewer">Viewer</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="px-3 py-1.5 rounded-md bg-accent-soft text-foreground text-xs font-medium hover:bg-white/10 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Adding…' : 'Add account'}
        </button>
      </form>
      {formError && <p className="text-xs text-red-400 mt-2">{formError}</p>}
    </Card>
  );
}
