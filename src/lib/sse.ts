// Server-Sent Events broadcast registry. Pinned to globalThis so the poller
// module and the /api/stream route share the same Set regardless of Next.js
// module chunking across server component bundles.

const GLOBAL_KEY = Symbol.for('outage-map.sse-registry');

type Controller = ReadableStreamDefaultController<Uint8Array>;

type GlobalWithSSE = typeof globalThis & { [GLOBAL_KEY]?: Set<Controller> };

function getRegistry(): Set<Controller> {
  const g = globalThis as GlobalWithSSE;
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = new Set();
  return g[GLOBAL_KEY]!;
}

export function registerSSEClient(controller: Controller): () => void {
  const registry = getRegistry();
  registry.add(controller);
  broadcastSSE({ type: 'viewer_count', count: getConnectedClientCount() });
  return () => {
    registry.delete(controller);
    broadcastSSE({ type: 'viewer_count', count: getConnectedClientCount() });
  };
}

export function broadcastSSE(event: { type: string; [key: string]: unknown }): void {
  const registry = getRegistry();
  if (registry.size === 0) return;

  const data = `data: ${JSON.stringify(event)}\n\n`;
  const encoded = new TextEncoder().encode(data);

  registry.forEach((controller) => {
    try {
      controller.enqueue(encoded);
    } catch {
      // Controller is closed; remove it
      registry.delete(controller);
    }
  });
}

export function getConnectedClientCount(): number {
  return getRegistry().size;
}
