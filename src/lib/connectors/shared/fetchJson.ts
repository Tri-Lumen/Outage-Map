import { z } from 'zod';
import { httpFetch, HttpFetchOptions } from '../../fetchers/httpFetch';
import { health } from '../../health';
import { createLogger } from '../../logger';

const log = createLogger('connector');

export type FetchJsonResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: 'network' | 'http' | 'parse' | 'schema'; status?: number; message: string };

// JSON fetch + Zod validation layered on the shared httpFetch (timeouts,
// retries, circuit-friendly). A schema mismatch is recorded on the fetcher
// health surface so a drifted upstream contract is visible to operators
// instead of silently yielding bad data.
export async function fetchJson<S extends z.ZodTypeAny>(
  url: string,
  schema: S,
  serviceSlug: string,
  init: HttpFetchOptions = {},
): Promise<FetchJsonResult<z.infer<S>>> {
  let res: Response;
  try {
    res = await httpFetch(url, { headers: { Accept: 'application/json' }, ...init });
  } catch (err) {
    return { ok: false, reason: 'network', message: err instanceof Error ? err.message : String(err) };
  }

  if (!res.ok) {
    return { ok: false, reason: 'http', status: res.status, message: `HTTP ${res.status}` };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch (err) {
    return { ok: false, reason: 'parse', message: err instanceof Error ? err.message : 'invalid JSON' };
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ');
    log.error(`${serviceSlug}: schema validation failed for ${url}: ${message}`);
    health.recordParseError(serviceSlug, 'official', message);
    return { ok: false, reason: 'schema', message };
  }

  return { ok: true, data: parsed.data };
}
