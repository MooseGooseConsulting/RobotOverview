import { HANGAR_BAY_IDS } from '@/data/hangar';
import type {
  InventoryItem,
  SourceRecord,
  SpecRow,
} from '@/data/types';
import { INVENTORY_ITEM_STATUSES, PROVENANCE_KINDS, isSourceRecordKind } from '@/data/types';
import type { HangarFallbackReason, HangarReadStatus } from '@/lib/hangar-read-status';
import type { Queryable } from './queryable';
import { readHangarOrUnavailable } from './read-model';
import {
  enumValue,
  isTrimmedHttpUrl,
  isTrimmedNonBlankString,
  isTrimmedTimestamp,
  nonNegativeNumberOrNull,
  positiveIntegerOrNull,
  postgresNonBlankTextArray,
  postgresTextArray,
  strictObjectArray,
} from './validators';

type InventoryItemRow = {
  id: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  bay_groups: string[] | null;
  category: string | null;
  status: string;
  provenance: string | null;
  summary: string | null;
  description: string | null;
  planning_notes: string | null;
  acquired: string | null;
  horizon: string | null;
  quantity: string | number | null;
  price_us: string | number | null;
  price_import: string | number | null;
  specs: unknown;
  limitations: unknown;
  sources: unknown;
  tags: string[] | null;
  related_units: string[] | null;
  related_missions: string[] | null;
  related_capabilities: string[] | null;
  related_insights: string[] | null;
};


const INVENTORY_ITEMS_SQL = `
  SELECT
    a.id,
    a.name,
    a.manufacturer,
    a.model,
    bay_membership.bay_groups,
    category.name AS category,
    a.status::text AS status,
    a.provenance,
    a.summary,
    a.description,
    a.planning_notes,
    a.acquired,
    a.horizon,
    a.quantity,
    a.price_us,
    a.price_import,
    a.specs,
    a.limitations,
    a.sources,
    COALESCE(
      array_remove(array_agg(DISTINCT tag.name) FILTER (WHERE tag.namespace = 'tag'), NULL),
      ARRAY[]::text[]
    ) AS tags,
    COALESCE(
      (
        SELECT array_agg(DISTINCT s.host_asset_id ORDER BY s.host_asset_id)
        FROM loadout_assignments la
        JOIN sockets s ON s.id = la.socket_id
        WHERE la.asset_id = a.id
      ),
      ARRAY[]::text[]
    ) AS related_units,
    COALESCE(
      (
        SELECT array_agg(DISTINCT mr.mission_id ORDER BY mr.mission_id)
        FROM mission_requisitions mr
        WHERE mr.asset_id = a.id
      ),
      ARRAY[]::text[]
    ) AS related_missions,
    COALESCE(
      (
        SELECT array_agg(DISTINCT ac.capability_id ORDER BY ac.capability_id)
        FROM asset_capabilities ac
        WHERE ac.asset_id = a.id
      ),
      ARRAY[]::text[]
    ) AS related_capabilities,
    COALESCE(
      (
        SELECT array_agg(DISTINCT ia.insight_id ORDER BY ia.insight_id)
        FROM insight_assets ia
        WHERE ia.asset_id = a.id
      ),
      ARRAY[]::text[]
    ) AS related_insights
  FROM assets a
  JOIN LATERAL (
    SELECT array_agg(DISTINCT bay_group.id ORDER BY bay_group.id) AS bay_groups
    FROM asset_groups ag
    JOIN groups bay_group ON bay_group.id = ag.group_id AND bay_group.kind = 'bay'
    WHERE ag.asset_id = a.id
  ) bay_membership ON true
  LEFT JOIN LATERAL (
    SELECT t.name
    FROM asset_tags item_category
    JOIN tags t ON t.id = item_category.tag_id
    WHERE item_category.asset_id = a.id AND t.namespace = 'category'
    ORDER BY t.name
    LIMIT 1
  ) category ON true
  LEFT JOIN asset_tags item_tags ON item_tags.asset_id = a.id
  LEFT JOIN tags tag ON tag.id = item_tags.tag_id
  WHERE a.kind = 'peripheral'
    AND a.status::text = ANY($1)
  GROUP BY
    a.id,
    bay_membership.bay_groups,
    category.name
  ORDER BY a.name;
`;

