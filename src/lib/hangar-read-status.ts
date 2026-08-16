export const HANGAR_READ_SOURCES = ['postgres', 'unavailable'] as const;
export type HangarReadSource = (typeof HANGAR_READ_SOURCES)[number];

export const HANGAR_FALLBACK_REASONS = ['not-configured', 'postgres-error'] as const;
export type HangarFallbackReason = (typeof HANGAR_FALLBACK_REASONS)[number];

export const HANGAR_READ_LANES = ['inventory', 'spine'] as const;
export type HangarReadLane = (typeof HANGAR_READ_LANES)[number];

export type HangarReadStatus =
  | {
      source: 'postgres';
      fallbackReason?: undefined;
    }
  | {
      source: 'unavailable';
      fallbackReason?: HangarFallbackReason;
    };

export const HANGAR_READ_SOURCE_META: Record<
  HangarReadSource,
  {
    label: string;
    dotClass: string;
  }
> = {
  postgres: {
    label: 'PG',
    dotClass: 'bg-signal-ok',
  },
  unavailable: {
    label: 'DOWN',
    dotClass: 'bg-amber',
  },
};

export const HANGAR_FALLBACK_REASON_META: Record<
  HangarFallbackReason,
  {
    label: string;
  }
> = {
  'not-configured': {
    label: 'NOT CFG',
  },
  'postgres-error': {
    label: 'PG ERR',
  },
};

export const HANGAR_READ_LANE_META: Record<
  HangarReadLane,
  {
    downDetail: string;
    downReasonDetails: Record<HangarFallbackReason, string>;
  }
> = {
  inventory: {
    downDetail: 'Inventory Postgres is unreachable. There is no TypeScript catalog.',
    downReasonDetails: {
      'not-configured': 'Inventory Postgres is not configured. There is no TypeScript catalog.',
      'postgres-error': 'Inventory Postgres read failed. There is no TypeScript catalog.',
    },
  },
  spine: {
    downDetail: 'Hangar Postgres is unreachable. There is no offline inventory.',
    downReasonDetails: {
      'not-configured': 'Hangar Postgres is not configured. There is no offline inventory.',
      'postgres-error': 'Hangar Postgres spine read failed. There is no offline inventory.',
    },
  },
};

export function hangarReadStatusLabel(status: HangarReadStatus): string {
  const sourceLabel = HANGAR_READ_SOURCE_META[status.source].label;
  if (status.source === 'postgres') return sourceLabel;

  const fallbackLabel = status.fallbackReason
    ? HANGAR_FALLBACK_REASON_META[status.fallbackReason].label
    : null;

  return fallbackLabel ? `${sourceLabel} · ${fallbackLabel}` : sourceLabel;
}

export function hangarFallbackDetail(
  lane: HangarReadLane,
  fallbackReason?: HangarFallbackReason,
): string {
  const laneMeta = HANGAR_READ_LANE_META[lane];
  return fallbackReason ? laneMeta.downReasonDetails[fallbackReason] : laneMeta.downDetail;
}
