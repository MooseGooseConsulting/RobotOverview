'use client';
import { useMemo, useState } from 'react';
import clsx from 'clsx';
import type { Terminal } from '@/data/types';
import type { TwinLayout } from '@/lib/twin';

interface DriftBadgeProps {
  layout: TwinLayout;
  terminals: Terminal[];
  /** Preview surfaces (unit pages) get the count only — there is no room to expand. */
  compact?: boolean;
}

/**
 * Surfaces wiring the board layout could not place from authored geometry.
 *
 * The placement tables in `twin.ts` are hand-drawn; anything ingested into
 * Postgres afterwards is either positioned by a geometric guess or, if its unit
 * has no box at all, not drawn. Both used to be silent, so the view looked
 * equally authoritative either way. Renders nothing when the layout is fully
 * authored — which is the normal case — so this costs the reader nothing until
 * there is something real to say.
 *
 * Wording stays view-neutral: this renders over board, cutaway and bus alike.
 */
export function DriftBadge({ layout, terminals, compact = false }: DriftBadgeProps) {
  const [open, setOpen] = useState(false);
  const { unmappedTerminalIds, unplacedTerminalIds } = layout;
  const total = unmappedTerminalIds.length + unplacedTerminalIds.length;

  // Hooks must run unconditionally, so build the lookup before the early return.
  const nameById = useMemo(() => new Map(terminals.map((t) => [t.id, t.name])), [terminals]);
  if (!total) return null;

  const nameFor = (id: string) => nameById.get(id) ?? id;

  return (
    <div className="absolute right-3 top-3 z-10 max-w-[min(22rem,60%)] text-right">
      <button
        type="button"
        onClick={() => !compact && setOpen((v) => !v)}
        aria-expanded={compact ? undefined : open}
        disabled={compact}
        className={clsx(
          'rounded-md border border-amber/40 bg-amber/10 px-2.5 py-1.5 font-mono',
          'text-[9.5px] uppercase leading-tight tracking-[0.18em] text-amber',
          !compact && 'transition-colors hover:bg-amber/20',
        )}
      >
        {total} unplaced {total === 1 ? 'terminal' : 'terminals'}
      </button>

      {open && !compact && (
        <div className="mt-1.5 rounded-md border border-amber/25 bg-void/95 p-2.5 text-left font-mono text-[10px] leading-relaxed text-ink-dim">
          {unmappedTerminalIds.length > 0 && (
            <>
              <p className="text-amber/80">Positioned by guess — no authored edge:</p>
              <ul className="mb-2 mt-1 list-disc space-y-0.5 pl-4 marker:text-amber/50">
                {unmappedTerminalIds.map((id) => (
                  <li key={id}>{nameFor(id)}</li>
                ))}
              </ul>
            </>
          )}
          {unplacedTerminalIds.length > 0 && (
            <>
              <p className="text-amber/80">Not drawn — unit has no place in this view:</p>
              <ul className="mb-2 mt-1 list-disc space-y-0.5 pl-4 marker:text-amber/50">
                {unplacedTerminalIds.map((id) => (
                  <li key={id}>{nameFor(id)}</li>
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
