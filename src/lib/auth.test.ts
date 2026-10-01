import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'crypto';
import { hashPassword, verifyPassword, createSessionCookieValue, verifySessionCookieValue } from './auth';

describe('password hashing', () => {
  it('verifies a correct password and rejects a wrong one', () => {
    const hash = hashPassword('correct horse battery staple');
    expect(verifyPassword('correct horse battery staple', hash)).toBe(true);
    expect(verifyPassword('wrong password', hash)).toBe(false);
  });

  it('produces a different hash each time (random salt)', () => {
    const a = hashPassword('same-password');
    const b = hashPassword('same-password');
    expect(a).not.toBe(b);
    expect(verifyPassword('same-password', a)).toBe(true);
    expect(verifyPassword('same-password', b)).toBe(true);
  });

  it('rejects a malformed stored hash instead of throwing', () => {
    expect(verifyPassword('anything', 'not-a-real-hash')).toBe(false);
    expect(verifyPassword('anything', 'scrypt$onlytwoparts')).toBe(false);
  });
});

describe('session cookies', () => {
  const ORIGINAL_SECRET = process.env.SESSION_SECRET;

  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-secret-do-not-use-in-prod';
  });

  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = ORIGINAL_SECRET;
  });

  it('round-trips a valid session', () => {
    const cookie = createSessionCookieValue({ id: 'user_1', email: 'a@example.com', role: 'admin' });
    expect(cookie).not.toBeNull();
    const payload = verifySessionCookieValue(cookie);
    expect(payload).toMatchObject({ userId: 'user_1', email: 'a@example.com', role: 'admin' });
  });

  it('returns null without SESSION_SECRET configured', () => {
    delete process.env.SESSION_SECRET;
    const cookie = createSessionCookieValue({ id: 'user_1', email: 'a@example.com', role: 'admin' });
    expect(cookie).toBeNull();
  });

  it('rejects a tampered payload', () => {
    const cookie = createSessionCookieValue({ id: 'user_1', email: 'a@example.com', role: 'viewer' })!;
    const dot = cookie.lastIndexOf('.');
    const json = Buffer.from(cookie.slice(0, dot), 'base64url').toString('utf8');
    const tampered = JSON.parse(json);
    tampered.role = 'admin'; // attempt privilege escalation by editing the payload
    const tamperedJson = Buffer.from(JSON.stringify(tampered)).toString('base64url');
    const forged = `${tamperedJson}.${cookie.slice(dot + 1)}`;
    expect(verifySessionCookieValue(forged)).toBeNull();
  });

  it('rejects a session signed with a different secret', () => {
    const cookie = createSessionCookieValue({ id: 'user_1', email: 'a@example.com', role: 'admin' })!;
    process.env.SESSION_SECRET = 'a-different-secret';
    expect(verifySessionCookieValue(cookie)).toBeNull();
  });

  it('rejects an expired session', () => {
    const dot = (s: string) => s.lastIndexOf('.');
    const cookie = createSessionCookieValue({ id: 'user_1', email: 'a@example.com', role: 'admin' })!;
    const json = JSON.parse(Buffer.from(cookie.slice(0, dot(cookie)), 'base64url').toString('utf8'));
    json.exp = Date.now() - 1000; // already expired
    const expiredJson = Buffer.from(JSON.stringify(json)).toString('base64url');
    // Re-sign with the real secret so only the expiry (not the signature) is being tested.
    const sig = createHmac('sha256', process.env.SESSION_SECRET!).update(expiredJson).digest('base64url');
    expect(verifySessionCookieValue(`${expiredJson}.${sig}`)).toBeNull();
  });

  it('rejects garbage input without throwing', () => {
    expect(verifySessionCookieValue(null)).toBeNull();
    expect(verifySessionCookieValue('')).toBeNull();
    expect(verifySessionCookieValue('not-a-valid-cookie')).toBeNull();
    expect(verifySessionCookieValue('..')).toBeNull();
  });
});
