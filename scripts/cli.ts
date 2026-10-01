#!/usr/bin/env -S npx tsx
/**
 * Ops CLI for local/manual use against the same SQLite database and SMTP
 * config the running server uses (respects DATABASE_PATH and the SMTP_*
 * env vars). Not exposed over HTTP — this talks to the DB and mailer
 * directly, so it carries the same trust level as shell access to the
 * server, unlike the /api/alerts/rules HTTP API, which gates writes behind
 * ENABLE_RULES_API/CRON_SECRET.
 *
 * Usage: npm run cli -- <command> [args]
 */
import { runPollCycle } from '../src/lib/poller';
import {
  listAlertRules, insertAlertRule, updateAlertRule, deleteAlertRule,
  listUsers, insertUser, getUserByEmail, deleteUser, updateUserRole, countAdmins,
} from '../src/lib/db';
import { sendTestAlert } from '../src/lib/email';
import { hashPassword } from '../src/lib/auth';
import { isIncidentSeverity, type IncidentSeverity } from '../src/lib/types';

function usage(): never {
  console.log(`
Outage Map ops CLI

Usage:
  npm run cli -- poll
      Run a single poll cycle immediately (same as the scheduled cron job).

  npm run cli -- rules list
      List all alert rules.

  npm run cli -- rules add --email <email> [--services a,b,c] [--severity minor|major|critical]
      Create an email alert rule. Omitting --services means "all services".

  npm run cli -- rules enable <id>
  npm run cli -- rules disable <id>
  npm run cli -- rules rm <id>
      Enable, disable, or delete a rule by id (see "rules list" for ids).

  npm run cli -- test-alert <email>
      Send a test email through the configured SMTP transport.

  npm run cli -- users list
      List all login accounts.

  npm run cli -- users add --email <email> --password <password> [--role admin|viewer]
      Create a login account (role defaults to viewer). This is how the
      first admin gets created — there is no public self-signup.

  npm run cli -- users set-role <id> admin|viewer
  npm run cli -- users rm <id>
      Change an account's role, or delete it. Refuses to leave zero admins.
`);
  process.exit(1);
}

function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = args[i + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`Missing value for --${key}`);
      }
      flags[key] = value;
      i++;
    }
  }
  return flags;
}

async function cmdPoll() {
  console.log('Running poll cycle...');
  const result = await runPollCycle();
  console.log(JSON.stringify(result, null, 2));
  if (!result.success) process.exitCode = 1;
}

function cmdRulesList() {
  const rows = listAlertRules();
  if (rows.length === 0) {
    console.log('No alert rules configured.');
    return;
  }
  for (const r of rows) {
    const services = (() => { try { return JSON.parse(r.services); } catch { return []; } })();
    const servicesLabel = Array.isArray(services) && services.length ? services.join(',') : 'all';
    console.log(
      `${r.id}  ${r.enabled ? 'enabled ' : 'disabled'}  ${r.email.padEnd(30)}  >= ${r.min_severity.padEnd(8)}  services: ${servicesLabel}` +
      (r.webhook_enabled ? `  webhook: ${r.channel_type}` : ''),
    );
  }
}

