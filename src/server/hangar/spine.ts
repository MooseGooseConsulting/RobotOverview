import { hangarData as staticHangarData, isHangarBayId } from '@/data/hangar';
import type {
  ActivityEvent,
  Bay,
  Capability,
  DocumentRef,
  HangarData,
  Hotspot,
  Insight,
  InventoryItem,
  LoadoutSlot,
  Mission,
  MissionObjective,
  Net,
  Price,
  PowerProfile,
  SourceRecord,
  SpecRow,
  Terminal,
  Unit,
  UnitShortcut,
  WishlistItem,
} from '@/data/types';
import {
  ACTIVITY_KINDS,
  BAY_ACCENTS,
  DOCUMENT_KINDS,
  INVENTORY_ITEM_STATUSES,
  INSIGHT_CONFIDENCE_LEVELS,
  MISSION_CONSTRAINT_UNITS,
  MISSION_STATUSES,
  NET_KINDS,
  POWER_RAILS,
  PROVENANCE_KINDS,
  TERMINAL_ROLES,
  UNIT_STATUSES,
  UNIT_SHORTCUT_TYPES,
  WISHLIST_STATUSES,
  isSourceRecordKind,
} from '@/data/types';
import type { HangarFallbackReason } from '@/lib/hangar-read-status';
import { asc, eq } from 'drizzle-orm';
import { getHangarDrizzle, type HangarDrizzle } from './drizzle';
import * as tables from './schema';
import {
  isTrimmedHttpUrl,
  isTrimmedNonBlankString,
  isTrimmedTimestamp,
  nonNegativeNumberOrNull,
  numberOrNull,
  positiveIntegerOrNull,
  postgresNonBlankTextArray,
  strictObjectArray,
} from './validators';

export type HangarSpineRead =
  | { source: 'postgres'; data: HangarData }
  | { source: 'static'; fallbackReason: HangarFallbackReason; data: HangarData };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Minimal structural check — full integrity stays in hangar-integrity. */
function isHangarDataPayload(value: unknown): value is HangarData {
  if (!isRecord(value)) return false;
  return (
    isRecord(value.meta) &&
    Array.isArray(value.bays) &&
    Array.isArray(value.items) &&
    Array.isArray(value.units) &&
    Array.isArray(value.missions) &&
    Array.isArray(value.wishlist) &&
    Array.isArray(value.capabilities) &&
    Array.isArray(value.insights) &&
    Array.isArray(value.activity) &&
    Array.isArray(value.terminals) &&
    Array.isArray(value.nets) &&
    Array.isArray(value.documents)
  );
}

function staticFallback(reason: HangarFallbackReason): HangarSpineRead {
  return {
    source: 'static',
    fallbackReason: reason,
    data: staticHangarData,
  };
}

function optionalArray<T>(value: T[]): T[] | undefined {
  return value.length ? value : undefined;
}

function tryEnum<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
  label: string,
  id: string,
): T | null {
  if (value == null) return null;
  if (allowed.includes(value as T)) return value as T;
  console.warn(`hangar spine: skip ${label} for "${id}": invalid ${value}`);
  return null;
}

function mapPrice(
  us: string | number | null,
  imp: string | number | null,
): Price | undefined {
  const priceUs = us == null ? null : nonNegativeNumberOrNull(us, 'price_us');
  const priceImport = imp == null ? null : nonNegativeNumberOrNull(imp, 'price_import');
  if (priceUs === null && priceImport === null) return undefined;
  return { us: priceUs, import: priceImport };
}

function mapPower(
  watts: string | number | null,
  volts: string | number | null,
  rail: string | null,
  id: string,
): PowerProfile | undefined {
  if (watts == null && volts == null && rail == null) return undefined;
  const power: PowerProfile = {
    watts: watts == null ? null : numberOrNull(watts, `power_watts:${id}`),
  };
  if (volts != null) power.volts = numberOrNull(volts, `power_volts:${id}`);
  if (rail != null) {
    const parsed = tryEnum(rail, POWER_RAILS, 'power rail', id);
    if (parsed) power.rail = parsed;
  }
  return power;
}

