'use client';
import { useState } from 'react';
import clsx from 'clsx';
import type { Terminal } from '@/data/types';
import type { TwinLayout } from '@/lib/twin';

interface DriftBadgeProps {
  layout: TwinLayout;
  terminals: Terminal[];
}

/**
 * Surfaces wiring the board layout could not place from authored geometry.
 *
 * The placement tables in `twin.ts` are hand-drawn; anything ingested into
 * Postgres afterwards is either positioned by a geometric guess or, if its unit
 * has no box at all, not drawn. Both used to be silent, so the board looked
 * equally authoritative either way. Renders nothing when the layout is fully
 * authored — which is the normal case — so this costs the reader nothing until
 * there is something real to say.
 */
export function DriftBadge({ layout, terminals }: DriftBadgeProps) {
  const [open, setOpen] = useState(false);
  const { unmappedTerminalIds, unplacedTerminalIds } = layout;
  const total = unmappedTerminalIds.length + unplacedTerminalIds.length;
  if (!total) return null;

  const nameFor = (id: string) => terminals.find((t) => t.id === id)?.name ?? id;

  return (
    <div className="absolute right-3 top-3 z-10 max-w-[min(22rem,60%)] text-right">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={clsx(
          'rounded-md border border-amber/40 bg-amber/10 px-2.5 py-1.5 font-mono',
          'text-[9.5px] uppercase leading-tight tracking-[0.18em] text-amber',
          'transition-colors hover:bg-amber/20',
        )}
      >
        {total} unplaced {total === 1 ? 'terminal' : 'terminals'}
      </button>

      {open && (
        <div className="mt-1.5 rounded-md border border-amber/25 bg-void/95 p-2.5 text-left font-mono text-[10px] leading-relaxed text-ink-dim">
          {unmappedTerminalIds.length > 0 && (
            <>
              <p className="text-amber/80">Positioned by guess — no authored edge:</p>
              <ul className="mb-2 mt-1 space-y-0.5">
                {unmappedTerminalIds.map((id) => (
                  <li key={id}>· {nameFor(id)}</li>
                ))}
              </ul>
            </>
          )}
          {unplacedTerminalIds.length > 0 && (
            <>
              <p className="text-amber/80">Not drawn — unit has no place on this board:</p>
              <ul className="mb-2 mt-1 space-y-0.5">
                {unplacedTerminalIds.map((id) => (
                  <li key={id}>· {nameFor(id)}</li>
                ))}
              </ul>
            </>
          )}
          <p className="text-ink-dim/70">
            Wiring reached the spine but not the hand-drawn layout tables in
            <span className="text-ink-dim"> twin.ts</span>.
          </p>
        </div>
      )}
    </div>
  );
}