function cmdRulesAdd(args: string[]) {
  const flags = parseFlags(args);
  const email = flags.email;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('Error: --email <valid-email> is required');
    process.exit(1);
  }
  const severity: IncidentSeverity = isIncidentSeverity(flags.severity) ? flags.severity : 'major';
  const services = flags.services ? flags.services.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const id = `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  insertAlertRule({
    id,
    email,
    services: JSON.stringify(services),
    minSeverity: severity,
    emailEnabled: true,
    enabled: true,
  });
  console.log(`Created rule ${id} for ${email} (>= ${severity}, services: ${services.length ? services.join(',') : 'all'})`);
}

function cmdRulesToggle(id: string | undefined, enabled: boolean) {
  if (!id) {
    console.error('Error: rule id is required');
    process.exit(1);
  }
  const ok = updateAlertRule(id, { enabled });
  if (!ok) {
    console.error(`No rule found with id ${id}`);
    process.exit(1);
  }
  console.log(`Rule ${id} ${enabled ? 'enabled' : 'disabled'}.`);
}

function cmdRulesRemove(id: string | undefined) {
  if (!id) {
    console.error('Error: rule id is required');
    process.exit(1);
  }
  const ok = deleteAlertRule(id);
  if (!ok) {
    console.error(`No rule found with id ${id}`);
    process.exit(1);
  }
  console.log(`Rule ${id} deleted.`);
}

async function cmdTestAlert(email: string | undefined) {
  if (!email) {
    console.error('Error: an email address is required');
    process.exit(1);
  }
  const result = await sendTestAlert(email);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

function cmdUsersList() {
  const rows = listUsers();
  if (rows.length === 0) {
    console.log('No login accounts yet. Create the first admin with: npm run cli -- users add --email you@example.com --password ... --role admin');
    return;
  }
  for (const u of rows) {
    console.log(`${u.id}  ${u.role.padEnd(6)}  ${u.email}`);
  }
}

function cmdUsersAdd(args: string[]) {
  const flags = parseFlags(args);
  const email = flags.email;
  const password = flags.password;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('Error: --email <valid-email> is required');
    process.exit(1);
  }
  if (!password || password.length < 8) {
    console.error('Error: --password <at least 8 characters> is required');
    process.exit(1);
  }
  const role = flags.role === 'admin' ? 'admin' : 'viewer';
  if (getUserByEmail(email)) {
    console.error(`Error: a user with email ${email} already exists`);
    process.exit(1);
  }
  const id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  insertUser({ id, email, passwordHash: hashPassword(password), role });
  console.log(`Created ${role} account ${id} for ${email}.`);
  if (!process.env.SESSION_SECRET) {
    console.log('Note: SESSION_SECRET is not set in this environment — logins will fail until it is configured.');
  }
}

function cmdUsersSetRole(id: string | undefined, role: string | undefined) {
  if (!id || (role !== 'admin' && role !== 'viewer')) {
    console.error('Usage: npm run cli -- users set-role <id> admin|viewer');
    process.exit(1);
  }
  const ok = updateUserRole(id, role);
  if (!ok) {
    console.error(`No user found with id ${id}`);
    process.exit(1);
  }
  console.log(`User ${id} is now ${role}.`);
}

function cmdUsersRemove(id: string | undefined) {
  if (!id) {
    console.error('Error: user id is required');
    process.exit(1);
  }
  const rows = listUsers();
  const user = rows.find((u) => u.id === id);
  if (!user) {
    console.error(`No user found with id ${id}`);
    process.exit(1);
  }
  if (user.role === 'admin' && countAdmins() <= 1) {
    console.error('Error: cannot delete the last remaining admin');
    process.exit(1);
  }
  deleteUser(id);
  console.log(`User ${id} deleted.`);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);

  switch (command) {
    case 'poll':
      return cmdPoll();
    case 'rules': {
      const [sub, ...subArgs] = rest;
      switch (sub) {
        case 'list': return cmdRulesList();
        case 'add': return cmdRulesAdd(subArgs);
        case 'enable': return cmdRulesToggle(subArgs[0], true);
        case 'disable': return cmdRulesToggle(subArgs[0], false);
        case 'rm': case 'remove': case 'delete': return cmdRulesRemove(subArgs[0]);
        default: return usage();
      }
    }
    case 'test-alert':
      return cmdTestAlert(rest[0]);
    case 'users': {
      const [sub, ...subArgs] = rest;
      switch (sub) {
        case 'list': return cmdUsersList();
        case 'add': return cmdUsersAdd(subArgs);
        case 'set-role': return cmdUsersSetRole(subArgs[0], subArgs[1]);
        case 'rm': case 'remove': case 'delete': return cmdUsersRemove(subArgs[0]);
        default: return usage();
      }
    }
    default:
      return usage();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
