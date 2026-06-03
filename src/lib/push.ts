import webpush from 'web-push';
import { listPushSubscriptions, deletePushSubscription } from './db';
import { createLogger } from './logger';

const log = createLogger('push');

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

let configured = false;

function publicKey(): string | undefined {
  return process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
}

export function isPushConfigured(): boolean {
  return !!(publicKey() && process.env.VAPID_PRIVATE_KEY);
}

function ensureConfigured(): boolean {
  if (configured) return true;
  const pub = publicKey();
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', pub, priv);
  configured = true;
  return true;
}

/** Sends a notification to every stored subscription. Prunes dead endpoints. */
export async function sendPushToAll(payload: PushPayload): Promise<number> {
  if (!ensureConfigured()) return 0;
  const subs = listPushSubscriptions();
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
        );
        sent += 1;
      } catch (err) {
        const statusCode = err && typeof err === 'object' && 'statusCode' in err ? (err as { statusCode?: number }).statusCode : undefined;
        if (statusCode === 404 || statusCode === 410) {
          deletePushSubscription(s.endpoint);
        } else {
          log.error('push send failed:', err);
        }
      }
    }),
  );
  return sent;
}
