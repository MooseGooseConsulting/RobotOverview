'use client';
import { useMemo, useState } from 'react';
import clsx from 'clsx';
import type { Terminal, Unit } from '@/data/types';
import type { TwinLayout } from '@/lib/twin';

interface DriftBadgeProps {
  layout: TwinLayout;
  terminals: Terminal[];
  units: Unit[];
  /** Preview surfaces (unit pages) get the count only — there is no room to expand. */
  compact?: boolean;
}

const CHIP =
  'rounded-md border border-amber/40 bg-amber/10 px-2.5 py-1.5 font-mono ' +
  'text-[9.5px] uppercase leading-tight tracking-[0.18em] text-amber';

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
export function DriftBadge({ layout, terminals, units, compact = false }: DriftBadgeProps) {
  const [open, setOpen] = useState(false);
  const { unmappedTerminalIds, unplacedTerminalIds } = layout;
  const total = unmappedTerminalIds.length + unplacedTerminalIds.length;

  // Hooks must run unconditionally, so build the lookups before the early return.
  const terminalById = useMemo(() => new Map(terminals.map((t) => [t.id, t])), [terminals]);
  const unitNameById = useMemo(() => new Map(units.map((u) => [u.id, u.name])), [units]);
  if (!total) return null;

  // "Unplaced" is only true of the second list. Guessed terminals ARE drawn —
  // calling them unplaced sends someone hunting for missing connectors that are
  // on screen the whole time. Name each kind by what actually happened to it.
  const label = [
    unmappedTerminalIds.length ? `${unmappedTerminalIds.length} guessed` : null,
    unplacedTerminalIds.length ? `${unplacedTerminalIds.length} unplaced` : null,
  ]
    .filter(Boolean)
    .join(', ');

  // Connector names repeat across units — "USB Host Ports" exists on both the Pi
  // and the Orin — so the name alone cannot tell an operator which placement to
  // fix. Always carry the owning unit.
  const entry = (id: string) => {
    const t = terminalById.get(id);
    const owner = t ? (unitNameById.get(t.unitId) ?? t.unitId) : null;
    return (
      <li key={id}>
        {t?.name ?? id}
        {owner && <span className="text-ink-dim/60"> — {owner}</span>}
      </li>
    );
  };

  // The preview sits inside a card-wide <Link>. A nested <button> is invalid
  // there, and a disabled one swallows the click so the card link dies under
  // the badge — so compact renders inert text, not a control.
  if (compact) {
    return (
      <div className="pointer-events-none absolute right-3 top-3 z-10">
        <span className={CHIP}>{label}</span>
      </div>
    );
  }

  return (
    <div className="absolute right-3 top-3 z-10 flex max-w-[min(22rem,60%)] flex-col items-end">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={clsx(CHIP, 'transition-colors hover:bg-amber/20')}
      >
        {label}
      </button>

      {open && (
        // The board container is overflow-hidden, so an unbounded list would be
        // clipped and its tail unreachable. Cap it and scroll inside instead.
        <div className="mt-1.5 max-h-[min(24rem,60vh)] overflow-y-auto overscroll-contain rounded-md border border-amber/25 bg-void/95 p-2.5 text-left font-mono text-[10px] leading-relaxed text-ink-dim">
          {unmappedTerminalIds.length > 0 && (
            <>
              <p className="text-amber/80">Positioned by guess — no authored edge:</p>
              <ul className="mb-2 mt-1 list-disc space-y-0.5 pl-4 marker:text-amber/50">
                {unmappedTerminalIds.map(entry)}
              </ul>
            </>
          )}
          {unplacedTerminalIds.length > 0 && (
            <>
              <p className="text-amber/80">Not drawn — unit has no place in this view:</p>
              <ul className="mb-2 mt-1 list-disc space-y-0.5 pl-4 marker:text-amber/50">
                {unplacedTerminalIds.map(entry)}
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