function specRows(value: unknown): SpecRow[] {
  return strictObjectArray(
    value,
    'inventory specs',
    (row): row is SpecRow =>
      Boolean(row) &&
      typeof row === 'object' &&
      isTrimmedNonBlankString((row as SpecRow).label) &&
      isTrimmedNonBlankString((row as SpecRow).value),
  );
}

function sourceRecords(value: unknown): SourceRecord[] | undefined {
  const records = strictObjectArray(
    value,
    'inventory sources',
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

  return records.length ? records : undefined;
}

export function mapInventoryItemRow(row: InventoryItemRow): InventoryItem {
  const bayGroups = postgresTextArray(row.bay_groups, 'bay groups');
  if (bayGroups.length !== 1) {
    const detail = bayGroups.length ? bayGroups.join(', ') : 'none';
    throw new Error(`Expected exactly one bay group for inventory item "${row.id}"; got ${detail}.`);
  }

  const bay = enumValue(bayGroups[0], HANGAR_BAY_IDS, 'bay id');
  const status = enumValue(row.status, INVENTORY_ITEM_STATUSES, 'inventory item status');

  const priceUs = nonNegativeNumberOrNull(row.price_us, 'inventory price_us');
  const priceImport = nonNegativeNumberOrNull(row.price_import, 'inventory price_import');
  const price =
    priceUs !== null || priceImport !== null
      ? { us: priceUs, import: priceImport }
      : undefined;
  const quantity = positiveIntegerOrNull(row.quantity, 'inventory quantity');
  if (quantity === null) {
    throw new Error('Invalid inventory quantity from hangar DB: expected a positive integer, got null.');
  }

  return {
    id: row.id,
    name: row.name,
    manufacturer: row.manufacturer ?? undefined,
    model: row.model ?? undefined,
    bay,
    category: row.category ?? 'Uncategorized',
    status,
    summary: row.summary ?? '',
    description: row.description ?? '',
    planningNotes: row.planning_notes ?? undefined,
    specs: specRows(row.specs),
    price,
    quantity,
    tags: optionalArray(postgresTextArray(row.tags, 'inventory tags')),
    relatedUnits: optionalArray(postgresTextArray(row.related_units, 'related units')),
    relatedMissions: optionalArray(postgresTextArray(row.related_missions, 'related missions')),
    relatedCapabilities: optionalArray(
      postgresTextArray(row.related_capabilities, 'related capabilities'),
    ),
    relatedInsights: optionalArray(postgresTextArray(row.related_insights, 'related insights')),
    sources: sourceRecords(row.sources),
    limitations: optionalArray(postgresNonBlankTextArray(row.limitations, 'inventory limitations')),
    acquired: row.acquired ?? undefined,
    horizon: row.horizon ?? undefined,
    provenance: row.provenance
      ? enumValue(row.provenance, PROVENANCE_KINDS, 'inventory provenance')
      : undefined,
  };
}

function optionalArray<T>(value: T[]): T[] | undefined {
  return value.length ? value : undefined;
}

export async function readInventoryItemsFromPostgres(client: Queryable) {
  const result = await client.query<InventoryItemRow>(INVENTORY_ITEMS_SQL, [
    INVENTORY_ITEM_STATUSES,
  ]);
  return result.rows.map(mapInventoryItemRow);
}

export type InventoryItemsRead =
  | {
      source: 'postgres';
      fallbackReason?: undefined;
      items: InventoryItem[];
    }
  | {
      source: 'unavailable';
      fallbackReason: HangarFallbackReason;
      items?: undefined;
    };

export async function getInventoryItems(): Promise<InventoryItemsRead> {
  const read = await readHangarOrUnavailable({
    label: 'inventory items',
    readFromPostgres: readInventoryItemsFromPostgres,
  });

  if (read.source === 'postgres') {
    return {
      source: 'postgres',
      items: read.data,
    };
  }

  return {
    source: 'unavailable',
    fallbackReason: read.fallbackReason,
  };
}
