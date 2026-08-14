import {
  ACTIVITY_KINDS,
  DOCUMENT_KINDS,
  INVENTORY_ITEM_STATUSES,
  INSIGHT_CONFIDENCE_LEVELS,
  MISSION_CONSTRAINT_UNITS,
  MISSION_STATUSES,
  POWER_RAILS,
  PROVENANCE_KINDS,
  SOURCE_RECORD_KINDS,
  UNIT_STATUSES,
  WISHLIST_STATUSES,
  type ActivityKind,
  type InventoryItem,
  type Mission,
  type Unit,
  type WishlistItem,
  type DocumentRef,
} from '@/data/types';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { z } from 'zod';
import { getHangarDrizzle, type HangarDrizzle } from './drizzle';
import { isTrimmedHttpUrl } from './validators';

const httpUrl = z.string().refine(isTrimmedHttpUrl, 'must be an http(s) URL');
const isoTimestamp = z
  .string()
  .refine((v) => !Number.isNaN(new Date(v).getTime()), 'must be an ISO timestamp');
import {
  activityLog,
  assetCapabilities,
  assetGroups,
  assetInterfaces,
  assetShortcuts,
  assetTags,
  assets,
  briefingPacks,
  briefings,
  documentAssets,
  documents,
  hotspots,
  insightAssets,
  insightMissions,
  insightTags,
  insights,
  loadoutAssignments,
  missionAfterActions,
  missionConstraints,
  missionObjectives,
  missionRequisitions,
  missions,
  socketAccepts,
  sockets,
  tags,
  wishlistMeta,
} from './schema';

export type IngestDb = HangarDrizzle;

// ── Auth (kept from prior ingest) ────────────────────────────────────────────

export class IngestAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function assertIngestAuthorized(header: string | null): void {
  const expected = process.env.HANGAR_INGEST_TOKEN?.trim();
  if (!expected) {
    throw new IngestAuthError('HANGAR_INGEST_TOKEN is not configured', 503);
  }
  if (!header || header !== `Bearer ${expected}`) {
    throw new IngestAuthError('Unauthorized', 401);
  }
}

// ── HTTP errors for ops ──────────────────────────────────────────────────────

export class IngestNotFoundError extends Error {
  status = 404 as const;
  body: Record<string, unknown>;
  constructor(message: string, extra: Record<string, unknown> = {}) {
    super(message);
    this.body = { error: message, ...extra };
  }
}

export class IngestConflictError extends Error {
  status = 409 as const;
  body: Record<string, unknown>;
  constructor(message: string, extra: Record<string, unknown> = {}) {
    super(message);
    this.body = { error: message, ...extra };
  }
}

export class IngestUnavailableError extends Error {
  status = 503 as const;
  constructor(message: string) {
    super(message);
  }
}

// ── Shared Zod leaves ────────────────────────────────────────────────────────

const bayIdSchema = z.enum(['robotics', 'compute', 'network', 'home', 'audio']);
const specRowSchema = z.object({ label: z.string(), value: z.string() });
const priceSchema = z.object({
  us: z.number().nullable(),
  import: z.number().nullable(),
  currency: z.string().optional(),
});
const powerSchema = z.object({
  watts: z.number().nullable(),
  volts: z.number().nullable().optional(),
  rail: z.enum(POWER_RAILS).nullable().optional(),
});
const sourceRecordSchema = z.object({
  label: z.string(),
  url: httpUrl,
  accessedAt: z.string(),
  kind: z.enum(SOURCE_RECORD_KINDS),
});
const loadoutSlotSchema = z.object({
  group: z.string().optional(),
  slot: z.string(),
  filledBy: z.string().nullable(),
  note: z.string().optional(),
  hotspotId: z.string().optional(),
});
const hotspotSchema = z.object({
  id: z.string(),
  label: z.string(),
  x: z.number(),
  y: z.number(),
});
const unitShortcutSchema = z.union([
  z.object({
    id: z.string(),
    label: z.string(),
    type: z.literal('url'),
    url: httpUrl,
    note: z.string().optional(),
  }),
  z.object({
    id: z.string(),
    label: z.string(),
    type: z.literal('command'),
    command: z.string(),
    note: z.string().optional(),
  }),
]);

const unitRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  callsign: z.string().optional(),
  bay: bayIdSchema,
  class: z.string().min(1),
  status: z.enum(UNIT_STATUSES),
  flagship: z.boolean().optional(),
  summary: z.string(),
  specs: z.array(specRowSchema),
  price: priceSchema.optional(),
  power: powerSchema.optional(),
  massGrams: z.number().nullable().optional(),
  loadout: z.array(loadoutSlotSchema).optional(),
  hotspots: z.array(hotspotSchema).optional(),
  capabilities: z.array(z.string()).optional(),
  missions: z.array(z.string()).optional(),
  insights: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  shortcuts: z.array(unitShortcutSchema).optional(),
  links: z.array(z.object({ label: z.string(), url: httpUrl })).optional(),
  acquired: z.string().optional(),
  horizon: z.string().optional(),
  provenance: z.enum(PROVENANCE_KINDS).optional(),
  monitoredVia: z.string().optional(),
});

const itemRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  bay: bayIdSchema,
  category: z.string().min(1),
  status: z.enum(INVENTORY_ITEM_STATUSES),
  summary: z.string(),
  description: z.string(),
  planningNotes: z.string().optional(),
  limitations: z.array(z.string()).optional(),
  specs: z.array(specRowSchema),
  price: priceSchema.optional(),
  quantity: z.number().optional(),
  relatedUnits: z.array(z.string()).optional(),
  relatedMissions: z.array(z.string()).optional(),
  relatedCapabilities: z.array(z.string()).optional(),
  relatedInsights: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  sources: z.array(sourceRecordSchema).optional(),
  acquired: z.string().optional(),
  horizon: z.string().optional(),
  provenance: z.enum(PROVENANCE_KINDS).optional(),
});

const wishlistRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  forUnit: z.string().optional(),
  forMission: z.string().optional(),
  rationale: z.string(),
  price: priceSchema,
  power: powerSchema.optional(),
  massGrams: z.number().nullable().optional(),
  status: z.enum(WISHLIST_STATUSES),
  unlocks: z.string().optional(),
  riskNote: z.string().optional(),
  horizon: z.string().optional(),
  source: z.string().optional(),
});

const missionRecordSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(MISSION_STATUSES),
  objective: z.string(),
  environment: z.string().optional(),
  requisitionedUnits: z.array(z.string()),
  requiredLoadout: z.array(z.string()),
  wishlist: z.array(z.string()),
  objectives: z.array(z.object({ text: z.string(), done: z.boolean() })),
  constraints: z.array(
    z.object({
      label: z.string(),
      value: z.number(),
      budget: z.number(),
      unit: z.enum(MISSION_CONSTRAINT_UNITS),
    }),
  ),
  afterAction: z.array(z.string()).optional(),
  insights: z.array(z.string()).optional(),
});

const documentRecordSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  kind: z.enum(DOCUMENT_KINDS),
  libraryPath: z.string().min(1),
  url: httpUrl.optional(),
  units: z.array(z.string()).optional(),
  note: z.string().optional(),
});

const appendInsightInput = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  body: z.string(),
  confidence: z.enum(INSIGHT_CONFIDENCE_LEVELS),
  source: z.string().optional(),
  bay: bayIdSchema.optional(),
  capturedAt: isoTimestamp.optional(),
  units: z.array(z.string()).optional(),
  missions: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

const appendActivityInput = z.object({
  id: z.string().min(1),
  kind: z.enum(ACTIVITY_KINDS),
  text: z.string().min(1),
  at: isoTimestamp.optional(),
});

const patchStatusInput = z.object({
  target: z.enum(['unit', 'item', 'wishlist']),
  id: z.string().min(1),
  status: z.string().min(1),
});

const assignLoadoutInput = z.object({
  hostAssetId: z.string().min(1),
  slot: z.string().min(1),
  assetId: z.string().nullable(),
});

const linkInsightInput = z.object({
  insightId: z.string().min(1),
  units: z.array(z.string()).optional(),
  missions: z.array(z.string()).optional(),
});

const landBriefingInput = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  kind: z.enum(['research', 'plan']),
  summary: z.string(),
  tags: z.array(z.string()).optional(),
  aliases: z.array(z.string()).optional(),
  packId: z.string().optional(),
  capturedAt: isoTimestamp.optional(),
  href: z.string().optional(),
  /** Required for all kinds — plans store a copy; repoPath is provenance only. */
  bodyMarkdown: z.string().min(1),
  repoPath: z.string().min(1).optional(),
});

const landPackInput = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  code: z.string().min(1),
  summary: z.string(),
  hubBriefingId: z.string().optional(),
  topics: z.array(z.string()),
});

const ingestBodySchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('append_insight'), input: appendInsightInput }),
  z.object({ op: z.literal('append_activity'), input: appendActivityInput }),
  z.object({ op: z.literal('patch_status'), input: patchStatusInput }),
  z.object({ op: z.literal('assign_loadout'), input: assignLoadoutInput }),
  z.object({ op: z.literal('link_insight'), input: linkInsightInput }),
  z.object({ op: z.literal('land_unit'), input: unitRecordSchema }),
  z.object({ op: z.literal('land_item'), input: itemRecordSchema }),
  z.object({ op: z.literal('land_wishlist'), input: wishlistRecordSchema }),
  z.object({ op: z.literal('land_mission'), input: missionRecordSchema }),
  z.object({ op: z.literal('land_document'), input: documentRecordSchema }),
  z.object({ op: z.literal('land_briefing'), input: landBriefingInput }),
  z.object({ op: z.literal('land_pack'), input: landPackInput }),
]);

