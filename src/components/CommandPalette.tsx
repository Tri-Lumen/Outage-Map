'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useServiceStatus } from '@/hooks/useStatus';
import { useTheme, THEMES, Theme } from './ThemeProvider';
import { enterPresent } from '@/hooks/usePresentMode';

type CommandKind = 'page' | 'service' | 'appearance' | 'action';

interface Command {
  id: string;
  label: string;
  hint?: string;
  group: string;
  kind: CommandKind;
  keywords?: string;
  dot?: string;
  run: () => void;
}

const STATUS_DOT: Record<string, string> = {
  operational: 'bg-emerald-400',
  degraded: 'bg-yellow-400',
  major_outage: 'bg-orange-400',
  down: 'bg-red-400',
  unknown: 'bg-muted',
};

const NAV_PAGES: { href: string; label: string; hint: string }[] = [
  { href: '/', label: 'Overview', hint: 'Modular status board' },
  { href: '/analytics', label: 'Analytics', hint: 'Uptime, SLA & MTTR' },
  { href: '/map', label: 'Heat Map', hint: 'Geographic density' },
  { href: '/alerts', label: 'Alerts', hint: 'Rules & subscriptions' },
  { href: '/sources', label: 'Sources', hint: 'Imported services' },
  { href: '/settings', label: 'Settings', hint: 'Preferences & theme' },
];

function PaletteIcon({ kind }: { kind: CommandKind }) {
  const cls = 'w-4 h-4 text-muted';
  if (kind === 'page') {
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h12A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6z" />
      </svg>
    );
  }
  if (kind === 'appearance') {
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
      </svg>
    );
  }
  if (kind === 'action') {
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
      </svg>
    );
  }
  return null;
}

export default function CommandPalette() {
  const router = useRouter();
  const { data } = useServiceStatus();
  const { theme, setTheme, toggle } = useTheme();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActive(0);
  }, []);

  const services = useMemo(() => data?.services ?? [], [data]);

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => {
      router.push(href);
      close();
    };

    const pages: Command[] = NAV_PAGES.map((p) => ({
      id: `page:${p.href}`,
      label: p.label,
      hint: p.hint,
      group: 'Pages',
      kind: 'page',
      keywords: `${p.label} ${p.hint} navigate go to`,
      run: go(p.href),
    }));

    const serviceCmds: Command[] = services.map((s) => ({
      id: `service:${s.slug}`,
      label: s.name,
      hint: 'Open service detail',
      group: 'Services',
      kind: 'service',
      keywords: `${s.name} ${s.slug} ${s.overallStatus}`,
      dot: STATUS_DOT[s.overallStatus] ?? STATUS_DOT.unknown,
      run: go(`/services/${s.slug}`),
    }));

    const themeCmds: Command[] = THEMES.filter((t) => t.value !== 'custom').map((t) => ({
      id: `theme:${t.value}`,
      label: `Theme: ${t.label}`,
      hint: theme === t.value ? 'Active' : t.description,
      group: 'Appearance',
      kind: 'appearance',
      keywords: `theme ${t.label} ${t.value} color dark light appearance`,
      run: () => {
        setTheme(t.value as Theme);
        close();
      },
    }));

    const actions: Command[] = [
      {
        id: 'action:cycle-theme',
        label: 'Cycle theme',
        hint: 'Switch to the next theme',
        group: 'Appearance',
        kind: 'action',
        keywords: 'cycle theme next toggle appearance',
        run: () => {
          toggle();
          close();
        },
      },
      {
        id: 'action:present',
        label: 'Enter presentation mode',
        hint: 'Full-screen kiosk view',
        group: 'Actions',
        kind: 'action',
        keywords: 'present presentation kiosk fullscreen tv display',
        run: () => {
          close();
          enterPresent();
        },
      },
    ];

    return [...pages, ...serviceCmds, ...themeCmds, ...actions];
  }, [services, theme, router, setTheme, toggle, close]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) =>
      `${c.label} ${c.hint ?? ''} ${c.keywords ?? ''}`.toLowerCase().includes(q),
    );
  }, [commands, query]);

  const groups = useMemo(() => {
    const map = new Map<string, Command[]>();
    for (const c of filtered) {
      const arr = map.get(c.group) ?? [];
      arr.push(c);
      map.set(c.group, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  // Global open shortcut: Cmd/Ctrl+K. Works even inside inputs.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const openEvt = () => setOpen(true);
    window.addEventListener('keydown', handler);
    window.addEventListener('open-command-palette', openEvt);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('open-command-palette', openEvt);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setActive(0);
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (filtered.length ? (i + 1) % filtered.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (filtered.length ? (i - 1 + filtered.length) % filtered.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      filtered[active]?.run();
    }
  };

  let flatIndex = -1;

  return (
    <>
      <div className="slideover-backdrop" onClick={close} />
      <div
        className="fixed left-1/2 top-[12vh] z-[60] w-[min(640px,92vw)] -translate-x-1/2 surface-card rounded-2xl border border-subtle shadow-2xl overflow-hidden"
        role="dialog"
        aria-label="Command palette"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-subtle">
          <svg className="w-4 h-4 text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, services, settings…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder-muted focus:outline-none"
            aria-label="Command palette search"
          />
          <kbd className="hidden sm:inline-block text-[10px] px-1.5 py-0.5 rounded border border-subtle text-muted">Esc</kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-2">
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted">No matches for “{query}”</div>
          )}
          {groups.map(([group, items]) => (
            <div key={group} className="px-2 pb-1">
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-strong">{group}</div>
              {items.map((c) => {
                flatIndex += 1;
                const idx = flatIndex;
                const isActive = idx === active;
                return (
                  <button
                    key={c.id}
                    data-index={idx}
                    onClick={c.run}
                    onMouseMove={() => setActive(idx)}
                    className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left transition-colors ${
                      isActive ? 'bg-surface-elevated' : 'hover:bg-white/5'
                    }`}
                  >
                    {c.dot ? (
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${c.dot}`} />
                    ) : (
                      <PaletteIcon kind={c.kind} />
                    )}
                    <span className="text-sm text-foreground font-medium flex-shrink-0">{c.label}</span>
                    {c.hint && <span className="text-xs text-muted truncate ml-auto">{c.hint}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 px-4 py-2 border-t border-subtle text-[11px] text-muted">
          <span><kbd className="px-1 py-0.5 rounded border border-subtle">↑</kbd> <kbd className="px-1 py-0.5 rounded border border-subtle">↓</kbd> navigate</span>
          <span><kbd className="px-1 py-0.5 rounded border border-subtle">↵</kbd> select</span>
          <span className="ml-auto">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </>
  );
}
