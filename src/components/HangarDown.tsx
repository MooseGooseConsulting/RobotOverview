import type { HangarFallbackReason } from '@/lib/hangar-read-status';
import { hangarFallbackDetail } from '@/lib/hangar-read-status';

export function HangarDown({ reason }: { reason: HangarFallbackReason }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-hull px-6 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-amber">Hangar down</p>
      <h1 className="font-display text-3xl text-ink">Postgres is the inventory</h1>
      <p className="max-w-xl font-mono text-sm text-ink-dim">{hangarFallbackDetail('spine', reason)}</p>
      <p className="max-w-xl font-mono text-xs text-ink-dim">
        There is no TypeScript copy of the Hangar. Fix the database connection; do not look in the
        repo for units, specs, or cells.
      </p>
    </main>
  );
}