type IngestBody = z.infer<typeof ingestBodySchema>;
type IngestOp = IngestBody['op'];

type IngestResult = {
  ok: true;
  op: IngestOp;
  id: string;
};

export function parseIngestBody(raw: unknown): IngestBody {
  return ingestBodySchema.parse(raw);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function numOrNull(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

function activityKindForStatus(status: string): ActivityKind {
  if (status === 'researching') return 'researched';
  if (status === 'owned' || status === 'received' || status === 'inventory') return 'acquired';
  if (status === 'on-order') return 'shipped';
  return 'insight';
}

async function assertAssetsExist(db: IngestDb, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await db.select({ id: assets.id }).from(assets).where(inArray(assets.id, ids));
  const found = new Set(rows.map((r) => r.id));
  return ids.filter((id) => !found.has(id));
}

async function assertMissionsExist(db: IngestDb, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await db.select({ id: missions.id }).from(missions).where(inArray(missions.id, ids));
  const found = new Set(rows.map((r) => r.id));
  return ids.filter((id) => !found.has(id));
}

async function resolveOrCreateTagId(db: IngestDb, name: string): Promise<number> {
  const existing = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.namespace, 'tag'), eq(tags.name, name)))
    .limit(1);
  if (existing[0]) return existing[0].id;

  const inserted = await db
    .insert(tags)
    .values({ namespace: 'tag', name, label: name })
    .onConflictDoNothing({ target: [tags.namespace, tags.name] })
    .returning({ id: tags.id });
  if (inserted[0]) return inserted[0].id;

  const again = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.namespace, 'tag'), eq(tags.name, name)))
    .limit(1);
  if (!again[0]) throw new Error(`Failed to resolve tag '${name}'`);
  return again[0].id;
}

async function resolveOrCreateNamespacedTag(
  db: IngestDb,
  namespace: string,
  name: string,
): Promise<number> {
  const existing = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.namespace, namespace), eq(tags.name, name)))
    .limit(1);
  if (existing[0]) return existing[0].id;
  const inserted = await db
    .insert(tags)
    .values({ namespace, name, label: name })
    .onConflictDoNothing({ target: [tags.namespace, tags.name] })
    .returning({ id: tags.id });
  if (inserted[0]) return inserted[0].id;
  const again = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.namespace, namespace), eq(tags.name, name)))
    .limit(1);
  if (!again[0]) throw new Error(`Failed to resolve tag ${namespace}/${name}`);
  return again[0].id;
}

async function compatibleInterfaceIds(
  db: IngestDb,
  socketId: number,
  assetId: string,
): Promise<string[]> {
  const accepts = await db
    .select({ interfaceTypeId: socketAccepts.interfaceTypeId })
    .from(socketAccepts)
    .where(eq(socketAccepts.socketId, socketId));
  const exposes = await db
    .select({ interfaceTypeId: assetInterfaces.interfaceTypeId })
    .from(assetInterfaces)
    .where(eq(assetInterfaces.assetId, assetId));
  const exposeSet = new Set(exposes.map((r) => r.interfaceTypeId));
  return accepts
    .map((r) => r.interfaceTypeId)
    .filter((id) => exposeSet.has(id))
    .sort();
}

// ── Op implementations (exported for tests) ──────────────────────────────────

export async function opAppendInsight(
  db: IngestDb,
  input: z.infer<typeof appendInsightInput>,
): Promise<string> {
  const unitIds = input.units ?? [];
  const missionIds = input.missions ?? [];
  const missingUnits = await assertAssetsExist(db, unitIds);
  const missingMissions = await assertMissionsExist(db, missionIds);
  if (missingUnits.length || missingMissions.length) {
    throw new IngestConflictError('Insight references missing entities', {
      missingUnits: missingUnits.length ? missingUnits : undefined,
      missingMissions: missingMissions.length ? missingMissions : undefined,
    });
  }

  const capturedAt = input.capturedAt ?? todayIsoDate();

  await db.transaction(async (tx) => {
    await tx.insert(insights).values({
      id: input.id,
      title: input.title,
      body: input.body,
      confidence: input.confidence,
      source: input.source ?? null,
      bay: input.bay ?? null,
      capturedAt: new Date(capturedAt),
    });

    if (unitIds.length) {
      await tx.insert(insightAssets).values(unitIds.map((assetId) => ({ insightId: input.id, assetId })));
    }
    if (missionIds.length) {
      await tx
        .insert(insightMissions)
        .values(missionIds.map((missionId) => ({ insightId: input.id, missionId })));
    }
    for (const tagName of input.tags ?? []) {
      const tagId = await resolveOrCreateTagId(tx as unknown as IngestDb, tagName);
      await tx.insert(insightTags).values({ insightId: input.id, tagId }).onConflictDoNothing();
    }
  });

  return input.id;
}

