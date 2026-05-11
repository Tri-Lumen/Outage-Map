'use client';

import { useEffect, useState } from 'react';

interface ImportedService {
  type: string;
  name: string;
  url: string;
  refresh: number;
  color: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (svc: ImportedService) => void;
}

const PRESETS = [
  { id: 'sp.atlassian', name: 'Atlassian Statuspage', kind: 'statuspage', url: 'https://status.atlassian.com',  logo: '#0052CC', desc: 'Jira, Confluence, Bitbucket' },
  { id: 'sp.github',    name: 'GitHub',               kind: 'statuspage', url: 'https://www.githubstatus.com',  logo: '#24292F', desc: 'Repository, Actions, Codespaces' },
  { id: 'sp.openai',    name: 'OpenAI',               kind: 'statuspage', url: 'https://status.openai.com',     logo: '#10A37F', desc: 'API, ChatGPT, Playground' },
  { id: 'sp.stripe',    name: 'Stripe',               kind: 'statuspage', url: 'https://status.stripe.com',     logo: '#635BFF', desc: 'Payments, Dashboard, Webhooks' },
  { id: 'sp.discord',   name: 'Discord',              kind: 'statuspage', url: 'https://discordstatus.com',     logo: '#5865F2', desc: 'API, voice, gateway' },
  { id: 'sp.shopify',   name: 'Shopify',              kind: 'statuspage', url: 'https://www.shopifystatus.com', logo: '#96BF48', desc: 'Admin, Checkout, Storefront' },
  { id: 'rss.hn',       name: 'Hacker News',          kind: 'rss',        url: 'https://hnrss.org/frontpage',   logo: '#FF6600', desc: 'Front page RSS feed' },
  { id: 'rss.aws',      name: "AWS What's New",       kind: 'rss',        url: 'https://aws.amazon.com/new/feed/', logo: '#FF9900', desc: 'Product launches and updates' },
];

