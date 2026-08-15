import { describe, expect, it } from 'vitest';
import {
  HANGAR_FALLBACK_REASON_META,
  HANGAR_FALLBACK_REASONS,
  HANGAR_READ_LANE_META,
  HANGAR_READ_LANES,
  HANGAR_READ_SOURCE_META,
  HANGAR_READ_SOURCES,
  hangarFallbackDetail,
  hangarReadStatusLabel,
} from '@/lib/hangar-read-status';

describe('hangar read status presentation', () => {
  it('has display metadata for every read source', () => {
    expect(Object.keys(HANGAR_READ_SOURCE_META).sort()).toEqual([...HANGAR_READ_SOURCES].sort());
    expect(HANGAR_READ_SOURCE_META.postgres).toEqual({
      label: 'PG',
      dotClass: 'bg-signal-ok',
    });
    expect(HANGAR_READ_SOURCE_META.unavailable).toEqual({
      label: 'DOWN',
      dotClass: 'bg-amber',
    });
  });

  it('has display metadata for every fallback reason', () => {
    expect(Object.keys(HANGAR_FALLBACK_REASON_META).sort()).toEqual(
      [...HANGAR_FALLBACK_REASONS].sort(),
    );
    expect(HANGAR_FALLBACK_REASON_META['not-configured']).toEqual({
      label: 'NOT CFG',
    });
    expect(HANGAR_FALLBACK_REASON_META['postgres-error']).toEqual({
      label: 'PG ERR',
    });
  });

  it('has lane-specific fallback copy for every fallback reason', () => {
    expect(Object.keys(HANGAR_READ_LANE_META).sort()).toEqual([...HANGAR_READ_LANES].sort());
    expect(HANGAR_READ_LANE_META.inventory).toEqual({
      downDetail: 'Inventory Postgres is unreachable. There is no TypeScript catalog.',
      downReasonDetails: {
        'not-configured':
          'Inventory Postgres is not configured. There is no TypeScript catalog.',
        'postgres-error':
          'Inventory Postgres read failed. There is no TypeScript catalog.',
      },
    });

    HANGAR_READ_LANES.forEach((lane) => {
      expect(Object.keys(HANGAR_READ_LANE_META[lane].downReasonDetails).sort()).toEqual(
        [...HANGAR_FALLBACK_REASONS].sort(),
      );
    });
  });

  it('formats compact read labels for the shell status line', () => {
    expect(hangarReadStatusLabel({ source: 'postgres' })).toBe('PG');
    expect(hangarReadStatusLabel({ source: 'unavailable' })).toBe('DOWN');
    expect(hangarReadStatusLabel({ source: 'unavailable', fallbackReason: 'not-configured' })).toBe(
      'DOWN · NOT CFG',
    );
    expect(hangarReadStatusLabel({ source: 'unavailable', fallbackReason: 'postgres-error' })).toBe(
      'DOWN · PG ERR',
    );
  });

  it('returns banner detail for fallback and unknown-static cases', () => {
    expect(hangarFallbackDetail('inventory', 'not-configured')).toBe(
      'Inventory Postgres is not configured. There is no TypeScript catalog.',
    );
    expect(hangarFallbackDetail('inventory', 'postgres-error')).toBe(
      'Inventory Postgres read failed. There is no TypeScript catalog.',
    );
    expect(hangarFallbackDetail('inventory')).toBe(
      'Inventory Postgres is unreachable. There is no TypeScript catalog.',
    );
  });
});