async function opAppendActivity(
  db: IngestDb,
  input: z.infer<typeof appendActivityInput>,
): Promise<string> {
  const at = input.at ?? new Date().toISOString();
  await db.insert(activityLog).values({
    id: input.id,
    kind: input.kind,
    text: input.text,
    at: new Date(at),
  });
  return input.id;
}

export async function opPatchStatus(
  db: IngestDb,
  input: z.infer<typeof patchStatusInput>,
): Promise<string> {
  const allowed =
    input.target === 'unit'
      ? UNIT_STATUSES
      : input.target === 'item'
        ? INVENTORY_ITEM_STATUSES
        : WISHLIST_STATUSES;
  if (!(allowed as readonly string[]).includes(input.status)) {
    throw new IngestConflictError(`Invalid ${input.target} status '${input.status}'`, {
      status: input.status,
      allowed: [...allowed],
    });
  }

  await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: assets.id, status: assets.status })
      .from(assets)
      .where(eq(assets.id, input.id))
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw new IngestNotFoundError(`Asset '${input.id}' not found`, { id: input.id });
    }

    const oldStatus = row.status;
    await tx
      .update(assets)
      .set({ status: input.status as typeof row.status, updatedAt: new Date() })
      .where(eq(assets.id, input.id));

    const kind = activityKindForStatus(input.status);
    await tx.insert(activityLog).values({
      id: `act-${input.id}-${Date.now()}`,
      kind,
      text: `${input.target} ${input.id}: ${oldStatus} → ${input.status}`,
      at: new Date(),
      assetId: input.id,
    });
  });

  return input.id;
}

export async function opAssignLoadout(
  db: IngestDb,
  input: z.infer<typeof assignLoadoutInput>,
): Promise<string> {
  await db.transaction(async (tx) => {
    const sockRows = await tx
      .select()
      .from(sockets)
      .where(and(eq(sockets.hostAssetId, input.hostAssetId), eq(sockets.name, input.slot)))
      .limit(1);
    const sock = sockRows[0];
    if (!sock) {
      throw new IngestConflictError(
        `Socket '${input.slot}' not found on host '${input.hostAssetId}'`,
        { hostAssetId: input.hostAssetId, slot: input.slot },
      );
    }

    if (input.assetId === null) {
      await tx.delete(loadoutAssignments).where(eq(loadoutAssignments.socketId, sock.id));
      return;
    }

    const missing = await assertAssetsExist(tx as unknown as IngestDb, [input.assetId]);
    if (missing.length) {
      throw new IngestConflictError(`Asset '${input.assetId}' not found`, {
        missingAssets: missing,
      });
    }

    const matches = await compatibleInterfaceIds(tx as unknown as IngestDb, sock.id, input.assetId);
    if (matches.length !== 1) {
      throw new IngestConflictError(
        `Expected exactly one compatible interface for '${input.assetId}' in '${input.hostAssetId}/${input.slot}'`,
        {
          hostAssetId: input.hostAssetId,
          slot: input.slot,
          assetId: input.assetId,
          interfaces: matches.length ? matches : [],
        },
      );
    }

    // Clear this asset from any other socket first (updateSlot semantics).
    await tx
      .delete(loadoutAssignments)
      .where(
        and(eq(loadoutAssignments.assetId, input.assetId), ne(loadoutAssignments.socketId, sock.id)),
      );

    await tx
      .insert(loadoutAssignments)
      .values({
        socketId: sock.id,
        assetId: input.assetId,
        interfaceTypeId: matches[0],
      })
      .onConflictDoUpdate({
        target: loadoutAssignments.socketId,
        set: {
          assetId: input.assetId,
          interfaceTypeId: matches[0],
          equippedAt: new Date(),
        },
      });
  });

  return input.hostAssetId;
}

export async function opLinkInsight(
  db: IngestDb,
  input: z.infer<typeof linkInsightInput>,
): Promise<string> {
  const existing = await db
    .select({ id: insights.id })
    .from(insights)
    .where(eq(insights.id, input.insightId))
    .limit(1);
  if (!existing[0]) {
    throw new IngestNotFoundError(`Insight '${input.insightId}' not found`, {
      insightId: input.insightId,
    });
  }

  const unitIds = input.units ?? [];
  const missionIds = input.missions ?? [];
  const missingUnits = await assertAssetsExist(db, unitIds);
  const missingMissions = await assertMissionsExist(db, missionIds);
  if (missingUnits.length || missingMissions.length) {
    throw new IngestConflictError('link_insight references missing entities', {
      missingUnits: missingUnits.length ? missingUnits : undefined,
      missingMissions: missingMissions.length ? missingMissions : undefined,
    });
  }

  await db.transaction(async (tx) => {
    if (unitIds.length) {
      await tx
        .insert(insightAssets)
        .values(unitIds.map((assetId) => ({ insightId: input.insightId, assetId })))
        .onConflictDoNothing();
    }
    if (missionIds.length) {
      await tx
        .insert(insightMissions)
        .values(missionIds.map((missionId) => ({ insightId: input.insightId, missionId })))
        .onConflictDoNothing();
    }
  });

  return input.insightId;
}

