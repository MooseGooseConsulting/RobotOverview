'use client';
import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import type { NetKind } from '@/data/types';
import { useHangar } from '@/lib/store';
import {
  buildLayout,
  resolveActive,
  traceFromNet,
  traceFromTerminal,
  type ActiveHost,
  type TraceSet,
  type ViewMode,
} from '@/lib/twin';
import { LAYERS } from './palette';
import { ViewModeSwitch, HostSwitch, LayerBar } from './Controls';
import { TwinCanvas } from './TwinCanvas';
import { DriftBadge } from './DriftBadge';
import { NetInspector } from './NetInspector';

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return reduced;
}

const ALL_KINDS = new Set<NetKind>(LAYERS.map((l) => l.kind));

export function ConnectedTwin({ variant = 'full' }: { variant?: 'full' | 'preview' }) {
  const { units, terminals, nets, documents, libraryBaseUrl } = useHangar();
  const reducedMotion = useReducedMotion();

  const [mode, setMode] = useState<ViewMode>('board');
  const [host, setHost] = useState<ActiveHost>('orin');
  const [layers, setLayers] = useState<Set<NetKind>>(new Set(ALL_KINDS));
  const [hoveredTerminal, setHoveredTerminal] = useState<string | null>(null);
  const [hoveredNet, setHoveredNet] = useState<string | null>(null);
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);
  const [selectedNetId, setSelectedNetId] = useState<string | null>(null);

  const interactive = variant === 'full';

  const layout = useMemo(() => buildLayout(mode, units, terminals, nets), [mode, units, terminals, nets]);
  const active = useMemo(() => resolveActive(terminals, nets, host), [terminals, nets, host]);

  const highlight = useMemo<TraceSet | null>(() => {
    if (hoveredNet) return traceFromNet(nets, hoveredNet);
    if (hoveredTerminal) return traceFromTerminal(nets, hoveredTerminal);
    if (selectedNetId) return traceFromNet(nets, selectedNetId);
    return null;
  }, [hoveredNet, hoveredTerminal, selectedNetId, nets]);

  const selectedNet = useMemo(() => nets.find((n) => n.id === selectedNetId) ?? null, [nets, selectedNetId]);

  useEffect(() => {
    if (!interactive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedNetId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [interactive]);

  const selectTerminal = (terminalId: string) => {
    const net = nets.find((n) => n.terminals.includes(terminalId));
    if (net) setSelectedNetId(net.id);
  };

  const toggleLayer = (kind: NetKind) => {
    setLayers((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  const canvas = (
    <TwinCanvas
      key={mode}
      layout={layout}
      mode={mode}
      units={units}
      terminals={terminals}
      active={active}
      highlight={highlight}
      dimOthers={Boolean(highlight)}
      selectedNetId={selectedNetId}
      layerEnabled={layers}
      hoveredModule={hoveredModule}
      reducedMotion={reducedMotion}
      interactive={interactive}
      onHoverTerminal={setHoveredTerminal}
      onHoverNet={setHoveredNet}
      onHoverModule={setHoveredModule}
      onSelectNet={setSelectedNetId}
      onSelectTerminal={selectTerminal}
    />
  );

  if (!interactive) {
    return (
      <div className="panel corner-bracket blueprint-grid relative h-64 overflow-hidden">
        {canvas}
        {/* Count only: the preview has no room to expand, but staying silent
            here would hide drift on every unit page. */}
        <DriftBadge layout={layout} terminals={terminals} compact />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-void/70 via-transparent to-transparent" />
        <div className="pointer-events-none absolute bottom-3 left-4 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">
          Connected Twin · {terminals.length} terminals · {nets.length} nets
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ViewModeSwitch mode={mode} onChange={setMode} />
        <LayerBar enabled={layers} onToggle={toggleLayer} />
        <HostSwitch host={host} onChange={setHost} />
      </div>

      <div className="panel corner-bracket blueprint-grid relative h-[74vh] min-h-[520px] overflow-hidden">
        {canvas}
        <DriftBadge layout={layout} terminals={terminals} />
        <NetInspector
          net={selectedNet}
          units={units}
          terminals={terminals}
          documents={documents}
          libraryBaseUrl={libraryBaseUrl}
          active={active}
          onClose={() => setSelectedNetId(null)}
          onHoverTerminal={setHoveredTerminal}
        />
        <div
          className={clsx(
            'pointer-events-none absolute bottom-3 left-4 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-dim transition-opacity',
            selectedNet ? 'opacity-0' : 'opacity-100',
          )}
        >
          Hover a port to trace its net · click to open · scroll to zoom · drag to pan
        </div>
      </div>
    </div>
  );
}
