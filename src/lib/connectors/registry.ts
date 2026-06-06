import type { Connector, ConnectorContext, ConnectorResult, ConnectorKind } from './types';
import { unknownResult } from './types';
export { isConnectorKind } from './types';
import { statuspageConnector } from './impl/statuspage';
import { googleConnector } from './impl/google';
import { microsoftConnector } from './impl/microsoft';
import { salesforceConnector } from './impl/salesforce';
import { awsConnector } from './impl/aws';

// The registry replaces the old `switch (service.fetcher)` dispatch in the
// poller. Adding a connector is a one-line edit here plus the impl module.
const REGISTRY: Record<ConnectorKind, Connector> = {
  statuspage: statuspageConnector,
  google: googleConnector,
  microsoft: microsoftConnector,
  salesforce: salesforceConnector,
  aws: awsConnector,
};

export function getConnector(kind: string): Connector | null {
  return (REGISTRY as Record<string, Connector>)[kind] ?? null;
}

export function connectorKinds(): ConnectorKind[] {
  return Object.keys(REGISTRY) as ConnectorKind[];
}

export async function runConnector(kind: string, ctx: ConnectorContext): Promise<ConnectorResult> {
  const connector = getConnector(kind);
  if (!connector) return unknownResult(`No connector registered for kind "${kind}"`);
  return connector.fetch(ctx);
}
