import { NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { verifySessionCookieValue, SESSION_COOKIE_NAME, type SessionPayload } from './auth';

// Constant-time string compare so a Bearer-token check can't leak timing
// information about how many leading characters matched.
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function bearerMatches(request: NextRequest, secret: string): boolean {
  const auth = request.headers.get('authorization') ?? '';
  return safeEqual(auth, `Bearer ${secret}`);
}

/** Returns the signed-in user's session, or null if there isn't one (no cookie, expired, or SESSION_SECRET unset). */
export function getSessionFromRequest(request: NextRequest): SessionPayload | null {
  return verifySessionCookieValue(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}

/**
 * Shared gate for the admin-mutation routes (alert rules, sources, maintenance
 * windows, postmortems, digest settings, push test-send, fetcher resets, …).
 * Open when ENABLE_RULES_API=true (trusted/internal deployments); otherwise
 * requires either a Bearer CRON_SECRET (automation) or a logged-in admin
 * session (interactive UI use — see src/lib/auth.ts). A 'viewer' session
 * never satisfies this, which is the entire RBAC enforcement: every mutation
 * route already funnels through isAuthorized, so a viewer is automatically
 * read-only everywhere without each route needing its own role check.
 */
export function isWriteEnabled(): boolean {
  return process.env.ENABLE_RULES_API === 'true' || !!process.env.CRON_SECRET || !!process.env.SESSION_SECRET;
}

export function isAuthorized(request: NextRequest): boolean {
  if (process.env.ENABLE_RULES_API === 'true') return true;

  const session = getSessionFromRequest(request);
  if (session && session.role === 'admin') return true;

  const secret = process.env.CRON_SECRET;
  if (secret && bearerMatches(request, secret)) return true;

  return false;
}
