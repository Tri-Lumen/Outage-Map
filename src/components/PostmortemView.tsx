'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { escapeHtml } from '@/lib/format';

interface Props {
  incidentId: number;
  initialContent?: string;
}

export default function PostmortemView({ incidentId, initialContent }: Props) {
  const [content, setContent] = useState(initialContent ?? '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [copied, setCopied] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Load from server if no initial content provided
    if (!initialContent) {
      fetch(`/api/postmortems/${incidentId}`)
        .then((r) => r.json())
        .then((d) => { if (d.content) setContent(d.content); })
        .catch(() => {});
    }
  }, [incidentId, initialContent]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const save = useCallback(async (text: string) => {
    setStatus('saving');
    try {
      const res = await fetch(`/api/postmortems/${incidentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      setStatus(res.ok ? 'saved' : 'error');
      if (res.ok) setTimeout(() => setStatus('idle'), 2000);
    } catch {
      setStatus('error');
    }
  }, [incidentId]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    setStatus('idle');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(val), 1500);
  };

  const copyMarkdown = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const exportHtml = () => {
    const lines = content.split('\n');
    let html = '<html><head><style>body{font-family:system-ui,sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem;line-height:1.6}h1,h2,h3{border-bottom:1px solid #eee;padding-bottom:.3em}pre{background:#f6f8fa;padding:1em;border-radius:6px;overflow:auto}code{font-family:monospace}</style></head><body>';
    for (const line of lines) {
      if (line.startsWith('# ')) html += `<h1>${escapeHtml(line.slice(2))}</h1>`;
      else if (line.startsWith('## ')) html += `<h2>${escapeHtml(line.slice(3))}</h2>`;
      else if (line.startsWith('### ')) html += `<h3>${escapeHtml(line.slice(4))}</h3>`;
      else if (line.startsWith('- ')) html += `<li>${escapeHtml(line.slice(2))}</li>`;
      else if (line.trim() === '') html += '<br>';
      else html += `<p>${escapeHtml(line)}</p>`;
    }
    html += '</body></html>';
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `postmortem-incident-${incidentId}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-foreground">Postmortem Draft</h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-muted">Markdown</span>
        </div>
        <div className="flex items-center gap-2">
          {status === 'saving' && <span className="text-xs text-muted animate-pulse">Saving…</span>}
          {status === 'saved' && <span className="text-xs text-emerald-400">Saved ✓</span>}
          {status === 'error' && <span className="text-xs text-red-400">Save failed</span>}
          <button
            onClick={copyMarkdown}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-white/5 border border-subtle text-foreground hover:bg-white/10 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
            </svg>
            {copied ? 'Copied!' : 'Copy Markdown'}
          </button>
          <button
            onClick={exportHtml}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-white/5 border border-subtle text-foreground hover:bg-white/10 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export HTML
          </button>
        </div>
      </div>

      <textarea
        value={content}
        onChange={handleChange}
        onBlur={() => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          if (status === 'idle' && content !== initialContent) save(content);
        }}
        spellCheck={false}
        className="w-full min-h-[560px] px-4 py-3 rounded-xl bg-white/5 border border-subtle text-sm text-foreground font-mono leading-relaxed focus:outline-none focus:border-accent/50 resize-y transition-colors"
        placeholder="Postmortem content will appear here…"
      />

      <p className="text-xs text-muted">
        Auto-saves 1.5s after you stop typing. Edit freely — the generated draft is the starting point.
      </p>
    </div>
  );
}
