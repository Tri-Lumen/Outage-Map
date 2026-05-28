import { registerSSEClient } from '@/lib/sse';

export const dynamic = 'force-dynamic';

export async function GET() {
  let unregister: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      unregister = registerSSEClient(controller);
      // Send an initial ping so the client knows the connection is live
      const ping = new TextEncoder().encode(': ping\n\n');
      controller.enqueue(ping);
    },
    cancel() {
      unregister?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    },
  });
}
