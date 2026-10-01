'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';

export default function LoginForm() {
  const router = useRouter();
  const { mutate } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || `Login failed (HTTP ${res.status})`);
        return;
      }
      await mutate();
      router.push('/');
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="surface-card rounded-xl p-6 space-y-4 border border-subtle">
      <div>
        <label className="block text-xs font-medium text-muted mb-1.5" htmlFor="login-email">Email</label>
        <input
          id="login-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 rounded-md bg-white/5 border border-subtle text-sm text-foreground placeholder:text-muted-strong focus:outline-none focus:border-accent/50"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted mb-1.5" htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 rounded-md bg-white/5 border border-subtle text-sm text-foreground focus:outline-none focus:border-accent/50"
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full px-4 py-2 rounded-md bg-accent hover:opacity-90 text-white text-sm font-medium disabled:opacity-50 transition-opacity"
      >
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