function specRows(value: unknown, id: string): SpecRow[] {
  try {
    return strictObjectArray(
      value,
      `specs:${id}`,
      (row): row is SpecRow =>
        Boolean(row) &&
        typeof row === 'object' &&
        isTrimmedNonBlankString((row as SpecRow).label) &&
        isTrimmedNonBlankString((row as SpecRow).value),
    );
  } catch (error) {
    console.warn(
      `hangar spine: skip specs for "${id}":`,
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

function linkRows(value: unknown, id: string): { label: string; url: string }[] | undefined {
  if (value == null) return undefined;
  try {
    const links = strictObjectArray(
      value,
      `links:${id}`,
      (row): row is { label: string; url: string } =>
        Boolean(row) &&
        typeof row === 'object' &&
        isTrimmedNonBlankString((row as { label: string }).label) &&
        isTrimmedHttpUrl((row as { url: string }).url),
    );
    return optionalArray(links);
  } catch (error) {
    console.warn(
      `hangar spine: skip links for "${id}":`,
      error instanceof Error ? error.message : error,
    );
    return undefined;
  }
}

function sourceRecords(value: unknown, id: string): SourceRecord[] | undefined {
  if (value == null) return undefined;
  try {
    const records = strictObjectArray(
      value,
      `sources:${id}`,
      (row): row is SourceRecord => {
        if (!row || typeof row !== 'object') return false;
        const record = row as Partial<Record<keyof SourceRecord, unknown>>;
        return (
          isTrimmedNonBlankString(record.label) &&
          isTrimmedHttpUrl(record.url) &&
          isTrimmedTimestamp(record.accessedAt) &&
          isSourceRecordKind(record.kind)
        );
      },
    );
    return optionalArray(records);
  } catch (error) {
    console.warn(
      `hangar spine: skip sources for "${id}":`,
      error instanceof Error ? error.message : error,
    );
    return undefined;
  }
}

function limitationsList(value: unknown, id: string): string[] | undefined {
  if (value == null) return undefined;
  try {
    return optionalArray(postgresNonBlankTextArray(value, `limitations:${id}`));
  } catch (error) {
    console.warn(
      `hangar spine: skip limitations for "${id}":`,
      error instanceof Error ? error.message : error,
    );
    return undefined;
  }
}

/** Match fixture date-only vs full ISO (activity uses `...Z` without millis). */
function formatHangarTimestamp(value: Date | string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  const iso = date.toISOString();
  if (iso.endsWith('T00:00:00.000Z')) return iso.slice(0, 10);
  return iso.replace(/\.000Z$/, 'Z');
}

function shortcutIdFromLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function groupBy<K, V>(rows: V[], key: (row: V) => K): Map<K, V[]> {
  const map = new Map<K, V[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return map;
}

function pushUnique(map: Map<string, string[]>, key: string, value: string) {
  const list = map.get(key) ?? [];
  if (!list.includes(value)) list.push(value);
  map.set(key, list);
}

/**
 * Reconstruct the Hangar UI spine from normalized tables (inverse of gen-seed.ts).
 * Exported for parity tests that inject a pg-mem Drizzle client.
 */
export async function buildHangarDataFromDb(db: HangarDrizzle): Promise<HangarData> {
  const [
    metaRows,
    groupRows,
    assetRows,
    assetGroupRows,
    tagRows,
    assetTagRows,
    hotspotRows,
    socketRows,
    assignmentRows,
    shortcutRows,
    wishlistMetaRows,
    missionRows,
    requisitionRows,
    objectiveRows,
    constraintRows,
    afterActionRows,
    capabilityRows,
    capabilityDepRows,
    assetCapabilityRows,
    insightRows,
    insightAssetRows,
    insightMissionRows,
    insightTagRows,
    activityRows,
    terminalRows,
    netRows,
    netTerminalRows,
    documentRows,
    documentAssetRows,
    netDocumentRows,
  ] = await Promise.all([
    db.select().from(tables.hangarMeta).where(eq(tables.hangarMeta.id, 'hangar')).limit(1),
    db.select().from(tables.groups),
    db.select().from(tables.assets),
    db.select().from(tables.assetGroups),
    db.select().from(tables.tags),
    db.select().from(tables.assetTags),
    db.select().from(tables.hotspots).orderBy(asc(tables.hotspots.id)),
    db.select().from(tables.sockets).orderBy(asc(tables.sockets.id)),
    db.select().from(tables.loadoutAssignments),
    db.select().from(tables.assetShortcuts).orderBy(asc(tables.assetShortcuts.position)),
    db.select().from(tables.wishlistMeta),
    db.select().from(tables.missions),
    db.select().from(tables.missionRequisitions),
    db.select().from(tables.missionObjectives).orderBy(asc(tables.missionObjectives.id)),
    db.select().from(tables.missionConstraints).orderBy(asc(tables.missionConstraints.id)),
    db
      .select()
      .from(tables.missionAfterActions)
      .orderBy(asc(tables.missionAfterActions.position)),
    db.select().from(tables.capabilities),
    db.select().from(tables.capabilityDeps),
    db.select().from(tables.assetCapabilities),
    db.select().from(tables.insights),
    db.select().from(tables.insightAssets),
    db.select().from(tables.insightMissions),
    db.select().from(tables.insightTags),
    db.select().from(tables.activityLog),
    db.select().from(tables.terminals),
    db.select().from(tables.nets),
    db.select().from(tables.netTerminals),
    db.select().from(tables.documents),
    db.select().from(tables.documentAssets),
    db.select().from(tables.netDocuments),
  ]);

  const metaRow = metaRows[0];
  if (!metaRow) {
    throw new Error('hangar spine: hangar_meta row id=hangar is missing');
  }

  const tagsById = new Map(tagRows.map((t) => [t.id, t]));

  const bayByAsset = new Map<string, string>();
  for (const ag of assetGroupRows) {
    const group = groupRows.find((g) => g.id === ag.groupId);
    if (group?.kind === 'bay') bayByAsset.set(ag.assetId, group.id);
  }

  const tagsByAsset = new Map<string, { ns: string; name: string }[]>();
  for (const at of assetTagRows) {
    const tag = tagsById.get(at.tagId);
    if (!tag) continue;
    const list = tagsByAsset.get(at.assetId) ?? [];
    list.push({ ns: tag.namespace, name: tag.name });
    tagsByAsset.set(at.assetId, list);
  }

  const hotspotsByHost = groupBy(hotspotRows, (h) => h.hostAssetId);
  const socketsByHost = groupBy(socketRows, (s) => s.hostAssetId);
  const assignmentBySocket = new Map(assignmentRows.map((a) => [a.socketId, a.assetId]));
  const shortcutsByAsset = groupBy(shortcutRows, (s) => s.assetId);
  const wishlistMetaByAsset = new Map(wishlistMetaRows.map((w) => [w.assetId, w]));

  const capsByAsset = new Map<string, string[]>();
  const unlockedByCap = new Map<string, string[]>();
  for (const row of assetCapabilityRows) {
    pushUnique(capsByAsset, row.assetId, row.capabilityId);
    pushUnique(unlockedByCap, row.capabilityId, row.assetId);
  }

  const depsByCap = new Map<string, string[]>();
  for (const row of capabilityDepRows) {
    pushUnique(depsByCap, row.capabilityId, row.dependsOnId);
  }

  const missionsByAsset = new Map<string, string[]>();
  const unitsByMission = new Map<string, string[]>();
  for (const row of requisitionRows) {
    pushUnique(missionsByAsset, row.assetId, row.missionId);
    pushUnique(unitsByMission, row.missionId, row.assetId);
  }

  const insightsByAsset = new Map<string, string[]>();
  const unitsByInsight = new Map<string, string[]>();
  for (const row of insightAssetRows) {
    pushUnique(insightsByAsset, row.assetId, row.insightId);
    pushUnique(unitsByInsight, row.insightId, row.assetId);
  }

  const missionsByInsight = new Map<string, string[]>();
  const insightsByMission = new Map<string, string[]>();
  for (const row of insightMissionRows) {
    pushUnique(missionsByInsight, row.insightId, row.missionId);
    pushUnique(insightsByMission, row.missionId, row.insightId);
  }

  const tagsByInsight = new Map<string, string[]>();
  for (const row of insightTagRows) {
    const tag = tagsById.get(row.tagId);
    if (!tag || tag.namespace !== 'tag') continue;
    pushUnique(tagsByInsight, row.insightId, tag.name);
  }

  const wishlistIdsByMission = new Map<string, string[]>();
  for (const wm of wishlistMetaRows) {
    if (wm.forMissionId) pushUnique(wishlistIdsByMission, wm.forMissionId, wm.assetId);
  }

  const relatedUnitsByItem = new Map<string, string[]>();
  for (const assignment of assignmentRows) {
    const socket = socketRows.find((s) => s.id === assignment.socketId);
    if (!socket) continue;
    pushUnique(relatedUnitsByItem, assignment.assetId, socket.hostAssetId);
  }

  const objectivesByMission = groupBy(objectiveRows, (o) => o.missionId);
  const constraintsByMission = groupBy(constraintRows, (c) => c.missionId);
  const afterActionsByMission = groupBy(afterActionRows, (a) => a.missionId);

  const unitsByDocument = new Map<string, string[]>();
  for (const row of documentAssetRows) {
    pushUnique(unitsByDocument, row.documentId, row.assetId);
  }

  const terminalsByNet = new Map<string, string[]>();
  for (const row of netTerminalRows) {
    pushUnique(terminalsByNet, row.netId, row.terminalId);
  }

  const documentsByNet = new Map<string, string[]>();
  for (const row of netDocumentRows) {
    pushUnique(documentsByNet, row.netId, row.documentId);
  }

  const hotspotCodeById = new Map(hotspotRows.map((h) => [h.id, h.code]));

  // ── meta ───────────────────────────────────────────────────────────────────
  const meta = {
    title: metaRow.title,
    operator: metaRow.operator,
    codename: metaRow.codename,
    updated: metaRow.updated,
  };

  // ── bays ───────────────────────────────────────────────────────────────────
  const bays: Bay[] = [];
  for (const g of groupRows) {
    if (g.kind !== 'bay') continue;
    if (!isHangarBayId(g.id)) {
      console.warn(`hangar spine: skip bay "${g.id}": invalid bay id`);
      continue;
    }
    const accent = tryEnum(g.accent, BAY_ACCENTS, 'bay accent', g.id);
    if (!accent || !g.code || !g.tagline) {
      console.warn(`hangar spine: skip bay "${g.id}": missing code/tagline/accent`);
      continue;
    }
    bays.push({
      id: g.id,
      name: g.name,
      code: g.code,
      tagline: g.tagline,
      accent,
    });
  }

  // ── units / items / wishlist from assets ───────────────────────────────────
  const units: Unit[] = [];
  const items: InventoryItem[] = [];
  const wishlist: WishlistItem[] = [];

  for (const asset of assetRows) {
    if (asset.lifecycle === 'wishlist') {
      const status = tryEnum(asset.status, WISHLIST_STATUSES, 'wishlist status', asset.id);
      if (!status) continue;
      const wm = wishlistMetaByAsset.get(asset.id);
      const categoryTag = (tagsByAsset.get(asset.id) ?? []).find((t) => t.ns === 'category');
      const price = mapPrice(asset.priceUs, asset.priceImport) ?? { us: null, import: null };
      const item: WishlistItem = {
        id: asset.id,
        name: asset.name,
        category: categoryTag?.name ?? 'Uncategorized',
        rationale: wm?.rationale ?? asset.summary ?? '',
        price,
        status,
      };
      if (wm?.forAssetId) item.forUnit = wm.forAssetId;
      if (wm?.forMissionId) item.forMission = wm.forMissionId;
      if (wm?.unlocksCapabilityId) item.unlocks = wm.unlocksCapabilityId;
      if (wm?.riskNote) item.riskNote = wm.riskNote;
      if (wm?.source) item.source = wm.source;
      if (asset.horizon) item.horizon = asset.horizon;
      const power = mapPower(asset.powerWatts, asset.powerVolts, asset.powerRail, asset.id);
      if (power) item.power = power;
      if (asset.massGrams != null) item.massGrams = asset.massGrams;
      wishlist.push(item);
      continue;
    }

    if (asset.kind === 'peripheral') {
      const status = tryEnum(asset.status, INVENTORY_ITEM_STATUSES, 'inventory status', asset.id);
      if (!status) continue;
      const bayId = bayByAsset.get(asset.id);
      if (!bayId || !isHangarBayId(bayId)) {
        console.warn(`hangar spine: skip item "${asset.id}": missing/invalid bay`);
        continue;
      }
      let quantity: number;
      try {
        const q = positiveIntegerOrNull(asset.quantity, `quantity:${asset.id}`);
        if (q === null) throw new Error('null quantity');
        quantity = q;
      } catch {
        console.warn(`hangar spine: skip item "${asset.id}": invalid quantity`);
        continue;
      }
      const categoryTag = (tagsByAsset.get(asset.id) ?? []).find((t) => t.ns === 'category');
      const tagNames = (tagsByAsset.get(asset.id) ?? [])
        .filter((t) => t.ns === 'tag')
        .map((t) => t.name);
      const item: InventoryItem = {
        id: asset.id,
        name: asset.name,
        bay: bayId,
        category: categoryTag?.name ?? 'Uncategorized',
        status,
        summary: asset.summary ?? '',
        description: asset.description ?? '',
        specs: specRows(asset.specs, asset.id),
        quantity,
      };
      if (asset.manufacturer) item.manufacturer = asset.manufacturer;
      if (asset.model) item.model = asset.model;
      if (asset.planningNotes) item.planningNotes = asset.planningNotes;
      const limitations = limitationsList(asset.limitations, asset.id);
      if (limitations) item.limitations = limitations;
      const price = mapPrice(asset.priceUs, asset.priceImport);
      if (price) item.price = price;
      const tags = optionalArray(tagNames);
      if (tags) item.tags = tags;
      const relatedUnits = optionalArray(relatedUnitsByItem.get(asset.id) ?? []);
      if (relatedUnits) item.relatedUnits = relatedUnits;
      const relatedMissions = optionalArray(missionsByAsset.get(asset.id) ?? []);
      if (relatedMissions) item.relatedMissions = relatedMissions;
      const relatedCapabilities = optionalArray(capsByAsset.get(asset.id) ?? []);
      if (relatedCapabilities) item.relatedCapabilities = relatedCapabilities;
      const relatedInsights = optionalArray(insightsByAsset.get(asset.id) ?? []);
      if (relatedInsights) item.relatedInsights = relatedInsights;
      const sources = sourceRecords(asset.sources, asset.id);
      if (sources) item.sources = sources;
      if (asset.acquired) item.acquired = asset.acquired;
      if (asset.horizon) item.horizon = asset.horizon;
      if (asset.provenance) {
        const provenance = tryEnum(asset.provenance, PROVENANCE_KINDS, 'provenance', asset.id);
        if (provenance) item.provenance = provenance;
      }
      items.push(item);
      continue;
    }

    if (asset.kind !== 'system' && asset.kind !== 'module') continue;

    const status = tryEnum(asset.status, UNIT_STATUSES, 'unit status', asset.id);
    if (!status) continue;
    const bayId = bayByAsset.get(asset.id);
    if (!bayId || !isHangarBayId(bayId)) {
      console.warn(`hangar spine: skip unit "${asset.id}": missing/invalid bay`);
      continue;
    }
    const classTag = (tagsByAsset.get(asset.id) ?? []).find((t) => t.ns === 'class');
    if (!classTag) {
      console.warn(`hangar spine: skip unit "${asset.id}": missing class tag`);
      continue;
    }
    const tagNames = (tagsByAsset.get(asset.id) ?? [])
      .filter((t) => t.ns === 'tag')
      .map((t) => t.name);

    const hotspots: Hotspot[] = (hotspotsByHost.get(asset.id) ?? []).flatMap((h) => {
      try {
        const x = numberOrNull(h.x, `hotspot.x:${asset.id}/${h.code}`);
        const y = numberOrNull(h.y, `hotspot.y:${asset.id}/${h.code}`);
        if (x === null || y === null || !h.label) {
          console.warn(`hangar spine: skip hotspot "${h.code}" on "${asset.id}"`);
          return [];
        }
        return [{ id: h.code, label: h.label, x, y }];
      } catch {
        console.warn(`hangar spine: skip hotspot "${h.code}" on "${asset.id}"`);
        return [];
      }
    });

    const loadout: LoadoutSlot[] = (socketsByHost.get(asset.id) ?? []).map((socket) => {
      const slot: LoadoutSlot = {
        slot: socket.name,
        filledBy: assignmentBySocket.get(socket.id) ?? null,
      };
      if (socket.slotGroup) slot.group = socket.slotGroup;
      if (socket.note) slot.note = socket.note;
      if (socket.hotspotId != null) {
        const code = hotspotCodeById.get(socket.hotspotId);
        if (code) slot.hotspotId = code;
      }
      return slot;
    });

    const shortcuts: UnitShortcut[] = [];
    for (const sc of shortcutsByAsset.get(asset.id) ?? []) {
      const type = tryEnum(sc.type, UNIT_SHORTCUT_TYPES, 'shortcut type', `${asset.id}/${sc.position}`);
      if (!type) continue;
      // shortcut_id is canonical since the corpus migration; label-slug only
      // covers rows seeded before identity existed.
      const id = sc.shortcutId ?? shortcutIdFromLabel(sc.label);
      if (type === 'url') {
        if (!sc.url || !isTrimmedHttpUrl(sc.url)) {
          console.warn(`hangar spine: skip url shortcut on "${asset.id}" position ${sc.position}`);
          continue;
        }
        const shortcut: UnitShortcut = {
          id,
          label: sc.label,
          type: 'url',
          url: sc.url,
        };
        if (sc.note) shortcut.note = sc.note;
        shortcuts.push(shortcut);
      } else {
        if (!sc.command) {
          console.warn(
            `hangar spine: skip command shortcut on "${asset.id}" position ${sc.position}`,
          );
          continue;
        }
        const shortcut: UnitShortcut = {
          id,
          label: sc.label,
          type: 'command',
          command: sc.command,
        };
        if (sc.note) shortcut.note = sc.note;
        shortcuts.push(shortcut);
      }
    }

    const unit: Unit = {
      id: asset.id,
      name: asset.name,
      bay: bayId,
      class: classTag.name,
      status,
      summary: asset.summary ?? '',
      specs: specRows(asset.specs, asset.id),
    };
    if (asset.callsign) unit.callsign = asset.callsign;
    if (asset.flagship) unit.flagship = true;
    if (asset.provenance) {
      const provenance = tryEnum(asset.provenance, PROVENANCE_KINDS, 'provenance', asset.id);
      if (provenance) unit.provenance = provenance;
    }
    const price = mapPrice(asset.priceUs, asset.priceImport);
    if (price) unit.price = price;
    const power = mapPower(asset.powerWatts, asset.powerVolts, asset.powerRail, asset.id);
    if (power) unit.power = power;
    if (asset.massGrams != null) unit.massGrams = asset.massGrams;
    if (loadout.length) unit.loadout = loadout;
    if (hotspots.length) unit.hotspots = hotspots;
    const capabilities = capsByAsset.get(asset.id) ?? [];
    // Preserve explicit empty arrays when the fixture uses them (pi5); omit when absent.
    // Empty vs omitted is not distinguishable from junctions alone — prefer omit.
    const caps = optionalArray(capabilities);
    if (caps) unit.capabilities = caps;
    const missions = optionalArray(missionsByAsset.get(asset.id) ?? []);
    if (missions) unit.missions = missions;
    const insights = optionalArray(insightsByAsset.get(asset.id) ?? []);
    if (insights) unit.insights = insights;
    const tags = optionalArray(tagNames);
    if (tags) unit.tags = tags;
    if (shortcuts.length) unit.shortcuts = shortcuts;
    const links = linkRows(asset.links, asset.id);
    if (links) unit.links = links;
    if (asset.acquired) unit.acquired = asset.acquired;
    if (asset.horizon) unit.horizon = asset.horizon;
    if (asset.monitoredVia) unit.monitoredVia = asset.monitoredVia;
    units.push(unit);
  }

  // ── missions ───────────────────────────────────────────────────────────────
  const missions: Mission[] = [];
  for (const row of missionRows) {
    const status = tryEnum(row.status, MISSION_STATUSES, 'mission status', row.id);
    if (!status || !row.code || !row.objective) {
      console.warn(`hangar spine: skip mission "${row.id}": missing status/code/objective`);
      continue;
    }
    const objectives: MissionObjective[] = (objectivesByMission.get(row.id) ?? []).map((o) => ({
      text: o.text,
      done: o.done,
    }));
    const constraints = [];
    for (const c of constraintsByMission.get(row.id) ?? []) {
      const unit = tryEnum(c.unit, MISSION_CONSTRAINT_UNITS, 'constraint unit', `${row.id}/${c.label}`);
      if (!unit) continue;
      try {
        constraints.push({
          label: c.label,
          value: numberOrNull(c.value, `constraint.value:${row.id}`) as number,
          budget: numberOrNull(c.budget, `constraint.budget:${row.id}`) as number,
          unit,
        });
      } catch {
        console.warn(`hangar spine: skip constraint "${c.label}" on mission "${row.id}"`);
      }
    }
    const mission: Mission = {
      id: row.id,
      code: row.code,
      name: row.name,
      status,
      objective: row.objective,
      requisitionedUnits: unitsByMission.get(row.id) ?? [],
      requiredLoadout: row.requiredLoadout ?? [],
      wishlist: wishlistIdsByMission.get(row.id) ?? [],
      objectives,
      constraints,
    };
    if (row.environment) mission.environment = row.environment;
    const afterAction = (afterActionsByMission.get(row.id) ?? []).map((a) => a.text);
    if (afterAction.length) mission.afterAction = afterAction;
    const insightIds = optionalArray(insightsByMission.get(row.id) ?? []);
    if (insightIds) mission.insights = insightIds;
    missions.push(mission);
  }

  // ── capabilities ───────────────────────────────────────────────────────────
  const capabilities: Capability[] = [];
  for (const row of capabilityRows) {
    const cap: Capability = {
      id: row.id,
      name: row.name,
      description: row.description ?? '',
      unlockedBy: unlockedByCap.get(row.id) ?? [],
      unlocked: row.unlocked,
    };
    const dependsOn = optionalArray(depsByCap.get(row.id) ?? []);
    if (dependsOn) cap.dependsOn = dependsOn;
    if (row.bay && isHangarBayId(row.bay)) cap.bay = row.bay;
    else if (row.bay) console.warn(`hangar spine: drop invalid bay on capability "${row.id}"`);
    capabilities.push(cap);
  }

  // ── insights ───────────────────────────────────────────────────────────────
  const insights: Insight[] = [];
  for (const row of insightRows) {
    const confidence = tryEnum(row.confidence, INSIGHT_CONFIDENCE_LEVELS, 'confidence', row.id);
    const capturedAt = formatHangarTimestamp(row.capturedAt);
    if (!confidence || !capturedAt) {
      console.warn(`hangar spine: skip insight "${row.id}": missing confidence/capturedAt`);
      continue;
    }
    const insight: Insight = {
      id: row.id,
      title: row.title,
      body: row.body ?? '',
      tags: tagsByInsight.get(row.id) ?? [],
      confidence,
      capturedAt,
    };
    if (row.bay && isHangarBayId(row.bay)) insight.bay = row.bay;
    if (row.source) insight.source = row.source;
    const unitIds = optionalArray(unitsByInsight.get(row.id) ?? []);
    if (unitIds) insight.units = unitIds;
    const missionIds = optionalArray(missionsByInsight.get(row.id) ?? []);
    if (missionIds) insight.missions = missionIds;
    insights.push(insight);
  }

  // ── activity ───────────────────────────────────────────────────────────────
  const activity: ActivityEvent[] = [];
  for (const row of activityRows) {
    const kind = tryEnum(row.kind, ACTIVITY_KINDS, 'activity kind', row.id);
    const at = formatHangarTimestamp(row.at);
    if (!kind || !at || !row.text) {
      console.warn(`hangar spine: skip activity "${row.id}"`);
      continue;
    }
    activity.push({ id: row.id, at, kind, text: row.text });
  }

  // ── terminals / nets / documents ───────────────────────────────────────────
  const terminals: Terminal[] = [];
  for (const row of terminalRows) {
    const terminal: Terminal = {
      id: row.id,
      unitId: row.assetId,
      name: row.name,
    };
    if (row.connector) terminal.connector = row.connector;
    if (row.role) {
      const role = tryEnum(row.role, TERMINAL_ROLES, 'terminal role', row.id);
      if (role) terminal.role = role;
    }
    if (row.note) terminal.note = row.note;
    terminals.push(terminal);
  }

  const nets: Net[] = [];
  for (const row of netRows) {
    const kind = tryEnum(row.kind, NET_KINDS, 'net kind', row.id);
    if (!kind) continue;
    const net: Net = {
      id: row.id,
      name: row.name,
      kind,
      grain: 'module',
      terminals: terminalsByNet.get(row.id) ?? [],
    };
    if (row.carries) net.carries = row.carries;
    if (row.note) net.note = row.note;
    const docs = optionalArray(documentsByNet.get(row.id) ?? []);
    if (docs) net.documents = docs;
    nets.push(net);
  }

  const documents: DocumentRef[] = [];
  for (const row of documentRows) {
    const kind = tryEnum(row.kind, DOCUMENT_KINDS, 'document kind', row.id);
    if (!kind) continue;
    const doc: DocumentRef = {
      id: row.id,
      title: row.title,
      kind,
      libraryPath: row.libraryPath,
    };
    if (row.url) doc.url = row.url;
    if (row.note) doc.note = row.note;
    const unitIds = optionalArray(unitsByDocument.get(row.id) ?? []);
    if (unitIds) doc.units = unitIds;
    documents.push(doc);
  }

  return {
    meta,
    bays,
    items,
    units,
    missions,
    wishlist,
    capabilities,
    insights,
    activity,
    terminals,
    nets,
    documents,
  };
}

/** Load the Hangar UI spine from normalized Postgres tables, or static fallback. */
export async function getHangarSpine(): Promise<HangarSpineRead> {
  try {
    const db = await getHangarDrizzle();
    if (!db) return staticFallback('not-configured');

    const data = await buildHangarDataFromDb(db);
    if (!isHangarDataPayload(data)) {
      return staticFallback('postgres-error');
    }

    return { source: 'postgres', data };
  } catch (error) {
    console.error(
      'hangar spine: reconstruction failed, serving static fallback:',
      error instanceof Error ? error.message : error,
    );
    return staticFallback('postgres-error');
  }
}
