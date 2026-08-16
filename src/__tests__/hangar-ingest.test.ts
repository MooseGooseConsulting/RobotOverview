import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { newDb } from 'pg-mem';
import pg from 'pg';
import * as schema from '@/server/hangar/schema';
import { stripDatacoreCorpus } from './helpers/seed-sql';
import {
  activityLog,
  assets,
  insightAssets,
  insightMissions,
  insightTags,
  insights,
  loadoutAssignments,
  sockets,
  tags,
} from '@/server/hangar/schema';
import {
  assertIngestAuthorized,
  executeIngestOp,
  IngestAuthError,
  IngestConflictError,
  IngestNotFoundError,
  opAppendInsight,
  opAssignLoadout,
  opPatchAsset,
  opPatchStatus,
  parseIngestBody,
  type IngestDb,
} from '@/server/hangar/ingest';

const { Pool } = pg;

/** Strip -- comments (outside strings), then split on ; outside strings. */
function splitSql(sql: string): string[] {
  const noComments: string[] = [];
  let inSingle = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'") {
      if (inSingle && sql[i + 1] === "'") {
        noComments.push("''");
        i++;
        continue;
      }
      inSingle = !inSingle;
      noComments.push(ch);
      continue;
    }
    if (!inSingle && ch === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i++;
      noComments.push('\n');
      continue;
    }
    noComments.push(ch);
  }
  const cleaned = noComments.join('');
  const stmts: string[] = [];
  let cur = '';
  inSingle = false;
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === "'") {
      if (inSingle && cleaned[i + 1] === "'") {
        cur += "''";
        i++;
        continue;
      }
      inSingle = !inSingle;
      cur += ch;
      continue;
    }
    if (ch === ';' && !inSingle) {
      const s = cur.trim();
      if (s) stmts.push(s);
      cur = '';
      continue;
    }
    cur += ch;
  }
  const tail = cur.trim();
  if (tail) stmts.push(tail);
  return stmts;
}

