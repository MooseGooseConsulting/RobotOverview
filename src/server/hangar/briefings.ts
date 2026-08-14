import { eq } from 'drizzle-orm';
import {
  DATACORE_CORPUS_BRIEFINGS,
  DATACORE_CORPUS_PACKS,
} from '@/data/datacore-corpus';
import type { HangarReadStatus } from '@/lib/hangar-read-status';
import {
  briefingById,
  briefingMatchesQuery,
  briefingSearchHaystack,
  briefingsInPack,
  packById,
  packMatchesQuery,
  packSearchHaystack,
  type BriefingKind,
  type DatacoreBriefing,
  type DatacoreBriefingRow,
  type DatacorePack,
} from '@/lib/datacore-model';
import { getHangarDrizzle, type HangarDrizzle } from './drizzle';
import { briefingPacks, briefings } from './schema';

export type {
  BriefingKind,
  DatacoreBriefing,
  DatacoreBriefingRow,
  DatacorePack,
};

export {
  briefingById,
  briefingMatchesQuery,
  briefingSearchHaystack,
  briefingsInPack,
  packById,
  packMatchesQuery,
  packSearchHaystack,
};

type BriefingsRead = HangarReadStatus & {
  briefings: DatacoreBriefingRow[];
};

type PacksRead = HangarReadStatus & {
  packs: DatacorePack[];
};

type BriefingTableRow = typeof briefings.$inferSelect;
type PackTableRow = typeof briefingPacks.$inferSelect;

function isBriefingKind(value: string): value is BriefingKind {
  return value === 'research' || value === 'plan';
}

function mapBriefingRow(row: BriefingTableRow): DatacoreBriefingRow | null {
  if (!isBriefingKind(row.kind)) {
    console.warn(`Skipping briefing ${row.id}: invalid kind "${row.kind}"`);
    return null;
  }

  const repoPath = row.repoPath ?? null;
  const aliases = row.aliases.length > 0 ? row.aliases : undefined;
  const packId = row.packId ?? undefined;

  return {
    id: row.id,
    title: row.title,
    href: row.href,
    // Domain `source` is the trusted repo-relative path (seeded into repo_path).
    source: repoPath ?? '',
    kind: row.kind,
    summary: row.summary,
    tags: row.tags ?? [],
    ...(aliases ? { aliases } : {}),
    ...(packId ? { packId } : {}),
    capturedAt: row.capturedAt ?? '',
    bodyMarkdown: row.bodyMarkdown ?? null,
    repoPath,
  };
}

function mapPackRow(row: PackTableRow): DatacorePack | null {
  if (!row.hubBriefingId) {
    console.warn(`Skipping pack ${row.id}: missing hubBriefingId`);
    return null;
  }
  return {
    id: row.id,
    title: row.title,
    code: row.code,
    summary: row.summary,
    hubBriefingId: row.hubBriefingId,
    topics: row.topics ?? [],
  };
}

function staticBriefingsFallback(reason: 'not-configured' | 'postgres-error'): BriefingsRead {
  // List/search UI does not need bodies — keep the RSC → client payload small.
  // Detail pages load full rows via getBriefing (corpus or Postgres).
  return {
    source: 'static',
    fallbackReason: reason,
    briefings: DATACORE_CORPUS_BRIEFINGS.map((b) => ({ ...b, bodyMarkdown: null })),
  };
}

function staticPacksFallback(
  reason: 'not-configured' | 'postgres-error',
): PacksRead {
  return {
    source: 'static',
    fallbackReason: reason,
    packs: DATACORE_CORPUS_PACKS,
  };
}

/** Load all briefings from a Hangar Drizzle client. */
async function loadBriefingsFromDb(db: HangarDrizzle): Promise<DatacoreBriefingRow[]> {
  const rows = await db.select().from(briefings);
  const mapped: DatacoreBriefingRow[] = [];
  for (const row of rows) {
    const briefing = mapBriefingRow(row);
    if (briefing) mapped.push(briefing);
  }
  return mapped;
}

/** Load all packs from a Hangar Drizzle client. */
async function loadPacksFromDb(db: HangarDrizzle): Promise<DatacorePack[]> {
  const rows = await db.select().from(briefingPacks);
  const mapped: DatacorePack[] = [];
  for (const row of rows) {
    const pack = mapPackRow(row);
    if (pack) mapped.push(pack);
  }
  return mapped;
}

/** Load one briefing by id. */
async function loadBriefingFromDb(
  db: HangarDrizzle,
  id: string,
): Promise<DatacoreBriefingRow | null> {
  const rows = await db.select().from(briefings).where(eq(briefings.id, id)).limit(1);
  const row = rows[0];
  if (!row) return null;
  return mapBriefingRow(row);
}

/** Optional `db` injects a Hangar Drizzle client (parity tests / Wave 3 wiring). */
export async function getBriefings(db?: HangarDrizzle): Promise<BriefingsRead> {
  try {
    const client = db ?? (await getHangarDrizzle());
    if (!client) {
      return staticBriefingsFallback('not-configured');
    }
    return {
      source: 'postgres',
      briefings: await loadBriefingsFromDb(client),
    };
  } catch (error) {
    console.warn('Hangar Postgres briefings read failed; serving Datacore corpus fixture.', error);
    return staticBriefingsFallback('postgres-error');
  }
}

/** Optional `db` injects a Hangar Drizzle client (parity tests / Wave 3 wiring). */
export async function getPacks(db?: HangarDrizzle): Promise<PacksRead> {
  try {
    const client = db ?? (await getHangarDrizzle());
    if (!client) {
      return staticPacksFallback('not-configured');
    }
    return {
      source: 'postgres',
      packs: await loadPacksFromDb(client),
    };
  } catch (error) {
    console.warn('Hangar Postgres packs read failed; serving Datacore corpus fixture.', error);
    return staticPacksFallback('postgres-error');
  }
}

/** Optional `db` injects a Hangar Drizzle client (parity tests / Wave 3 wiring). */
export async function getBriefing(
  id: string,
  db?: HangarDrizzle,
): Promise<DatacoreBriefingRow | null> {
  try {
    const client = db ?? (await getHangarDrizzle());
    if (!client) {
      return DATACORE_CORPUS_BRIEFINGS.find((b) => b.id === id) ?? null;
    }
    return loadBriefingFromDb(client, id);
  } catch (error) {
    console.warn('Hangar Postgres briefing read failed; serving Datacore corpus fixture.', error);
    return DATACORE_CORPUS_BRIEFINGS.find((b) => b.id === id) ?? null;
  }
}

/**
 * Resolve briefing markdown body from `bodyMarkdown` only.
 * `repoPath` is provenance metadata — never read from disk at runtime.
 */
export async function getBriefingBody(briefing: DatacoreBriefingRow): Promise<string | null> {
  const raw = briefing.bodyMarkdown;
  if (!raw?.trim()) return null;
  return raw;
}
