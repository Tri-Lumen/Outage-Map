import { NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';

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

/**
 * Shared gate for the admin-mutation routes (alert rules, sources, maintenance
 * windows, postmortems, digest settings, push test-send, fetcher resets, …).
 * Open when ENABLE_RULES_API=true (trusted/internal deployments), otherwise
 * requires a Bearer CRON_SECRET.
 */
export function isWriteEnabled(): boolean {
  return process.env.ENABLE_RULES_API === 'true' || !!process.env.CRON_SECRET;
}

export function isAuthorized(request: NextRequest): boolean {
  if (process.env.ENABLE_RULES_API === 'true') return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return bearerMatches(request, secret);
}