function detect(u: string): { kind: string; name: string; color?: string } | null {
  if (!u) return null;
  if (u.includes('status.') || u.includes('statuspage')) return { kind: 'statuspage', name: u.replace(/https?:\/\//, '').split('/')[0] };
  if (u.includes('rss') || u.includes('feed') || u.endsWith('.xml') || u.includes('atom')) return { kind: 'rss', name: u.replace(/https?:\/\//, '').split('/')[0] };
  if (u.includes('github')) return { kind: 'github', name: 'GitHub Status' };
  if (u.includes('aws.amazon')) return { kind: 'aws', name: 'AWS Health' };
  if (u.startsWith('http')) return { kind: 'http', name: u.replace(/https?:\/\//, '').split('/')[0] };
  return null;
}

const STATUS_COLORS: Record<string, { dot: string; text: string; label: string }> = {
  operational: { dot: '#7CB342', text: '#9CCC65', label: 'Operational' },
  degraded:    { dot: '#F0C419', text: '#FFD54F', label: 'Degraded'    },
};

export default function ImportSlideOver({ open, onClose, onAdd }: Props) {
  const [step, setStep]         = useState(0);
  const [kind, setKind]         = useState('auto');
  const [url, setUrl]           = useState('');
  const [detected, setDetected] = useState<{ kind: string; name: string; color?: string } | null>(null);
  const [name, setName]         = useState('');
  const [refresh, setRefresh]   = useState(60);
  const [search, setSearch]     = useState('');

  useEffect(() => {
    if (!open) { setStep(0); setKind('auto'); setUrl(''); setDetected(null); setName(''); setSearch(''); }
  }, [open]);

  useEffect(() => {
    if (step === 1) {
      const d = detect(url);
      setDetected(d);
      if (d && !name) setName(d.name);
    }
  }, [url, step]);

  const usePreset = (p: (typeof PRESETS)[0]) => {
    setUrl(p.url);
    setKind(p.kind);
    setName(p.name);
    setDetected({ kind: p.kind, name: p.name, color: p.logo });
    setStep(2);
  };

  const filteredPresets = PRESETS.filter(
    (p) => !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  const finish = () => {
    onAdd({
      type: detected?.kind === 'rss' ? 'rss' : 'statuspage',
      name: name || detected?.name || 'New service',
      url,
      refresh,
      color: detected?.color || '#268bd2',
    });
    onClose();
  };

  if (!open) return null;

  return (
    <>
      <div className="slideover-backdrop" onClick={onClose} />
      <aside className="slideover">
        {/* Header */}
        <div className="slideover-header">
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted-strong)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              Add data source
            </div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--foreground)', letterSpacing: -0.2 }}>
              Import a service
            </h2>
          </div>
          <button
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, background: 'transparent', border: 0, color: 'var(--muted)', borderRadius: 8, cursor: 'pointer' }}
            onClick={onClose}
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Stepper */}
        <div className="slideover-stepper">
          {['Source', 'Connect', 'Configure', 'Confirm'].map((label, i) => (
            <div
              key={i}
              className={`step ${step >= i ? 'step-on' : ''} ${step === i ? 'step-current' : ''}`}
            >
              <span className="step-num">{step > i ? '✓' : i + 1}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="slideover-body">
          {/* Step 0: Source pick */}
          {step === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="field-label">Quick add — paste any URL</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="field-input"
                    placeholder="https://status.openai.com  ·  https://hnrss.org/frontpage"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && url && setStep(1)}
                  />
                  <button className="board-btn board-btn-primary" disabled={!url} onClick={() => setStep(1)}>
                    Detect →
                  </button>
                </div>
                <p className="field-hint">We&apos;ll auto-detect Statuspage.io, RSS/Atom, and known vendors.</p>
              </div>

              <div className="separator"><span>or pick a source type</span></div>

              <div className="source-grid">
                {[
                  { k: 'statuspage', name: 'Statuspage.io', desc: 'Hosted status pages', icon: '◐' },
                  { k: 'rss',        name: 'RSS / Atom',    desc: 'Any blog or feed URL', icon: '📡' },
                  { k: 'http',       name: 'HTTP probe',    desc: 'Custom endpoint health', icon: '⊹' },
                  { k: 'github',     name: 'GitHub Status', desc: 'githubstatus.com', icon: 'GH' },
                ].map((s) => (
                  <button key={s.k} className="source-card" onClick={() => { setKind(s.k); setStep(1); }}>
                    <div className="source-icon">{s.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{s.desc}</div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="separator"><span>or browse the catalog</span></div>

              <input
                className="field-input"
                placeholder="Search presets…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <div className="preset-list">
                {filteredPresets.map((p) => (
                  <button key={p.id} className="preset-row" onClick={() => usePreset(p)}>
                    <div className="preset-logo" style={{ background: p.logo }}>{p.name.charAt(0)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.desc}</div>
                    </div>
                    <span className="kind-pill">{p.kind}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Connect */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="field-label">Feed or status page URL</label>
                <input
                  className="field-input"
                  placeholder="https://…"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  autoFocus
                />
              </div>

              {detected ? (
                <div className="detect-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span className="detect-pulse" />
                    <span style={{ fontSize: 12, color: '#7CB342', fontWeight: 600 }}>
                      Connected · {detected.kind.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--foreground)', marginBottom: 8 }}>Live preview</div>
                  {detected.kind === 'rss' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {['Latest article from the feed…', 'Second most recent item', 'Third item shows here'].map((t, i) => (
                        <div key={i} style={{ fontSize: 12, color: 'var(--muted)', padding: '4px 0', borderBottom: i < 2 ? '1px solid var(--border-subtle)' : 'none' }}>
                          {t}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {[['API', 'operational'], ['Dashboard', 'operational'], ['Webhooks', 'degraded']].map(([n, s], i) => {
                        const sc = STATUS_COLORS[s] ?? STATUS_COLORS.operational;
                        return (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0' }}>
                            <span style={{ color: 'var(--foreground)' }}>{n}</span>
                            <span style={{ color: sc.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 6, height: 6, borderRadius: 999, background: sc.dot, display: 'inline-block' }} />
                              {sc.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="detect-card" style={{ borderStyle: 'dashed' }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Enter a URL above to auto-detect the source.</div>
                </div>
              )}

              <div className="slideover-footer-actions">
                <button className="board-btn" onClick={() => setStep(0)}>← Back</button>
                <button className="board-btn board-btn-primary" disabled={!detected} onClick={() => setStep(2)}>
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Configure */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="field-label">Display name</label>
                <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Refresh interval</label>
                <div className="seg">
                  {[30, 60, 300, 900].map((v) => (
                    <button
                      key={v}
                      className={refresh === v ? 'seg-on' : ''}
                      onClick={() => setRefresh(v)}
                    >
                      {v < 60 ? `${v}s` : `${v / 60}m`}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="field-label">Default tile type</label>
                <div className="seg">
                  <button className="seg-on">
                    {detected?.kind === 'rss' ? 'Feed reader' : 'Component list'}
                  </button>
                  <button>Compact card</button>
                  <button>Stat tile</button>
                </div>
              </div>
              <div>
                <label className="field-label">Alert when</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label className="check-row"><input type="checkbox" defaultChecked /> Any component reports a major outage</label>
                  <label className="check-row"><input type="checkbox" defaultChecked /> A new incident is posted</label>
                  <label className="check-row"><input type="checkbox" /> Components stay degraded for 10+ minutes</label>
                </div>
              </div>
              <div className="slideover-footer-actions">
                <button className="board-btn" onClick={() => setStep(1)}>← Back</button>
                <button className="board-btn board-btn-primary" onClick={() => setStep(3)}>Continue →</button>
              </div>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="confirm-card">
                <div style={{ fontSize: 11, color: 'var(--muted-strong)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                  Ready to add
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div
                    style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: detected?.color || '#268bd2',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontWeight: 700,
                    }}
                  >
                    {(name || 'N').charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)' }}>{name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', wordBreak: 'break-all' }}>{url}</div>
                  </div>
                </div>
                <dl className="kv">
                  <div><dt>Source type</dt><dd>{detected?.kind?.toUpperCase()}</dd></div>
                  <div><dt>Refresh</dt><dd>every {refresh < 60 ? `${refresh}s` : `${refresh / 60}m`}</dd></div>
                  <div><dt>Tile will appear</dt><dd>at top of your board</dd></div>
                </dl>
              </div>
              <div className="slideover-footer-actions">
                <button className="board-btn" onClick={() => setStep(2)}>← Back</button>
                <button className="board-btn board-btn-primary" onClick={finish}>+ Add to dashboard</button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