async function upsertAssetTags(
  db: IngestDb,
  assetId: string,
  tagNames: string[],
  classOrCategory?: { namespace: 'class' | 'category'; name: string },
): Promise<void> {
  await db.delete(assetTags).where(eq(assetTags.assetId, assetId));
  for (const name of tagNames) {
    const tagId = await resolveOrCreateTagId(db, name);
    await db.insert(assetTags).values({ assetId, tagId }).onConflictDoNothing();
  }
  if (classOrCategory) {
    const tagId = await resolveOrCreateNamespacedTag(
      db,
      classOrCategory.namespace,
      classOrCategory.name,
    );
    await db.insert(assetTags).values({ assetId, tagId }).onConflictDoNothing();
  }
}

async function syncBayGroup(db: IngestDb, assetId: string, bay: string): Promise<void> {
  await db.delete(assetGroups).where(eq(assetGroups.assetId, assetId));
  await db.insert(assetGroups).values({ assetId, groupId: bay }).onConflictDoNothing();
}

async function syncUnitLoadoutStructure(db: IngestDb, unit: Unit): Promise<void> {
  const existingHotspots = await db
    .select()
    .from(hotspots)
    .where(eq(hotspots.hostAssetId, unit.id));
  const hotspotByCode = new Map(existingHotspots.map((h) => [h.code, h]));
  const keepHotspotCodes = new Set((unit.hotspots ?? []).map((h) => h.id));

  for (const h of unit.hotspots ?? []) {
    const ex = hotspotByCode.get(h.id);
    if (ex) {
      await db
        .update(hotspots)
        .set({ label: h.label, x: String(h.x), y: String(h.y) })
        .where(eq(hotspots.id, ex.id));
    } else {
      const [row] = await db
        .insert(hotspots)
        .values({
          hostAssetId: unit.id,
          code: h.id,
          label: h.label,
          x: String(h.x),
          y: String(h.y),
        })
        .returning();
      hotspotByCode.set(h.id, row);
    }
  }
  for (const h of existingHotspots) {
    if (!keepHotspotCodes.has(h.code)) {
      await db.delete(hotspots).where(eq(hotspots.id, h.id));
    }
  }

  const refreshedHotspots = await db
    .select()
    .from(hotspots)
    .where(eq(hotspots.hostAssetId, unit.id));
  const codeToId = new Map(refreshedHotspots.map((h) => [h.code, h.id]));

  const existingSockets = await db.select().from(sockets).where(eq(sockets.hostAssetId, unit.id));
  const socketByName = new Map(existingSockets.map((s) => [s.name, s]));
  const keepSlots = new Set((unit.loadout ?? []).map((s) => s.slot));

  for (const sl of unit.loadout ?? []) {
    const hotspotId = sl.hotspotId ? (codeToId.get(sl.hotspotId) ?? null) : null;
    const ex = socketByName.get(sl.slot);
    if (ex) {
      await db
        .update(sockets)
        .set({
          slotGroup: sl.group ?? null,
          note: sl.note ?? null,
          hotspotId,
        })
        .where(eq(sockets.id, ex.id));
    } else {
      const [row] = await db
        .insert(sockets)
        .values({
          hostAssetId: unit.id,
          slotGroup: sl.group ?? null,
          name: sl.slot,
          hotspotId,
          note: sl.note ?? null,
        })
        .returning();
      socketByName.set(sl.slot, row);
    }
  }
  for (const s of existingSockets) {
    if (!keepSlots.has(s.name)) {
      await db.delete(sockets).where(eq(sockets.id, s.id));
    }
  }

  const socketsNow = await db.select().from(sockets).where(eq(sockets.hostAssetId, unit.id));
  const nameToSocket = new Map(socketsNow.map((s) => [s.name, s]));

  for (const sl of unit.loadout ?? []) {
    const sock = nameToSocket.get(sl.slot);
    if (!sock) continue;
    if (sl.filledBy === null) {
      await db.delete(loadoutAssignments).where(eq(loadoutAssignments.socketId, sock.id));
      continue;
    }
    const missing = await assertAssetsExist(db, [sl.filledBy]);
    if (missing.length) {
      throw new IngestConflictError(`Loadout filledBy asset missing`, { missingAssets: missing });
    }
    const matches = await compatibleInterfaceIds(db, sock.id, sl.filledBy);
    if (matches.length !== 1) continue; // taxonomy may not exist yet for brand-new sockets
    await db
      .delete(loadoutAssignments)
      .where(
        and(eq(loadoutAssignments.assetId, sl.filledBy), ne(loadoutAssignments.socketId, sock.id)),
      );
    await db
      .insert(loadoutAssignments)
      .values({
        socketId: sock.id,
        assetId: sl.filledBy,
        interfaceTypeId: matches[0],
      })
      .onConflictDoUpdate({
        target: loadoutAssignments.socketId,
        set: {
          assetId: sl.filledBy,
          interfaceTypeId: matches[0],
          equippedAt: new Date(),
        },
      });
  }
}

