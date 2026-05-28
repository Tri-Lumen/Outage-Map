'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useServiceStatus } from '@/hooks/useStatus';
import { SERVICE_DEPENDENCIES } from '@/lib/serviceDependencies';
import { getStatusColor } from '@/lib/boardColors';

interface Node {
  id: string;
  name: string;
  status: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const DEGRADED_STATUSES = new Set(['degraded', 'major_outage', 'down']);

export default function DependencyGraph() {
  const { data } = useServiceStatus();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; name: string; status: string } | null>(null);
  const nodesRef = useRef<Node[]>([]);
  const rafRef = useRef<number | null>(null);
  const [width, setWidth] = useState(800);
  const [height] = useState(520);

  const services = data?.services ?? [];

  // Build nodes and edges
  useEffect(() => {
    const serviceMap = new Map(services.map((s) => [s.slug, s]));
    const slugsInGraph = new Set<string>();
    for (const d of SERVICE_DEPENDENCIES) {
      slugsInGraph.add(d.from);
      slugsInGraph.add(d.to);
    }

    const existingById = new Map(nodesRef.current.map((n) => [n.id, n]));
    const nodes: Node[] = Array.from(slugsInGraph).map((slug, i) => {
      const svc = serviceMap.get(slug);
      const existing = existingById.get(slug);
      return {
        id: slug,
        name: svc?.name ?? slug,
        status: svc?.overallStatus ?? 'unknown',
        x: existing?.x ?? (width / 2 + Math.cos((i / slugsInGraph.size) * Math.PI * 2) * 200),
        y: existing?.y ?? (height / 2 + Math.sin((i / slugsInGraph.size) * Math.PI * 2) * 160),
        vx: existing?.vx ?? 0,
        vy: existing?.vy ?? 0,
      };
    });

    nodesRef.current = nodes;
  }, [services, width, height]);

  // Force simulation
  useEffect(() => {
    const DAMPING = 0.85;
    const REPULSION = 2500;
    const SPRING = 0.04;
    const REST_LEN = 160;
    const CENTER_PULL = 0.003;

    function tick() {
      const nodes = nodesRef.current;
      if (!nodes.length) return;

      const idMap = new Map(nodes.map((n) => [n.id, n]));

      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        // Repulsion
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = REPULSION / (dist * dist);
          a.vx += (dx / dist) * force;
          a.vy += (dy / dist) * force;
          b.vx -= (dx / dist) * force;
          b.vy -= (dy / dist) * force;
        }
        // Center pull
        a.vx += (width / 2 - a.x) * CENTER_PULL;
        a.vy += (height / 2 - a.y) * CENTER_PULL;
      }

      // Spring forces on edges
      for (const dep of SERVICE_DEPENDENCIES) {
        const a = idMap.get(dep.from);
        const b = idMap.get(dep.to);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const stretch = dist - REST_LEN;
        const force = stretch * SPRING;
        a.vx += (dx / dist) * force;
        a.vy += (dy / dist) * force;
        b.vx -= (dx / dist) * force;
        b.vy -= (dy / dist) * force;
      }

      for (const n of nodes) {
        n.vx *= DAMPING;
        n.vy *= DAMPING;
        n.x += n.vx;
        n.y += n.vy;
        // Clamp to canvas
        n.x = Math.max(40, Math.min(width - 40, n.x));
        n.y = Math.max(40, Math.min(height - 40, n.y));
      }
    }

    function draw() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const nodes = nodesRef.current;
      const idMap = new Map(nodes.map((n) => [n.id, n]));

      ctx.clearRect(0, 0, width, height);

      // Draw edges
      for (const dep of SERVICE_DEPENDENCIES) {
        const a = idMap.get(dep.from);
        const b = idMap.get(dep.to);
        if (!a || !b) continue;
        const cascading = DEGRADED_STATUSES.has(b.status) && DEGRADED_STATUSES.has(a.status);

        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(a.x, a.y);
        ctx.strokeStyle = cascading ? 'rgba(239,68,68,0.7)' : 'rgba(255,255,255,0.12)';
        ctx.lineWidth = cascading ? 2 : 1;
        ctx.stroke();

        // Arrow tip at `a` (the dependent)
        const angle = Math.atan2(a.y - b.y, a.x - b.x);
        const r = 18;
        const ax = a.x - Math.cos(angle) * r;
        const ay = a.y - Math.sin(angle) * r;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - 8 * Math.cos(angle - 0.4), ay - 8 * Math.sin(angle - 0.4));
        ctx.lineTo(ax - 8 * Math.cos(angle + 0.4), ay - 8 * Math.sin(angle + 0.4));
        ctx.closePath();
        ctx.fillStyle = cascading ? 'rgba(239,68,68,0.7)' : 'rgba(255,255,255,0.18)';
        ctx.fill();
      }

      // Draw nodes
      for (const n of nodes) {
        const c = getStatusColor(n.status);
        ctx.beginPath();
        ctx.arc(n.x, n.y, 18, 0, Math.PI * 2);
        ctx.fillStyle = c.bg;
        ctx.fill();
        ctx.strokeStyle = c.dot;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = c.text;
        ctx.font = '9px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = n.name.length > 10 ? n.name.slice(0, 9) + '…' : n.name;
        ctx.fillText(label, n.x, n.y);
      }
    }

    function loop() {
      tick();
      draw();
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [services, width, height]);

  // Tooltip on mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hit = nodesRef.current.find((n) => Math.hypot(n.x - mx, n.y - my) < 22);
    setTooltip(hit ? { x: hit.x, y: hit.y, name: hit.name, status: hit.status } : null);
  }, []);

  // Resize observer
  useEffect(() => {
    const el = canvasRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width || 800);
    });
    ro.observe(el);
    setWidth(el.clientWidth || 800);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="surface-card rounded-xl overflow-hidden relative" style={{ height }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
        className="block"
      />
      {tooltip && (
        <div
          className="pointer-events-none absolute surface-elevated border border-subtle rounded-lg px-3 py-2 text-xs shadow-lg"
          style={{ left: tooltip.x + 24, top: tooltip.y - 10, zIndex: 10 }}
        >
          <p className="font-semibold text-foreground">{tooltip.name}</p>
          <p className="text-muted capitalize">{tooltip.status.replace('_', ' ')}</p>
        </div>
      )}
      <div className="absolute bottom-3 right-3 flex items-center gap-3 text-[10px] text-muted">
        <span className="flex items-center gap-1"><span className="inline-block w-6 h-px bg-red-500/70" /> Cascading failure</span>
        <span className="flex items-center gap-1"><span className="inline-block w-6 h-px bg-white/20" /> Dependency</span>
      </div>
    </div>
  );
}
