import type { Migration } from './types';

// Per-rule HMAC signing secret for outgoing webhooks, so each integration can
// be revoked/rotated independently instead of every webhook sharing the one
// WEBHOOK_SIGNING_SECRET env var.
export const migration0004AlertRuleSecret: Migration = {
  id: 4,
  name: 'alert_rule_secret',
  up(db) {
    db.exec(`ALTER TABLE alert_rules ADD COLUMN channel_secret TEXT`);
  },
};