async function opLandUnit(db: IngestDb, unit: Unit): Promise<string> {
  const kind = unit.loadout && unit.loadout.length ? 'system' : 'module';
  await db.transaction(async (tx) => {
    const t = tx as unknown as IngestDb;
    await t
      .insert(assets)
      .values({
        id: unit.id,
        kind,
        name: unit.name,
        manufacturer: null,
        model: null,
        callsign: unit.callsign ?? null,
        status: unit.status,
        lifecycle: null,
        provenance: unit.provenance ?? null,
        flagship: Boolean(unit.flagship),
        summary: unit.summary,
        description: null,
        planningNotes: null,
        monitoredVia: unit.monitoredVia ?? null,
        acquired: unit.acquired ?? null,
        horizon: unit.horizon ?? null,
        quantity: 1,
        powerWatts: numOrNull(unit.power?.watts),
        powerVolts: numOrNull(unit.power?.volts),
        powerRail: unit.power?.rail ?? null,
        massGrams: unit.massGrams ?? null,
        priceUs: numOrNull(unit.price?.us),
        priceImport: numOrNull(unit.price?.import),
        specs: unit.specs,
        links: unit.links ?? null,
        limitations: null,
        sources: null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: assets.id,
        set: {
          kind,
          name: unit.name,
          callsign: unit.callsign ?? null,
          status: unit.status,
          provenance: unit.provenance ?? null,
          flagship: Boolean(unit.flagship),
          summary: unit.summary,
          monitoredVia: unit.monitoredVia ?? null,
          acquired: unit.acquired ?? null,
          horizon: unit.horizon ?? null,
          powerWatts: numOrNull(unit.power?.watts),
          powerVolts: numOrNull(unit.power?.volts),
          powerRail: unit.power?.rail ?? null,
          massGrams: unit.massGrams ?? null,
          priceUs: numOrNull(unit.price?.us),
          priceImport: numOrNull(unit.price?.import),
          specs: unit.specs,
          links: unit.links ?? null,
          updatedAt: new Date(),
        },
      });

    await t.delete(assetShortcuts).where(eq(assetShortcuts.assetId, unit.id));
    for (const [position, sc] of (unit.shortcuts ?? []).entries()) {
      if (sc.type === 'url') {
        await t.insert(assetShortcuts).values({
          assetId: unit.id,
          shortcutId: sc.id,
          position,
          label: sc.label,
          type: 'url',
          url: sc.url,
          command: null,
          note: sc.note ?? null,
        });
      } else {
        await t.insert(assetShortcuts).values({
          assetId: unit.id,
          shortcutId: sc.id,
          position,
          label: sc.label,
          type: 'command',
          url: null,
          command: sc.command,
          note: sc.note ?? null,
        });
      }
    }

    await syncBayGroup(t, unit.id, unit.bay);
    await upsertAssetTags(t, unit.id, unit.tags ?? [], { namespace: 'class', name: unit.class });

    await t.delete(assetCapabilities).where(eq(assetCapabilities.assetId, unit.id));
    for (const capabilityId of unit.capabilities ?? []) {
      await t
        .insert(assetCapabilities)
        .values({ assetId: unit.id, capabilityId })
        .onConflictDoNothing();
    }

    await syncUnitLoadoutStructure(t, unit);
  });
  return unit.id;
}

async function opLandItem(db: IngestDb, item: InventoryItem): Promise<string> {
  const life =
    item.status === 'on-order' ? 'on-order' : item.status === 'owned' ? 'inventory' : null;
  await db.transaction(async (tx) => {
    const t = tx as unknown as IngestDb;
    await t
      .insert(assets)
      .values({
        id: item.id,
        kind: 'peripheral',
        name: item.name,
        manufacturer: item.manufacturer ?? null,
        model: item.model ?? null,
        callsign: null,
        status: item.status,
        lifecycle: life,
        provenance: item.provenance ?? null,
        flagship: false,
        summary: item.summary,
        description: item.description,
        planningNotes: item.planningNotes ?? null,
        monitoredVia: null,
        acquired: item.acquired ?? null,
        horizon: item.horizon ?? null,
        quantity: item.quantity ?? 1,
        powerWatts: null,
        powerVolts: null,
        powerRail: null,
        massGrams: null,
        priceUs: numOrNull(item.price?.us),
        priceImport: numOrNull(item.price?.import),
        specs: item.specs,
        links: null,
        limitations: item.limitations ?? null,
        sources: item.sources ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: assets.id,
        set: {
          name: item.name,
          manufacturer: item.manufacturer ?? null,
          model: item.model ?? null,
          status: item.status,
          lifecycle: life,
          provenance: item.provenance ?? null,
          summary: item.summary,
          description: item.description,
          planningNotes: item.planningNotes ?? null,
          acquired: item.acquired ?? null,
          horizon: item.horizon ?? null,
          quantity: item.quantity ?? 1,
          priceUs: numOrNull(item.price?.us),
          priceImport: numOrNull(item.price?.import),
          specs: item.specs,
          limitations: item.limitations ?? null,
          sources: item.sources ?? null,
          updatedAt: new Date(),
        },
      });
    await syncBayGroup(t, item.id, item.bay);
    await upsertAssetTags(t, item.id, item.tags ?? [], {
      namespace: 'category',
      name: item.category,
    });
  });
  return item.id;
}

