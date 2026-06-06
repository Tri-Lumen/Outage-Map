import { describe, it, expect } from 'vitest';
import { getServices } from '../services';
import { runConnector } from './registry';

// Opt-in LIVE smoke test. `npm test`, CI, and the egress-restricted sandbox all
// skip this (SMOKE is unset), so it never makes network calls there. To verify
// every connector against its real upstream from a network-enabled machine:
//
//   SMOKE=1 npx vitest run src/lib/connectors/smoke.test.ts
//
// It prints each service's normalized result and fails on any 'unknown'
// (unreachable / unparseable feed), which is the fastest way to catch an
// upstream contract drift.
const run = process.env.SMOKE === '1';
const services = run ? getServices() : [];

describe.skipIf(!run)('connector live smoke', () => {
  for (const service of services) {
    it(`${service.slug} (${service.kind})`, async () => {
      const r = await runConnector(service.kind, {
        serviceSlug: service.slug,
        statusUrl: service.statusUrl,
      });
      // eslint-disable-next-line no-console
      console.log(
        `${service.slug.padEnd(20)} ${r.status.status.padEnd(13)} ${r.incidents.length} incidents — ${r.status.details ?? ''}`,
      );
      expect(r.status.status).not.toBe('unknown');
    }, 30_000);
  }
});
