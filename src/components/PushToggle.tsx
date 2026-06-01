'use client';

import { useEffect, useState } from 'react';

export default function PushToggle() {
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const ok = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
    setSupported(ok);
    if (ok) {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setSubscribed(!!sub))
        .catch(() => {});
    }
  }, []);

  const subscribe = async () => {
    if (!vapid) {
      setMsg('Server VAPID public key not configured (NEXT_PUBLIC_VAPID_PUBLIC_KEY).');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setMsg('Notification permission denied.');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      // Browsers accept the base64url-encoded VAPID public key directly.
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapid,
      });
      const json = sub.toJSON();
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint, keys: json.keys, userAgent: navigator.userAgent }),
      });
      if (res.ok) {
        setSubscribed(true);
        setMsg('Subscribed ✓');
      } else {
        const b = await res.json().catch(() => ({}));
        setMsg(b.error || 'Subscribe failed');
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Subscribe failed');
    } finally {
      setBusy(false);
    }
  };

  const unsubscribe = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe();
      }
      setSubscribed(false);
      setMsg('Unsubscribed');
    } catch {
      setMsg('Unsubscribe failed');
    } finally {
      setBusy(false);
    }
  };

  if (!supported) {
    return <p className="text-[11px] text-muted">Push notifications aren&apos;t supported in this browser.</p>;
  }

  return (
    <div className="flex items-center gap-3">
      {subscribed ? (
        <button
          onClick={unsubscribe}
          disabled={busy}
          className="px-4 py-2 rounded-md bg-white/5 border border-subtle text-foreground text-xs font-medium hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          Disable push
        </button>
      ) : (
        <button
          onClick={subscribe}
          disabled={busy}
          className="px-4 py-2 rounded-md bg-accent-soft text-foreground text-xs font-medium hover:bg-white/10 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Enable push
        </button>
      )}
      {msg && <span className="text-[11px] text-muted">{msg}</span>}
    </div>
  );
}