async function opLandWishlist(db: IngestDb, wi: WishlistItem): Promise<string> {
  if (wi.forUnit) {
    const missing = await assertAssetsExist(db, [wi.forUnit]);
    if (missing.length) {
      throw new IngestConflictError('Wishlist forUnit missing', { missingUnits: missing });
    }
  }
  if (wi.forMission) {
    const missing = await assertMissionsExist(db, [wi.forMission]);
    if (missing.length) {
      throw new IngestConflictError('Wishlist forMission missing', { missingMissions: missing });
    }
  }

  await db.transaction(async (tx) => {
    const t = tx as unknown as IngestDb;
    await t
      .insert(assets)
      .values({
        id: wi.id,
        kind: 'module',
        name: wi.name,
        manufacturer: null,
        model: null,
        callsign: null,
        status: wi.status,
        lifecycle: 'wishlist',
        provenance: 'inferred',
        flagship: false,
        summary: wi.rationale,
        description: null,
        planningNotes: null,
        monitoredVia: null,
        acquired: null,
        horizon: wi.horizon ?? null,
        quantity: 1,
        powerWatts: numOrNull(wi.power?.watts),
        powerVolts: numOrNull(wi.power?.volts),
        powerRail: wi.power?.rail ?? null,
        massGrams: wi.massGrams ?? null,
        priceUs: numOrNull(wi.price.us),
        priceImport: numOrNull(wi.price.import),
        specs: null,
        links: null,
        limitations: null,
        sources: null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: assets.id,
        set: {
          name: wi.name,
          status: wi.status,
          lifecycle: 'wishlist',
          summary: wi.rationale,
          horizon: wi.horizon ?? null,
          powerWatts: numOrNull(wi.power?.watts),
          powerVolts: numOrNull(wi.power?.volts),
          powerRail: wi.power?.rail ?? null,
          massGrams: wi.massGrams ?? null,
          priceUs: numOrNull(wi.price.us),
          priceImport: numOrNull(wi.price.import),
          updatedAt: new Date(),
        },
      });

    await t.delete(wishlistMeta).where(eq(wishlistMeta.assetId, wi.id));
    await t.insert(wishlistMeta).values({
      assetId: wi.id,
      assetLifecycle: 'wishlist',
      rationale: wi.rationale,
      unlocksCapabilityId: wi.unlocks ?? null,
      riskNote: wi.riskNote ?? null,
      forAssetId: wi.forUnit ?? null,
      forMissionId: wi.forMission ?? null,
      source: wi.source ?? null,
    });

    await upsertAssetTags(t, wi.id, [], { namespace: 'category', name: wi.category });
  });
  return wi.id;
}

export async function opLandMission(db: IngestDb, mission: Mission): Promise<string> {
  const missingUnits = await assertAssetsExist(db, mission.requisitionedUnits);
  if (missingUnits.length) {
    throw new IngestConflictError('Mission requisitionedUnits missing', { missingUnits });
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(missions)
      .values({
        id: mission.id,
        code: mission.code,
        name: mission.name,
        status: mission.status,
        objective: mission.objective,
        environment: mission.environment ?? null,
        requiredLoadout: mission.requiredLoadout,
      })
      .onConflictDoUpdate({
        target: missions.id,
        set: {
          code: mission.code,
          name: mission.name,
          status: mission.status,
          objective: mission.objective,
          environment: mission.environment ?? null,
          requiredLoadout: mission.requiredLoadout,
        },
      });

    await tx.delete(missionRequisitions).where(eq(missionRequisitions.missionId, mission.id));
    if (mission.requisitionedUnits.length) {
      await tx.insert(missionRequisitions).values(
        mission.requisitionedUnits.map((assetId) => ({
          missionId: mission.id,
          assetId,
        })),
      );
    }

    await tx.delete(missionObjectives).where(eq(missionObjectives.missionId, mission.id));
    if (mission.objectives.length) {
      await tx.insert(missionObjectives).values(
        mission.objectives.map((o) => ({
          missionId: mission.id,
          text: o.text,
          done: o.done,
        })),
      );
    }

    await tx.delete(missionConstraints).where(eq(missionConstraints.missionId, mission.id));
    if (mission.constraints.length) {
      await tx.insert(missionConstraints).values(
        mission.constraints.map((c) => ({
          missionId: mission.id,
          label: c.label,
          value: String(c.value),
          budget: String(c.budget),
          unit: c.unit,
        })),
      );
    }

    await tx.delete(missionAfterActions).where(eq(missionAfterActions.missionId, mission.id));
    for (const [position, text] of (mission.afterAction ?? []).entries()) {
      await tx.insert(missionAfterActions).values({
        missionId: mission.id,
        position,
        text,
      });
    }
  });

  return mission.id;
}

