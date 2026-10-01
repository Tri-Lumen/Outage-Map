import { NextRequest, NextResponse } from 'next/server';
import { listCustomServices, CustomServiceRow } from '@/lib/db';
import { SERVICES, resolveKind } from '@/lib/services';
import { ServiceConfig } from '@/lib/types';
import { isWriteEnabled, isAuthorized } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const CONTRIBUTED_PATH = 'src/lib/services.contributed.json';

interface ContributedFile {
  schemaVersion: number;
  services: ServiceConfig[];
}

function rowToServiceConfig(row: CustomServiceRow): ServiceConfig {
  return {
    name: row.name,
    slug: row.slug,
    color: row.color,
    statusUrl: row.status_url,
    kind: resolveKind(row.kind ?? row.fetcher),
    brandFont: row.brand_font,
  };
}

interface GitHubCtx {
  owner: string;
  repo: string;
  base: string;
  token: string;
}

async function gh<T>(
  ctx: GitHubCtx,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<{ status: number; data: T | null; error: string | null }> {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = data as { message?: string } | null;
    return { status: res.status, data: null, error: err?.message ?? `HTTP ${res.status}` };
  }
  return { status: res.status, data: data as T, error: null };
}

export async function POST(request: NextRequest) {
  if (!isWriteEnabled()) {
    return NextResponse.json(
      { error: 'Sources API is not enabled.' },
      { status: 503 },
    );
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO || 'Tri-Lumen/Outage-Map';
  const base = process.env.GITHUB_BASE_BRANCH || 'main';
  if (!token) {
    return NextResponse.json(
      { error: 'Catalog contribution is not configured on this deployment. Set GITHUB_TOKEN.' },
      { status: 503 },
    );
  }
  const [owner, repoName] = repo.split('/');
  if (!owner || !repoName) {
    return NextResponse.json(
      { error: `GITHUB_REPO must be "owner/name", got "${repo}"` },
      { status: 500 },
    );
  }
  const ctx: GitHubCtx = { owner, repo: repoName, base, token };

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const input = body as { ids?: unknown };
  const ids = Array.isArray(input.ids)
    ? input.ids.filter((x): x is string => typeof x === 'string')
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: 'Pass at least one source id' }, { status: 400 });
  }

  // Resolve the requested rows.
  const all = listCustomServices();
  const requested = ids.map((id) => all.find((r) => r.id === id) || null);
  const missing = requested.findIndex((r) => r === null);
  if (missing !== -1) {
    return NextResponse.json(
      { error: `Source id "${ids[missing]}" not found` },
      { status: 400 },
    );
  }
  const rows = requested as CustomServiceRow[];

  // Defense in depth — reject if any selected row collides with the static catalog
  // (shouldn't happen because POST /api/sources blocks this, but a stale DB
  // row could survive across catalog updates).
  const staticSlugs = new Set(SERVICES.map((s) => s.slug));
  for (const r of rows) {
    if (staticSlugs.has(r.slug)) {
      return NextResponse.json(
        { error: `Slug "${r.slug}" is already in the static catalog` },
        { status: 409 },
      );
    }
  }

  const newEntries = rows.map(rowToServiceConfig);
  const summary = newEntries.map((s) => `- \`${s.slug}\` — ${s.name} (${s.statusUrl})`).join('\n');

  // 1. Get the SHA of base branch's HEAD so we can create a branch off it.
  type RefRes = { object: { sha: string } };
  const baseRef = await gh<RefRes>(
    ctx,
    'GET',
    `/repos/${owner}/${repoName}/git/ref/heads/${encodeURIComponent(base)}`,
  );
  if (baseRef.error || !baseRef.data) return githubError(baseRef);

  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  const rand = Math.random().toString(36).slice(2, 6);
  const branch = `contribute/sources-${stamp}-${rand}`;
  const createBranch = await gh<unknown>(
    ctx,
    'POST',
    `/repos/${owner}/${repoName}/git/refs`,
    { ref: `refs/heads/${branch}`, sha: baseRef.data.object.sha },
  );
  if (createBranch.error) return githubError(createBranch);

  // 2. Read + merge + PUT the updated file, reading from `branch` (not
  // base) so the sha we PUT against always matches what's actually there.
  // Retried once: if another contribute request merges into base between
  // this branch's creation and our PUT, GitHub's contents API returns 409
  // (stale sha) — re-reading from the branch and retrying once resolves it
  // without a human needing to re-run the whole flow.
  let putResult: Awaited<ReturnType<typeof putContributedFile>> | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    putResult = await putContributedFile(ctx, branch, newEntries);
    if (putResult.outcome !== 'conflict') break;
  }
  if (!putResult || putResult.outcome === 'error') {
    await deleteBranch(ctx, branch);
    return putResult?.response ?? NextResponse.json({ error: 'Failed to update contributed.json' }, { status: 500 });
  }
  if (putResult.outcome === 'conflict') {
    await deleteBranch(ctx, branch);
    return putResult.response!;
  }
  if (putResult.outcome === 'no_new_entries') {
    await deleteBranch(ctx, branch);
    return putResult.response!;
  }
  const fresh = putResult.fresh!;

  // 3. Open the PR.
  type PrRes = { number: number; html_url: string };
  const titleNames = fresh.map((s) => s.name).join(', ');
  const title = `Add ${fresh.length} service${fresh.length === 1 ? '' : 's'} to catalog (${titleNames})`;
  const prBody = [
    `Adds the following service${fresh.length === 1 ? '' : 's'} to the shared catalog via the in-app contribute flow.`,
    '',
    summary,
    '',
    '_Generated by the Outage-Map catalog contribution endpoint._',
  ].join('\n');
  const pr = await gh<PrRes>(
    ctx,
    'POST',
    `/repos/${owner}/${repoName}/pulls`,
    { title, head: branch, base, body: prBody },
  );
  if (pr.error || !pr.data) {
    await deleteBranch(ctx, branch);
    return githubError(pr);
  }

  return NextResponse.json(
    {
      prNumber: pr.data.number,
      prUrl: pr.data.html_url,
      branch,
      added: fresh.map((s) => s.slug),
    },
    { status: 201 },
  );
}

