import { describe, it, expect } from 'vitest';
import { getConnector, isConnectorKind, runConnector, connectorKinds } from './registry';

describe('connector registry', () => {
  it('resolves every known connector kind', () => {
    for (const kind of connectorKinds()) {
      expect(getConnector(kind)?.kind).toBe(kind);
    }
    expect(connectorKinds().sort()).toEqual(['aws', 'google', 'microsoft', 'salesforce', 'statuspage']);
  });

  it('rejects retired/unknown kinds', () => {
    expect(getConnector('workday')).toBeNull();
    expect(getConnector('downdetector')).toBeNull();
    expect(isConnectorKind('downdetector')).toBe(false);
  });

  it('runConnector returns an honest unknown for an unregistered kind', async () => {
    const r = await runConnector('nope', { serviceSlug: 'x', statusUrl: 'https://x' });
    expect(r.status.status).toBe('unknown');
    expect(r.incidents).toEqual([]);
  });
});