function dropNullableCheckConstraints(mem: ReturnType<typeof newDb>) {
  // pg-mem treats NULL as failing IN(...) / nullable CHECK predicates.
  for (const table of ['assets', 'wishlist_meta', 'asset_shortcuts', 'hangar_meta', 'briefings']) {
    for (let i = 1; i <= 30; i++) {
      try {
        mem.public.none(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${table}_constraint_${i}`);
      } catch {
        /* ignore */
      }
    }
  }
}

/** drizzle-orm/node-postgres passes types.getTypeParser + rowMode:'array'; neither works in pg-mem. */
function patchPgMemClient(Client: { prototype: { query: (...args: never[]) => unknown } }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proto = Client.prototype as { query: (...args: any[]) => any };
  const origQuery = proto.query;
  proto.query = function (this: unknown, query: unknown, values?: unknown, cb?: unknown) {
    const wantsArray =
      Boolean(query) && typeof query === 'object' && (query as { rowMode?: string }).rowMode === 'array';
    let cleaned = query;
    if (query && typeof query === 'object') {
      cleaned = { ...(query as object) };
      delete (cleaned as { types?: unknown }).types;
      delete (cleaned as { rowMode?: unknown }).rowMode;
    }
    const adapt = (result: pg.QueryResult) => {
      if (wantsArray && result?.rows) {
        result.rows = result.rows.map((row) =>
          Array.isArray(row) ? row : Object.values(row as Record<string, unknown>),
        ) as typeof result.rows;
      }
      return result;
    };
    if (typeof cb === 'function') {
      return origQuery.call(this, cleaned, values, (err: Error, result: pg.QueryResult) =>
        (cb as (e: Error, r: pg.QueryResult) => void)(err, err ? result : adapt(result)),
      );
    }
    const run = origQuery.call(this, cleaned, values);
    if (run && typeof run.then === 'function') {
      return (run as Promise<pg.QueryResult>).then(adapt);
    }
    return adapt(run as pg.QueryResult);
  };
}

async function createTestDb(): Promise<{ db: IngestDb; pool: pg.Pool; close: () => Promise<void> }> {
  const mem = newDb({ autoCreateForeignKeyIndices: true });
  const root = resolve(process.cwd());
  mem.public.none(readFileSync(resolve(root, 'db/hangar/schema.sql'), 'utf8'));
  dropNullableCheckConstraints(mem);

  const seed = stripDatacoreCorpus(
    readFileSync(resolve(root, 'db/hangar/seed.sql'), 'utf8'),
  );
  for (const stmt of splitSql(seed)) {
    if (/^(BEGIN|COMMIT|SET)\b/i.test(stmt)) continue;
    mem.public.none(stmt.endsWith(';') ? stmt : `${stmt};`);
  }

  const { Client } = mem.adapters.createPg();
  patchPgMemClient(Client);
  const pool = new Pool({ Client });
  const db = drizzle(pool, { schema }) as unknown as IngestDb;
  return {
    db,
    pool,
    close: async () => {
      await pool.end();
    },
  };
}

describe('assertIngestAuthorized', () => {
  const prev = process.env.HANGAR_INGEST_TOKEN;

  afterAll(() => {
    if (prev === undefined) delete process.env.HANGAR_INGEST_TOKEN;
    else process.env.HANGAR_INGEST_TOKEN = prev;
  });

  it('returns 503 when token env is missing', () => {
    delete process.env.HANGAR_INGEST_TOKEN;
    expect(() => assertIngestAuthorized('Bearer anything')).toThrow(IngestAuthError);
    try {
      assertIngestAuthorized('Bearer anything');
    } catch (e) {
      expect(e).toBeInstanceOf(IngestAuthError);
      expect((e as IngestAuthError).status).toBe(503);
    }
  });

  it('returns 401 for wrong bearer', () => {
    process.env.HANGAR_INGEST_TOKEN = 'secret';
    try {
      assertIngestAuthorized('Bearer nope');
      expect.unreachable();
    } catch (e) {
      expect((e as IngestAuthError).status).toBe(401);
    }
  });

  it('accepts the correct bearer', () => {
    process.env.HANGAR_INGEST_TOKEN = 'secret';
    expect(() => assertIngestAuthorized('Bearer secret')).not.toThrow();
  });
});

describe('parseIngestBody', () => {
  it('parses append_insight', () => {
    const body = parseIngestBody({
      op: 'append_insight',
      input: {
        id: 'insight-x',
        title: 'T',
        body: 'B',
        confidence: 'medium',
      },
    });
    expect(body.op).toBe('append_insight');
    if (body.op === 'append_insight') expect(body.input.id).toBe('insight-x');
  });

  it('parses patch_asset and rejects id-only', () => {
    const body = parseIngestBody({
      op: 'patch_asset',
      input: {
        id: 'stock-ups',
        model: 'NCR18650GA',
        specs: [{ label: 'Cells', value: '3× NCR18650GA' }],
      },
    });
    expect(body.op).toBe('patch_asset');
    expect(() =>
      parseIngestBody({
        op: 'patch_asset',
        input: { id: 'stock-ups' },
      }),
    ).toThrow();
  });

  it('rejects partial land_mission payloads', () => {
    expect(() =>
      parseIngestBody({
        op: 'land_mission',
        input: { id: 'm1', name: 'Only name' },
      }),
    ).toThrow();
  });

  it('strips unknown keys on land_briefing', () => {
    const body = parseIngestBody({
      op: 'land_briefing',
      input: {
        id: 'br-1',
        title: 'Title',
        kind: 'research',
        summary: 'Sum',
        bodyMarkdown: '# Hi',
        extraJunk: true,
      },
    });
    expect(body.op).toBe('land_briefing');
    if (body.op === 'land_briefing') {
      expect('extraJunk' in body.input).toBe(false);
    }
  });
});

describe('hangar ingest ops (pg-mem)', () => {
  let db: IngestDb;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const ctx = await createTestDb();
    db = ctx.db;
    close = ctx.close;
  }, 60_000);

  afterAll(async () => {
    await close();
  });

  it('append_insight writes insight + junctions + tags', async () => {
    const id = 'insight-ingest-roundtrip';
    await opAppendInsight(db, {
      id,
      title: 'Round trip',
      body: 'Body text',
      confidence: 'high',
      units: ['beast', 'orin-nano'],
      missions: ['undercroft'],
      tags: ['ingest-test-tag'],
    });

    const row = await db.select().from(insights).where(eq(insights.id, id));
    expect(row).toHaveLength(1);
    expect(row[0]?.title).toBe('Round trip');

    const ia = await db.select().from(insightAssets).where(eq(insightAssets.insightId, id));
    expect(ia.map((r) => r.assetId).sort()).toEqual(['beast', 'orin-nano']);

    const im = await db.select().from(insightMissions).where(eq(insightMissions.insightId, id));
    expect(im.map((r) => r.missionId)).toEqual(['undercroft']);

    const tag = await db
      .select()
      .from(tags)
      .where(eq(tags.name, 'ingest-test-tag'));
    expect(tag.length).toBeGreaterThan(0);
    const it = await db.select().from(insightTags).where(eq(insightTags.insightId, id));
    expect(it.some((r) => r.tagId === tag[0]!.id)).toBe(true);
  });

  it('append_activity inserts activity_log', async () => {
    const result = await executeIngestOp(db, {
      op: 'append_activity',
      input: { id: 'act-ingest-1', kind: 'insight', text: 'Hello activity' },
    });
    expect(result).toEqual({ ok: true, op: 'append_activity', id: 'act-ingest-1' });
    const rows = await db.select().from(activityLog).where(eq(activityLog.id, 'act-ingest-1'));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.text).toBe('Hello activity');
  });

  it('patch_asset updates specs on a module without changing kind or power', async () => {
    const before = await db.select().from(assets).where(eq(assets.id, 'stock-ups'));
    expect(before[0]?.kind).toBe('module');
    expect(before[0]?.status).toBe('operational');
    const kind = before[0]?.kind;
    const callsign = before[0]?.callsign;
    const status = before[0]?.status;
    const powerVolts = before[0]?.powerVolts;
    const powerRail = before[0]?.powerRail;

    await executeIngestOp(db, {
      op: 'patch_asset',
      input: {
        id: 'stock-ups',
        manufacturer: 'Panasonic / Sanyo',
        model: 'NCR18650GA',
        summary: 'Patched summary',
        specs: [
          { label: 'Cells', value: '3× Panasonic NCR18650GA (3.6 V, 3.4 Ah nominal)' },
          { label: 'Module', value: 'Waveshare UPS Module 3S' },
        ],
      },
    });

    const after = await db.select().from(assets).where(eq(assets.id, 'stock-ups'));
    expect(after[0]?.manufacturer).toBe('Panasonic / Sanyo');
    expect(after[0]?.model).toBe('NCR18650GA');
    expect(after[0]?.summary).toBe('Patched summary');
    expect(after[0]?.specs).toEqual([
      { label: 'Cells', value: '3× Panasonic NCR18650GA (3.6 V, 3.4 Ah nominal)' },
      { label: 'Module', value: 'Waveshare UPS Module 3S' },
    ]);
    expect(after[0]?.kind).toBe(kind);
    expect(after[0]?.callsign).toBe(callsign);
    expect(after[0]?.status).toBe(status);
    expect(after[0]?.powerVolts).toBe(powerVolts);
    expect(after[0]?.powerRail).toBe(powerRail);
  });

  it('patch_asset refuses unknown id with 404', async () => {
    await expect(opPatchAsset(db, { id: 'no-such-asset', model: 'x' })).rejects.toBeInstanceOf(
      IngestNotFoundError,
    );
    try {
      await opPatchAsset(db, { id: 'no-such-asset', model: 'x' });
    } catch (e) {
      expect(e).toBeInstanceOf(IngestNotFoundError);
      expect((e as IngestNotFoundError).status).toBe(404);
      expect((e as IngestNotFoundError).body).toEqual(
        expect.objectContaining({ id: 'no-such-asset' }),
      );
    }
  });

  it('patch_status updates asset and appends activity in one tx', async () => {
    const before = await db.select().from(activityLog);
    await opPatchStatus(db, { target: 'unit', id: 'beast', status: 'integrating' });
    const asset = await db.select().from(assets).where(eq(assets.id, 'beast'));
    expect(asset[0]?.status).toBe('integrating');
    const after = await db.select().from(activityLog);
    expect(after.length).toBe(before.length + 1);
    const added = after.find((r) => r.text?.includes('unit beast: blocked → integrating'));
    // status may already be integrating from a prior run in this suite — accept either transition text
    const transition = after.find((r) => r.text?.includes('unit beast:') && r.text.includes('→ integrating'));
    expect(added ?? transition).toBeTruthy();
  });

  it('assign_loadout orin-nano clears prior pi5 assignment', async () => {
    await opAssignLoadout(db, {
      hostAssetId: 'beast',
      slot: 'Host Controller Mount',
      assetId: 'pi5',
    });
    const sock = (
      await db.select().from(sockets).where(eq(sockets.name, 'Host Controller Mount'))
    ).find((s) => s.hostAssetId === 'beast')!;
    let asg = await db
      .select()
      .from(loadoutAssignments)
      .where(eq(loadoutAssignments.socketId, sock.id));
    expect(asg[0]?.assetId).toBe('pi5');

    await opAssignLoadout(db, {
      hostAssetId: 'beast',
      slot: 'Host Controller Mount',
      assetId: 'orin-nano',
    });
    asg = await db
      .select()
      .from(loadoutAssignments)
      .where(eq(loadoutAssignments.socketId, sock.id));
    expect(asg[0]?.assetId).toBe('orin-nano');
    expect(asg[0]?.interfaceTypeId).toBe('host-mount');

    const pi5Anywhere = await db
      .select()
      .from(loadoutAssignments)
      .where(eq(loadoutAssignments.assetId, 'pi5'));
    expect(pi5Anywhere).toHaveLength(0);
  });

  it('assign_loadout incompatible asset → 409 naming interfaces', async () => {
    await expect(
      opAssignLoadout(db, {
        hostAssetId: 'beast',
        slot: 'Host Controller Mount',
        assetId: 'stock-ups',
      }),
    ).rejects.toBeInstanceOf(IngestConflictError);

    try {
      await opAssignLoadout(db, {
        hostAssetId: 'beast',
        slot: 'Host Controller Mount',
        assetId: 'stock-ups',
      });
    } catch (e) {
      const err = e as IngestConflictError;
      expect(err.status).toBe(409);
      expect(err.body.interfaces).toEqual([]);
    }
  });

  it('409 append_insight with missing unit rolls back', async () => {
    const id = 'insight-should-not-land';
    await expect(
      opAppendInsight(db, {
        id,
        title: 'Nope',
        body: 'x',
        confidence: 'low',
        units: ['nope'],
      }),
    ).rejects.toMatchObject({
      status: 409,
      body: expect.objectContaining({ missingUnits: ['nope'] }),
    });

    const rows = await db.select().from(insights).where(eq(insights.id, id));
    expect(rows).toHaveLength(0);
  });

  it('RACE: concurrent append_insight keeps both rows', async () => {
    await Promise.all([
      opAppendInsight(db, {
        id: 'insight-race-a',
        title: 'A',
        body: 'a',
        confidence: 'medium',
        units: ['beast'],
      }),
      opAppendInsight(db, {
        id: 'insight-race-b',
        title: 'B',
        body: 'b',
        confidence: 'medium',
        units: ['beast'],
      }),
    ]);
    const a = await db.select().from(insights).where(eq(insights.id, 'insight-race-a'));
    const b = await db.select().from(insights).where(eq(insights.id, 'insight-race-b'));
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });
});