type PutOutcome =
  | { outcome: 'ok'; fresh: ServiceConfig[] }
  | { outcome: 'conflict'; response: ReturnType<typeof NextResponse.json> }
  | { outcome: 'no_new_entries'; response: ReturnType<typeof NextResponse.json> }
  | { outcome: 'error'; response: ReturnType<typeof NextResponse.json> };

// Reads src/lib/services.contributed.json from `branch`, merges in
// `newEntries` (de-duped on slug), and PUTs the result back to that same
// branch. Reading and writing against the same ref (rather than reading
// from base once, up front) is what makes the retry in the caller safe to
// just re-run on a sha conflict.
async function putContributedFile(
  ctx: GitHubCtx,
  branch: string,
  newEntries: ServiceConfig[],
): Promise<PutOutcome> {
  const { owner, repo: repoName } = ctx;

  type ContentsRes = { sha: string; content: string; encoding: string };
  const contents = await gh<ContentsRes>(
    ctx,
    'GET',
    `/repos/${owner}/${repoName}/contents/${CONTRIBUTED_PATH}?ref=${encodeURIComponent(branch)}`,
  );
  if (contents.error && contents.status !== 404) {
    return { outcome: 'error', response: githubError(contents) };
  }

  let existing: ContributedFile = { schemaVersion: 1, services: [] };
  let existingSha: string | null = null;
  if (contents.data) {
    existingSha = contents.data.sha;
    try {
      const raw = Buffer.from(contents.data.content, 'base64').toString('utf-8');
      existing = JSON.parse(raw) as ContributedFile;
      if (!Array.isArray(existing.services)) existing.services = [];
    } catch (err) {
      console.error('[contribute] Failed to parse existing contributed.json:', err);
      return {
        outcome: 'error',
        response: NextResponse.json({ error: 'Failed to parse existing contributed.json' }, { status: 500 }),
      };
    }
  }

  const seen = new Set(existing.services.map((s) => s.slug));
  const fresh = newEntries.filter((s) => !seen.has(s.slug));
  if (fresh.length === 0) {
    return {
      outcome: 'no_new_entries',
      response: NextResponse.json(
        { error: 'Every selected source is already in the catalog on main' },
        { status: 409 },
      ),
    };
  }
  const next: ContributedFile = { schemaVersion: 1, services: [...existing.services, ...fresh] };
  const nextContent = `${JSON.stringify(next, null, 2)}\n`;

  const commitMessage = `feat(catalog): add ${fresh.length} user-imported service${fresh.length === 1 ? '' : 's'}`;
  const putBody: Record<string, unknown> = {
    message: commitMessage,
    content: Buffer.from(nextContent, 'utf-8').toString('base64'),
    branch,
  };
  if (existingSha) putBody.sha = existingSha;
  const put = await gh<unknown>(ctx, 'PUT', `/repos/${owner}/${repoName}/contents/${CONTRIBUTED_PATH}`, putBody);
  if (put.error) {
    if (put.status === 409) {
      return { outcome: 'conflict', response: githubError(put) };
    }
    return { outcome: 'error', response: githubError(put) };
  }
  return { outcome: 'ok', fresh };
}

// Best-effort cleanup so a failed contribution doesn't leave an orphaned
// branch behind on GitHub. Failure here is logged, not surfaced — the
// caller already has a real error to report.
async function deleteBranch(ctx: GitHubCtx, branch: string): Promise<void> {
  try {
    await gh<unknown>(ctx, 'DELETE', `/repos/${ctx.owner}/${ctx.repo}/git/refs/heads/${encodeURIComponent(branch)}`);
  } catch (err) {
    console.error('[contribute] Failed to clean up orphaned branch:', err);
  }
}

function githubError(res: { status: number; error: string | null }) {
  const status = res.status === 404 ? 404
    : res.status === 401 ? 401
    : res.status === 403 ? 403
    : res.status === 422 ? 422
    : 502;
  return NextResponse.json(
    { error: `GitHub API: ${res.error || `HTTP ${res.status}`}` },
    { status },
  );
}