async function opLandDocument(db: IngestDb, doc: DocumentRef): Promise<string> {
  const unitIds = doc.units ?? [];
  const missingUnits = await assertAssetsExist(db, unitIds);
  if (missingUnits.length) {
    throw new IngestConflictError('Document units missing', { missingUnits });
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(documents)
      .values({
        id: doc.id,
        title: doc.title,
        kind: doc.kind,
        libraryPath: doc.libraryPath,
        url: doc.url ?? null,
        note: doc.note ?? null,
      })
      .onConflictDoUpdate({
        target: documents.id,
        set: {
          title: doc.title,
          kind: doc.kind,
          libraryPath: doc.libraryPath,
          url: doc.url ?? null,
          note: doc.note ?? null,
        },
      });

    await tx.delete(documentAssets).where(eq(documentAssets.documentId, doc.id));
    if (unitIds.length) {
      await tx.insert(documentAssets).values(
        unitIds.map((assetId) => ({
          documentId: doc.id,
          assetId,
        })),
      );
    }
  });

  return doc.id;
}

export async function opLandBriefing(
  db: IngestDb,
  input: z.infer<typeof landBriefingInput>,
): Promise<string> {
  const href = input.href ?? `/datacore/briefing/${input.id}`;
  const bodyMarkdown = input.bodyMarkdown;
  const repoPath = input.repoPath ?? null;
  await db
    .insert(briefings)
    .values({
      id: input.id,
      title: input.title,
      kind: input.kind,
      summary: input.summary,
      tags: input.tags ?? [],
      aliases: input.aliases ?? [],
      packId: input.packId ?? null,
      capturedAt: input.capturedAt ?? null,
      href,
      bodyMarkdown,
      repoPath,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: briefings.id,
      set: {
        title: input.title,
        kind: input.kind,
        summary: input.summary,
        tags: input.tags ?? [],
        aliases: input.aliases ?? [],
        packId: input.packId ?? null,
        capturedAt: input.capturedAt ?? null,
        href,
        bodyMarkdown,
        repoPath,
        updatedAt: new Date(),
      },
    });
  return input.id;
}

export async function opLandPack(
  db: IngestDb,
  input: z.infer<typeof landPackInput>,
): Promise<string> {
  await db
    .insert(briefingPacks)
    .values({
      id: input.id,
      title: input.title,
      code: input.code,
      summary: input.summary,
      hubBriefingId: input.hubBriefingId ?? null,
      topics: input.topics,
    })
    .onConflictDoUpdate({
      target: briefingPacks.id,
      set: {
        title: input.title,
        code: input.code,
        summary: input.summary,
        hubBriefingId: input.hubBriefingId ?? null,
        topics: input.topics,
      },
    });
  return input.id;
}

// ── Dispatcher ───────────────────────────────────────────────────────────────

export async function executeIngestOp(db: IngestDb, body: IngestBody): Promise<IngestResult> {
  let id: string;
  switch (body.op) {
    case 'append_insight':
      id = await opAppendInsight(db, body.input);
      break;
    case 'append_activity':
      id = await opAppendActivity(db, body.input);
      break;
    case 'patch_status':
      id = await opPatchStatus(db, body.input);
      break;
    case 'assign_loadout':
      id = await opAssignLoadout(db, body.input);
      break;
    case 'link_insight':
      id = await opLinkInsight(db, body.input);
      break;
    case 'land_unit':
      id = await opLandUnit(db, body.input);
      break;
    case 'land_item':
      id = await opLandItem(db, body.input);
      break;
    case 'land_wishlist':
      id = await opLandWishlist(db, body.input);
      break;
    case 'land_mission':
      id = await opLandMission(db, body.input);
      break;
    case 'land_document':
      id = await opLandDocument(db, body.input);
      break;
    case 'land_briefing':
      id = await opLandBriefing(db, body.input);
      break;
    case 'land_pack':
      id = await opLandPack(db, body.input);
      break;
    default: {
      const _exhaustive: never = body;
      throw new Error(`Unsupported op: ${JSON.stringify(_exhaustive)}`);
    }
  }
  return { ok: true, op: body.op, id };
}

/** Production entry: resolve Drizzle from env pool, then run the op. */
export async function ingestHangarOp(body: IngestBody): Promise<IngestResult> {
  const db = await getHangarDrizzle();
  if (!db) {
    throw new IngestUnavailableError('Hangar database is not configured');
  }
  return executeIngestOp(db, body);
}
