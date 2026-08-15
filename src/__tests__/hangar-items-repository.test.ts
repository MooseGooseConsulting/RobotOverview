import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/hangar/items/route';
import {
  GET as GET_PREFLIGHT,
  toHangarPreflightPayload,
} from '@/app/api/hangar/preflight/route';
import { hangarData } from '@/data/hangar';
import {
  checkHangarDatabaseReachability,
  closeHangarPoolForTests,
  getHangarPoolConfig,
} from '@/server/hangar/db';
import {
  getInventoryItems,
  mapInventoryItemRow,
  readInventoryItemsFromPostgres,
} from '@/server/hangar/items';
import { readHangarOrUnavailable } from '@/server/hangar/read-model';

afterEach(async () => {
  await closeHangarPoolForTests();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('Hangar inventory Postgres read path', () => {
  function inventoryRow(
    overrides: Partial<Parameters<typeof mapInventoryItemRow>[0]> = {},
  ): Parameters<typeof mapInventoryItemRow>[0] {
    return {
      id: 'strict-row',
      name: 'Strict Row',
      manufacturer: null,
      model: null,
      bay_groups: ['network'],
      category: null,
      status: 'owned',
      provenance: 'owner',
      summary: null,
      description: null,
      planning_notes: null,
      acquired: null,
      horizon: null,
      quantity: 1,
      price_us: null,
      price_import: null,
      specs: [],
      limitations: [],
      sources: [],
      tags: [],
      related_units: [],
      related_missions: [],
      related_capabilities: [],
      related_insights: [],
      ...overrides,
    };
  }

  it('shared read helper reports unavailable when a configured Postgres read fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const client = {
      query: async <T,>(): Promise<{ rows: T[] }> => {
        throw new Error('query failed');
      },
    };

    const result = await readHangarOrUnavailable({
      label: 'test records',
      getClient: async () => client,
      readFromPostgres: async (queryable) => {
        await queryable.query('SELECT explode');
        return [{ id: 'postgres-item' }];
      },
    });

    expect(result).toEqual({
      source: 'unavailable',
      fallbackReason: 'postgres-error',
    });
    expect(console.warn).toHaveBeenCalledWith(
      'Hangar Postgres test records read failed; not serving a TypeScript roster.',
      expect.any(Error),
    );
  });

  it('reports unavailable when no database config is present', async () => {
    vi.stubEnv('HANGAR_DB_HOST', '');
    vi.stubEnv('HANGAR_DATABASE_URL', '');
    vi.stubEnv('DATABASE_URL', '');

    const result = await getInventoryItems();

    expect(result.source).toBe('unavailable');
    expect(result.fallbackReason).toBe('not-configured');
    expect(result).not.toHaveProperty('items');
  });

  it('prefers structured Hangar database config over credential-bearing URLs', () => {
    vi.stubEnv('HANGAR_DB_HOST', 'pg18-rw.data-platform.svc.cluster.local');
    vi.stubEnv('HANGAR_DB_PORT', '5432');
    vi.stubEnv('HANGAR_DB_NAME', 'hangar');
    vi.stubEnv('HANGAR_DB_USER', 'hangar');
    vi.stubEnv('HANGAR_DB_PASSWORD', ' temporary-or-runtime-secret ');
    vi.stubEnv('HANGAR_DB_SSLMODE', 'require');
    vi.stubEnv('HANGAR_DATABASE_URL', 'postgres://legacy:secret@legacy/hangar');

    const config = getHangarPoolConfig();

    expect(config?.source).toBe('structured');
    expect(config?.poolConfig).toMatchObject({
      host: 'pg18-rw.data-platform.svc.cluster.local',
      port: 5432,
      database: 'hangar',
      user: 'hangar',
      password: ' temporary-or-runtime-secret ',
      ssl: { rejectUnauthorized: false },
    });
    expect(config?.poolConfig).not.toHaveProperty('connectionString');
  });

  it('keeps credential-bearing database URLs as a compatibility fallback', () => {
    vi.stubEnv('HANGAR_DB_HOST', '');
    vi.stubEnv('HANGAR_DATABASE_URL', 'postgres://hangar:secret@pg18-rw/hangar');
    vi.stubEnv('DATABASE_URL', '');

    const config = getHangarPoolConfig();

    expect(config?.source).toBe('url');
    expect(config?.poolConfig).toMatchObject({
      connectionString: 'postgres://hangar:secret@pg18-rw/hangar',
    });
  });

  it('rejects unsupported SSL modes instead of silently weakening their meaning', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubEnv('HANGAR_DB_HOST', 'pg18-rw.data-platform.svc.cluster.local');
    vi.stubEnv('HANGAR_DB_SSLMODE', 'verify-full');

    expect(() => getHangarPoolConfig()).toThrow(
      'Unsupported HANGAR_DB_SSLMODE "verify-full". Supported values: disable, require.',
    );

    const result = await getInventoryItems();

    expect(result.source).toBe('static');
    expect(result.fallbackReason).toBe('postgres-error');
  });

  it('maps item rows from the normalized assets schema back into the app read model', () => {
    const item = mapInventoryItemRow({
      id: 'glinet-comet-q-gl-rmq1',
      name: 'Comet Q',
      manufacturer: 'GL.iNet',
      model: 'GL-RMQ1',
      bay_groups: ['network'],
      category: 'Remote KVM',
      status: 'on-order',
      provenance: 'owner',
      summary: 'Remote KVM summary',
      description: 'Remote KVM description',
      planning_notes: 'Keep in Network Ops.',
      acquired: '2026 Kickstarter pledge',
      horizon: 'Estimated shipping Aug 2026',
      quantity: 1,
      price_us: '89',
      price_import: null,
      specs: [{ label: 'Video', value: '2K QHD @ 60 FPS' }],
      limitations: ['Requires USB-C DisplayPort Alt Mode.'],
      sources: [
        {
          label: 'GL.iNet Comet Q product page',
          url: 'https://www.gl-inet.com/products/gl-rmq1/',
          accessedAt: '2026-06-16',
          kind: 'official',
        },
      ],
      tags: ['kvm', 'usb-c'],
      related_units: ['beast'],
      related_missions: ['undercroft'],
      related_capabilities: ['teleop'],
      related_insights: ['beast-socket-control'],
    });

    expect(item).toMatchObject({
      id: 'glinet-comet-q-gl-rmq1',
      bay: 'network',
      category: 'Remote KVM',
      status: 'on-order',
      price: { us: 89, import: null },
      specs: [{ label: 'Video', value: '2K QHD @ 60 FPS' }],
      tags: ['kvm', 'usb-c'],
      relatedUnits: ['beast'],
      relatedMissions: ['undercroft'],
      relatedCapabilities: ['teleop'],
      relatedInsights: ['beast-socket-control'],
    });
  });

  it('rejects inventory rows without exactly one bay group', () => {
    expect(() =>
      mapInventoryItemRow({
        id: 'ambiguous-item',
        name: 'Ambiguous Item',
        manufacturer: null,
        model: null,
        bay_groups: ['network', 'robotics'],
        category: null,
        status: 'owned',
        provenance: 'owner',
        summary: null,
        description: null,
        planning_notes: null,
        acquired: null,
        horizon: null,
        quantity: 1,
        price_us: null,
        price_import: null,
        specs: [],
        limitations: [],
        sources: [],
        tags: [],
        related_units: [],
        related_missions: [],
        related_capabilities: [],
        related_insights: [],
      }),
    ).toThrow('Expected exactly one bay group for inventory item "ambiguous-item"; got network, robotics.');
  });

  it('rejects malformed Postgres text arrays instead of dropping relationship ids', () => {
    expect(() =>
      mapInventoryItemRow(inventoryRow({
        id: 'malformed-relations',
        related_units: ['beast', 42] as unknown as string[],
      })),
    ).toThrow('Invalid related units from hangar DB: expected text at index 1.');
  });

  it('rejects malformed bay arrays instead of dropping bad bay entries', () => {
    expect(() =>
      mapInventoryItemRow(inventoryRow({
        id: 'malformed-bay',
        bay_groups: ['network', 42] as unknown as string[],
      })),
    ).toThrow('Invalid bay groups from hangar DB: expected text at index 1.');
  });

  it('rejects malformed numeric values instead of treating them as absent prices', () => {
    expect(() =>
      mapInventoryItemRow(inventoryRow({
        price_us: 'not-a-number',
      })),
    ).toThrow('Invalid inventory price_us from hangar DB: not-a-number');
  });

  it('rejects numeric values that violate inventory schema invariants', () => {
    expect(() =>
      mapInventoryItemRow(inventoryRow({
        price_us: '-1',
      })),
    ).toThrow('Invalid inventory price_us from hangar DB: expected a non-negative number, got -1.');

    expect(() =>
      mapInventoryItemRow(inventoryRow({
        quantity: 0,
      })),
    ).toThrow('Invalid inventory quantity from hangar DB: expected a positive integer, got 0.');

    expect(() =>
      mapInventoryItemRow(inventoryRow({
        quantity: '1.5',
      })),
    ).toThrow('Invalid inventory quantity from hangar DB: expected a positive integer, got 1.5.');

    expect(() =>
      mapInventoryItemRow(inventoryRow({
        quantity: null,
      })),
    ).toThrow('Invalid inventory quantity from hangar DB: expected a positive integer, got null.');
  });

  it('rejects invalid provenance values instead of treating them as absent', () => {
    expect(() =>
      mapInventoryItemRow(inventoryRow({
        provenance: 'mystery',
      })),
    ).toThrow('Invalid inventory provenance from hangar DB: mystery');
  });

  it('rejects malformed JSON arrays instead of filtering bad nested records', () => {
    expect(() =>
      mapInventoryItemRow(inventoryRow({
        specs: [{ label: 'Video' }],
      })),
    ).toThrow('Invalid inventory specs from hangar DB: expected valid object at index 0.');

    expect(() =>
      mapInventoryItemRow(inventoryRow({
        sources: [{ label: 'Missing URL', accessedAt: '2026-07-07', kind: 'official' }],
      })),
    ).toThrow('Invalid inventory sources from hangar DB: expected valid object at index 0.');

    expect(() =>
      mapInventoryItemRow(inventoryRow({
        limitations: ['valid limitation', 42],
      })),
    ).toThrow('Invalid inventory limitations from hangar DB: expected text at index 1.');
  });

  it('rejects blank DB spec rows and limitations before rendering item details', () => {
    expect(() =>
      mapInventoryItemRow(inventoryRow({
        specs: [{ label: ' ', value: '2K QHD @ 60 FPS' }],
      })),
    ).toThrow('Invalid inventory specs from hangar DB: expected valid object at index 0.');

    expect(() =>
      mapInventoryItemRow(inventoryRow({
        specs: [{ label: 'Video', value: ' ' }],
      })),
    ).toThrow('Invalid inventory specs from hangar DB: expected valid object at index 0.');

    expect(() =>
      mapInventoryItemRow(inventoryRow({
        specs: [{ label: 'Video ', value: '2K QHD @ 60 FPS' }],
      })),
    ).toThrow('Invalid inventory specs from hangar DB: expected valid object at index 0.');

    expect(() =>
      mapInventoryItemRow(inventoryRow({
        limitations: ['valid limitation', ' '],
      })),
    ).toThrow(
      'Invalid inventory limitations from hangar DB: expected non-blank trimmed text at index 1.',
    );

    expect(() =>
      mapInventoryItemRow(inventoryRow({
        limitations: ['valid limitation', ' valid limitation'],
      })),
    ).toThrow(
      'Invalid inventory limitations from hangar DB: expected non-blank trimmed text at index 1.',
    );
  });

  it('rejects malformed DB source record details before rendering external links', () => {
    expect(() =>
      mapInventoryItemRow(inventoryRow({
        sources: [
          {
            label: ' ',
            url: 'https://example.com/source',
            accessedAt: '2026-07-07',
            kind: 'official',
          },
        ],
      })),
    ).toThrow('Invalid inventory sources from hangar DB: expected valid object at index 0.');

    expect(() =>
      mapInventoryItemRow(inventoryRow({
        sources: [
          {
            label: 'Example source',
            url: 'ftp://example.com/source',
            accessedAt: '2026-07-07',
            kind: 'official',
          },
        ],
      })),
    ).toThrow('Invalid inventory sources from hangar DB: expected valid object at index 0.');

    expect(() =>
      mapInventoryItemRow(inventoryRow({
        sources: [
          {
            label: 'Example source ',
            url: 'https://example.com/source',
            accessedAt: '2026-07-07',
            kind: 'official',
          },
        ],
      })),
    ).toThrow('Invalid inventory sources from hangar DB: expected valid object at index 0.');

    expect(() =>
      mapInventoryItemRow(inventoryRow({
        sources: [
          {
            label: 'Example source',
            url: ' https://example.com/source',
            accessedAt: '2026-07-07',
            kind: 'official',
          },
        ],
      })),
    ).toThrow('Invalid inventory sources from hangar DB: expected valid object at index 0.');

    expect(() =>
      mapInventoryItemRow(inventoryRow({
        sources: [
          {
            label: 'Example source',
            url: 'https://example.com/source',
            accessedAt: 'not-a-date',
            kind: 'official',
          },
        ],
      })),
    ).toThrow('Invalid inventory sources from hangar DB: expected valid object at index 0.');

    expect(() =>
      mapInventoryItemRow(inventoryRow({
        sources: [
          {
            label: 'Example source',
            url: 'https://example.com/source',
            accessedAt: '2026',
            kind: 'official',
          },
        ],
      })),
    ).toThrow('Invalid inventory sources from hangar DB: expected valid object at index 0.');
  });

  it('accepts null Postgres text arrays as empty relationship fields', () => {
    const item = mapInventoryItemRow({
      id: 'null-relations',
      name: 'Null Relations',
      manufacturer: null,
      model: null,
      bay_groups: ['network'],
      category: null,
      status: 'owned',
      provenance: 'owner',
      summary: null,
      description: null,
      planning_notes: null,
      acquired: null,
      horizon: null,
      quantity: 1,
      price_us: null,
      price_import: null,
      specs: [],
      limitations: [],
      sources: [],
      tags: null,
      related_units: null,
      related_missions: null,
      related_capabilities: null,
      related_insights: null,
    });

    expect(item).toMatchObject({
      id: 'null-relations',
      tags: undefined,
      relatedUnits: undefined,
      relatedMissions: undefined,
      relatedCapabilities: undefined,
      relatedInsights: undefined,
    });
  });

  it('queries only peripheral assets with inventory item statuses', async () => {
    const calls: Array<{ sql: string; values?: unknown[] }> = [];
    const row = {
      id: 'lafaer-lwr02-presence-sensor',
      name: 'LWR02 All-in-One Wireless Presence Sensor',
      manufacturer: 'GL.iNet / Lafaer',
      model: 'LWR02',
      bay_groups: ['home'],
      category: 'Presence Sensor',
      status: 'on-order',
      provenance: 'owner',
      summary: 'Matter-over-Thread 5-in-1 sensor.',
      description: 'Battery-powered occupancy and environment sensor.',
      planning_notes: null,
      acquired: '2026 Kickstarter add-on',
      horizon: 'Estimated shipping Aug 2026',
      quantity: 1,
      price_us: '36',
      price_import: null,
      specs: [],
      limitations: [],
      sources: [],
      tags: ['matter', 'thread'],
      related_units: [],
      related_missions: [],
      related_capabilities: [],
      related_insights: [],
    };
    const query = async <T,>(sql: string, values?: unknown[]) => {
      calls.push({ sql, values });
      return { rows: [row] as T[] };
    };

    const items = await readInventoryItemsFromPostgres({ query });

    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain("WHERE a.kind = 'peripheral'");
    expect(calls[0].sql).toContain('bay_membership.bay_groups');
    expect(calls[0].sql).toContain('related_units');
    expect(calls[0].sql).toContain('related_missions');
    expect(calls[0].sql).toContain('related_capabilities');
    expect(calls[0].sql).toContain('related_insights');
    expect(calls[0].values).toEqual([[
      'owned',
      'on-order',
      'wishlist',
      'researching',
      'deployed',
      'retired',
      'rejected',
    ]]);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('lafaer-lwr02-presence-sensor');
  });

  it('exposes the read path through a non-static route handler', async () => {
    vi.stubEnv('HANGAR_DB_HOST', '');
    vi.stubEnv('HANGAR_DATABASE_URL', '');
    vi.stubEnv('DATABASE_URL', '');

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.source).toBe('static');
    expect(payload.fallbackReason).toBe('not-configured');
    expect(payload.count).toBe(hangarData.items.length);
  });

  it('exposes a database preflight route that does not treat fallback as healthy', async () => {
    vi.stubEnv('HANGAR_DB_HOST', '');
    vi.stubEnv('HANGAR_DATABASE_URL', '');
    vi.stubEnv('DATABASE_URL', '');

    const response = await GET_PREFLIGHT();
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toMatchObject({
      ok: false,
      checks: {
        database: {
          check: 'hangar-postgres',
          configured: false,
          reachable: false,
          status: 'not-configured',
          configSource: null,
        },
      },
    });
  });

  it('reports a reachable configured Hangar database preflight', async () => {
    const calls: string[] = [];
    const query = async <T,>(sql: string) => {
      calls.push(sql);
      return { rows: [{ ok: 1 }] as T[] };
    };

    vi.stubEnv('HANGAR_DB_HOST', 'pg18-rw.data-platform.svc.cluster.local');
    vi.stubEnv('HANGAR_DB_NAME', 'hangar');
    vi.stubEnv('HANGAR_DB_USER', 'hangar');

    const result = await checkHangarDatabaseReachability({ query });

    expect(result).toMatchObject({
      check: 'hangar-postgres',
      configured: true,
      reachable: true,
      status: 'reachable',
      configSource: 'structured',
    });
    expect(result.latencyMs).toEqual(expect.any(Number));
    expect(calls).toEqual(['SELECT 1 AS ok']);
  });

  it('reports configured Hangar database preflight failures without falling back', async () => {
    const query = async <T,>(): Promise<{ rows: T[] }> => {
      throw new Error('connection refused');
    };

    vi.stubEnv('HANGAR_DB_HOST', 'pg18-rw.data-platform.svc.cluster.local');
    vi.stubEnv('HANGAR_DB_NAME', 'hangar');
    vi.stubEnv('HANGAR_DB_USER', 'hangar');

    const result = await checkHangarDatabaseReachability({ query });

    expect(result).toMatchObject({
      check: 'hangar-postgres',
      configured: true,
      reachable: false,
      status: 'unreachable',
      configSource: 'structured',
      error: 'connection refused',
    });
    expect(result.latencyMs).toEqual(expect.any(Number));
  });

  it('keeps raw database preflight errors out of the public response payload', () => {
    const payload = toHangarPreflightPayload({
      check: 'hangar-postgres',
      configured: true,
      reachable: false,
      status: 'unreachable',
      configSource: 'structured',
      latencyMs: 12,
      error: 'password authentication failed for user "hangar"',
    });

    expect(payload).toMatchObject({
      ok: false,
      checks: {
        database: {
          check: 'hangar-postgres',
          configured: true,
          reachable: false,
          status: 'unreachable',
          configSource: 'structured',
          latencyMs: 12,
        },
      },
    });
    expect(payload.checks.database).not.toHaveProperty('error');
  });
});
