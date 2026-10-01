import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'crypto';

export type UserRole = 'admin' | 'viewer';

const SCRYPT_KEYLEN = 64;

/** Stores as `scrypt$<salt-hex>$<hash-hex>` so the algorithm is self-describing if it's ever rotated. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  try {
    const salt = Buffer.from(parts[1], 'hex');
    const expected = Buffer.from(parts[2], 'hex');
    const actual = scryptSync(password, salt, expected.length);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// --- Session cookies ---
//
// Stateless, HMAC-signed cookie (no server-side session table) — the same
// lightweight, self-rolled pattern already used for webhook signing
// elsewhere in this app. Tradeoff: there's no way to revoke a single
// outstanding session early short of rotating SESSION_SECRET, which
// invalidates every session at once. Acceptable for this app's scope; a
// server-side session table would be the next step if per-session revocation
// is ever needed.

export const SESSION_COOKIE_NAME = 'outage_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface SessionPayload {
  userId: string;
  email: string;
  role: UserRole;
  exp: number;
}

function getSessionSecret(): string | null {
  return process.env.SESSION_SECRET || null;
}

function sign(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

/** Returns null if SESSION_SECRET isn't configured — auth is then simply unavailable, not broken. */
export function createSessionCookieValue(user: { id: string; email: string; role: UserRole }): string | null {
  const secret = getSessionSecret();
  if (!secret) return null;
  const payload: SessionPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const json = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${json}.${sign(json, secret)}`;
}

export function verifySessionCookieValue(value: string | undefined | null): SessionPayload | null {
  if (!value) return null;
  const secret = getSessionSecret();
  if (!secret) return null;

  const dot = value.lastIndexOf('.');
  if (dot < 0) return null;
  const json = value.slice(0, dot);
  const sig = value.slice(dot + 1);

  const expectedSig = sign(json, secret);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const payload = JSON.parse(Buffer.from(json, 'base64url').toString('utf8')) as SessionPayload;
    if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return null;
    if (payload.role !== 'admin' && payload.role !== 'viewer') return null;
    if (typeof payload.userId !== 'string' || typeof payload.email !== 'string') return null;
    return payload;
  } catch {
    return null;
  }
}
