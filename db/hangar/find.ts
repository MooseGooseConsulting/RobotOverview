/**
 * Search the live Hangar database from the command line.
 *
 *   doppler run --project homelab --config dev -- npx tsx db/hangar/find.ts battery
 *   doppler run --project homelab --config dev -- npx tsx db/hangar/find.ts --full 12.6
 *   doppler run --project homelab --config dev -- npx tsx db/hangar/find.ts --identity pack
 *
 * This exists because AGENTS.md documented the *write* path (POST
 * /api/hangar/ingest, every op verb, every error code) and no read path at
 * all. Agents therefore grepped `src/data/hangar.ts`, found plausible data,
 * and stopped -- but that file is a CI fixture, not the record. On 2026-08-07
 * that cost a round trip asking the owner to photograph a battery label whose
 * spec was already in `assets` as `stock-ups`.
 *
 * Searches the Hangar fact surfaces listed in FIND_SURFACES. Join / taxonomy
 * tables stay in FIND_SURFACE_SKIP. Do not grep the repo for hardware facts.
 * `--identity` matches names/ids/models only; default search also hits bodies.
 *
 * Connection: HANGAR_DB_* or HANGAR_DATABASE_URL, resolved by the same code
 * the app uses. Host/db/user fall back to the LAN values published in
 * `db/hangar/standup.md`; only the password needs Doppler.
 */
import { Client } from 'pg';
import { getHangarPoolConfig } from '../../src/server/hangar/db';

const LAN_DEFAULTS = {
  host: '192.168.30.205',
  port: 5432,
  database: 'hangar',
  user: 'hangar',
} as const;

const LIST_LIMIT = 50;

/** Schema tables this CLI searches. Adding a CREATE TABLE requires a home here or in SKIP. */
export const FIND_SURFACES = [
  'assets',
  'terminals',
  'sockets',
  'documents',
  'nets',
  'activity_log',
  'missions',
  'mission_after_actions',
  'mission_objectives',
  'mission_constraints',
  'capabilities',
  'wishlist_meta',
  'insights',
  'briefings',
] as const;

/** Join, taxonomy, and singleton tables that are not independent fact surfaces. */
export const FIND_SURFACE_SKIP = [
  'tags',
  'asset_tags',
  'groups',
  'asset_groups',
  'hotspots',
  'interface_types',
  'asset_interfaces',
  'socket_accepts',
  'loadout_assignments',
  'mission_requisitions',
  'capability_deps',
  'asset_capabilities',
  'insight_assets',
  'insight_missions',
  'insight_tags',
  'net_terminals',
  'document_assets',
  'net_documents',
  'asset_shortcuts',
  'hangar_meta',
  'briefing_packs',
] as const;

type Row = Record<string, unknown>;

/**
 * Columns `--identity` may match. Bodies, notes, and summaries stay full-search
 * only — a paragraph that merely mentions the term is not an identity hit.
 */
export const FIND_IDENTITY_FIELDS = {
  assets: ['id', 'name', 'callsign', 'manufacturer', 'model', 'specs'],
  terminals: ['id', 'name', 'connector', 'asset_id', 'assets.name', 'assets.callsign'],
  sockets: ['id', 'name', 'slot_group', 'host_asset_id'],
  documents: ['id', 'title', 'kind'],
  nets: ['id', 'name', 'kind', 'terminals.id', 'terminals.asset_id', 'terminals.name'],
  activity_log: ['id', 'kind', 'asset_id'],
  missions: [
    'id',
    'code',
    'name',
    'mission_constraints.label',
    'mission_requisitions.asset_id',
    'required_loadout',
  ],
  capabilities: ['id', 'name'],
  wishlist_meta: ['asset_id', 'assets.name', 'for_asset_id', 'for_mission_id'],
  insights: ['id', 'title', 'insight_assets.asset_id', 'insight_missions.mission_id'],
  briefings: ['id', 'title', 'aliases', 'tags'],
} as const;

/** Fields full search may hit that `--identity` must not. */
export const FIND_FULL_ONLY_FIELDS = [
  'summary',
  'description',
  'body',
  'body_markdown',
  'note',
  'planning_notes',
  'objective',
  'environment',
  'rationale',
  'risk_note',
  'text',
] as const;

export function parseFindArgs(argv: string[]) {
  const full = argv.includes('--full');
  const identity = argv.includes('--identity');
  const terms = argv.filter((a) => !a.startsWith('--'));
  return { full, identity, term: terms.join(' ').trim() };
}

function resolveClient(): Client {
  const configured = getHangarPoolConfig();
  if (configured) {
    // Pass through the app's PoolConfig for both url and structured sources so
    // SSL (HANGAR_DB_SSLMODE) and validated host/db/user are not dropped.
    return new Client(configured.poolConfig);
  }

  const password = process.env.HANGAR_DB_PASSWORD;
  if (!password) {
    throw new Error(
      'No HANGAR_DB_PASSWORD (or HANGAR_DATABASE_URL). Run under Doppler:\n' +
        '  doppler run --project homelab --config dev -- npx tsx db/hangar/find.ts <term>',
    );
  }

  return new Client({
    ...LAN_DEFAULTS,
    password,
  });
}

function print(
  label: string,
  rows: Row[],
  full: boolean,
  totalMatches?: number,
  identity = false,
): number {
  if (!rows.length) return 0;
  const shown = rows.length;
  const total = totalMatches ?? shown;
  const suffix = total > shown ? ` (${shown} of ${total})` : ` (${shown})`;
  console.log(`\n===== ${label}${suffix} =====`);
  const omit = identity ? new Set<string>(FIND_FULL_ONLY_FIELDS) : new Set<string>();
  for (const row of rows) {
    console.log('---');
    for (const [key, value] of Object.entries(row)) {
      if (key === 'total_matches') continue;
      if (omit.has(key)) continue;
      if (value === null || value === undefined || value === '') continue;
      let text = typeof value === 'object' ? JSON.stringify(value) : String(value);
      const limit = full ? 100_000 : 700;
      if (text.length > limit) text = `${text.slice(0, limit)} …[--full for more]`;
      console.log(`${key}: ${text}`);
    }
  }
  return shown;
}

function totalFrom(rows: Row[]): number | undefined {
  const raw = rows[0]?.total_matches;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string' && raw !== '') return Number(raw);
  return undefined;
}

function assetWhere(identity: boolean): string {
  if (identity) {
    return `id ilike $1 or name ilike $1
               or coalesce(callsign,'') ilike $1
               or coalesce(manufacturer,'') ilike $1
               or coalesce(model,'') ilike $1
               or specs::text ilike $1`;
  }
  return `id ilike $1 or name ilike $1 or summary ilike $1
               or coalesce(description,'') ilike $1
               or coalesce(planning_notes,'') ilike $1
               or coalesce(callsign,'') ilike $1
               or coalesce(manufacturer,'') ilike $1
               or coalesce(model,'') ilike $1
               or coalesce(power_rail,'') ilike $1
               or coalesce(power_volts::text,'') ilike $1
               or coalesce(power_watts::text,'') ilike $1
               or specs::text ilike $1
               or coalesce(limitations::text,'') ilike $1
               or coalesce(sources::text,'') ilike $1
               or coalesce(links::text,'') ilike $1`;
}

function terminalWhere(identity: boolean): string {
  if (identity) {
    return `t.id ilike $1 or t.name ilike $1
               or coalesce(t.connector,'') ilike $1
               or t.asset_id ilike $1
               or a.name ilike $1
               or coalesce(a.callsign,'') ilike $1`;
  }
  return `t.id ilike $1 or t.name ilike $1
               or coalesce(t.note,'') ilike $1
               or coalesce(t.connector,'') ilike $1
               or t.asset_id ilike $1
               or a.name ilike $1
               or coalesce(a.callsign,'') ilike $1
               or coalesce(a.summary,'') ilike $1`;
}

function socketWhere(identity: boolean): string {
  if (identity) {
    return `id::text ilike $1 or name ilike $1
               or coalesce(slot_group,'') ilike $1
               or host_asset_id ilike $1`;
  }
  return `id::text ilike $1 or name ilike $1
               or coalesce(note,'') ilike $1
               or coalesce(slot_group,'') ilike $1
               or host_asset_id ilike $1`;
}

function documentWhere(identity: boolean): string {
  if (identity) {
    return `d.id ilike $1 or d.title ilike $1 or d.kind ilike $1`;
  }
  return `d.id ilike $1 or d.title ilike $1 or d.kind ilike $1
               or coalesce(d.note,'') ilike $1
               or coalesce(d.url,'') ilike $1
               or d.library_path ilike $1
               or exists (
                    select 1 from document_assets da
                     where da.document_id = d.id and da.asset_id ilike $1
                  )`;
}

function netWhere(identity: boolean): string {
  const terminalHit = `exists (
                    select 1 from net_terminals nt
                    join terminals t on t.id = nt.terminal_id
                     where nt.net_id = n.id
                       and (t.id ilike $1 or t.asset_id ilike $1 or t.name ilike $1)
                  )`;
  if (identity) {
    return `n.id ilike $1 or n.name ilike $1 or n.kind::text ilike $1
               or ${terminalHit}`;
  }
  return `n.id ilike $1 or n.name ilike $1
               or coalesce(n.carries,'') ilike $1
               or coalesce(n.note,'') ilike $1
               or ${terminalHit}`;
}

function activityWhere(identity: boolean): string {
  if (identity) {
    return `id ilike $1 or coalesce(kind,'') ilike $1
             or coalesce(asset_id,'') ilike $1`;
  }
  return `id ilike $1 or coalesce(kind,'') ilike $1
             or coalesce(text,'') ilike $1
             or coalesce(asset_id,'') ilike $1`;
}

function missionWhere(identity: boolean): string {
  const requisitionHit = `exists (
                    select 1 from mission_requisitions mr
                     where mr.mission_id = m.id and mr.asset_id ilike $1
                  )
               or exists (
                    select 1 from unnest(coalesce(m.required_loadout, ARRAY[]::text[])) rl
                     where rl ilike $1
                  )`;
  if (identity) {
    return `m.id ilike $1 or coalesce(m.code,'') ilike $1 or m.name ilike $1
               or ${requisitionHit}
               or exists (
                    select 1 from mission_constraints c
                     where c.mission_id = m.id and c.label ilike $1
                  )`;
  }
  return `m.id ilike $1 or coalesce(m.code,'') ilike $1 or m.name ilike $1
               or coalesce(m.objective,'') ilike $1
               or coalesce(m.environment,'') ilike $1
               or ${requisitionHit}
               or exists (
                    select 1 from mission_after_actions a
                     where a.mission_id = m.id and a.text ilike $1
                  )
               or exists (
                    select 1 from mission_objectives o
                     where o.mission_id = m.id and o.text ilike $1
                  )
               or exists (
                    select 1 from mission_constraints c
                     where c.mission_id = m.id
                       and (c.label ilike $1 or c.unit ilike $1)
                  )`;
}

function capabilityWhere(identity: boolean): string {
  if (identity) {
    return `id ilike $1 or name ilike $1`;
  }
  return `id ilike $1 or name ilike $1
               or coalesce(description,'') ilike $1`;
}

function wishlistWhere(identity: boolean): string {
  if (identity) {
    return `w.asset_id ilike $1
               or a.name ilike $1
               or coalesce(w.for_asset_id,'') ilike $1
               or coalesce(w.for_mission_id,'') ilike $1`;
  }
  return `w.asset_id ilike $1
               or a.name ilike $1
               or coalesce(w.rationale,'') ilike $1
               or coalesce(w.risk_note,'') ilike $1
               or coalesce(w.source,'') ilike $1
               or coalesce(w.for_asset_id,'') ilike $1
               or coalesce(w.for_mission_id,'') ilike $1`;
}

function insightWhere(identity: boolean): string {
  const linked = `exists (
                  select 1 from insight_assets ia
                   where ia.insight_id = i.id and ia.asset_id ilike $1
                )
             or exists (
                  select 1 from insight_missions im
                   where im.insight_id = i.id and im.mission_id ilike $1
                )`;
  if (identity) {
    return `i.id ilike $1 or i.title ilike $1 or ${linked}`;
  }
  return `i.id ilike $1 or i.title ilike $1 or i.body ilike $1
             or coalesce(i.source,'') ilike $1
             or ${linked}`;
}

function briefingWhere(identity: boolean): string {
  if (identity) {
    return `id ilike $1 or title ilike $1
             or array_to_string(tags, ' ') ilike $1
             or array_to_string(aliases, ' ') ilike $1`;
  }
  return `id ilike $1 or title ilike $1 or coalesce(summary,'') ilike $1
             or body_markdown ilike $1
             or array_to_string(tags, ' ') ilike $1
             or array_to_string(aliases, ' ') ilike $1`;
}

async function main() {
  const { full, identity, term } = parseFindArgs(process.argv.slice(2));
  if (!term) {
    console.error('usage: npx tsx db/hangar/find.ts [--full] [--identity] <search term>');
    process.exitCode = 2;
    return;
  }

  const like = `%${term}%`;
  const client = resolveClient();
  await client.connect();

  try {
    let hits = 0;

    hits += print(
      'ASSETS',
      (
        await client.query(
          `select id, kind, name, callsign, manufacturer, model, status, summary,
                  description, planning_notes, power_volts, power_watts, power_rail,
                  specs, limitations, sources, links
             from assets
            where ${assetWhere(identity)}
            order by id`,
          [like],
        )
      ).rows,
      full,
      undefined,
      identity,
    );

    hits += print(
      'TERMINALS (connectors / rails)',
      (
        await client.query(
          `select t.id, t.asset_id, a.name as asset_name, a.callsign as asset_callsign,
                  t.name, t.connector, t.role, t.note
             from terminals t
             join assets a on a.id = t.asset_id
            where ${terminalWhere(identity)}
            order by t.asset_id, t.id`,
          [like],
        )
      ).rows,
      full,
      undefined,
      identity,
    );

    hits += print(
      'SOCKETS (loadout slots)',
      (
        await client.query(
          `select id, host_asset_id, slot_group, name, note
             from sockets
            where ${socketWhere(identity)}
            order by host_asset_id, id`,
          [like],
        )
      ).rows,
      full,
      undefined,
      identity,
    );

    hits += print(
      'DOCUMENTS',
      (
        await client.query(
          `select d.id, d.title, d.kind, d.library_path, d.url, d.note,
                  coalesce(
                    (select string_agg(da.asset_id, ', ' order by da.asset_id)
                       from document_assets da
                      where da.document_id = d.id),
                    ''
                  ) as asset_ids
             from documents d
            where ${documentWhere(identity)}
            order by d.id`,
          [like],
        )
      ).rows,
      full,
      undefined,
      identity,
    );

    hits += print(
      'NETS',
      (
        await client.query(
          `select n.id, n.name, n.kind, n.carries, n.note,
                  coalesce(
                    (select string_agg(t.asset_id || ':' || t.id, ', ' order by t.asset_id, t.id)
                       from net_terminals nt
                       join terminals t on t.id = nt.terminal_id
                      where nt.net_id = n.id),
                    ''
                  ) as terminals
             from nets n
            where ${netWhere(identity)}
            order by n.id`,
          [like],
        )
      ).rows,
      full,
      undefined,
      identity,
    );

    const activity = (
      await client.query(
        `select id, at, kind, text, asset_id, count(*) over() as total_matches
           from activity_log
          where ${activityWhere(identity)}
          order by at desc nulls last
          limit ${LIST_LIMIT}`,
        [like],
      )
    ).rows;
    hits += print('ACTIVITY', activity, full, totalFrom(activity), identity);

    hits += print(
      'MISSIONS',
      (
        await client.query(
          `select m.id, m.code, m.name, m.status, m.objective, m.environment,
                  (select string_agg(mr.asset_id, ', ' order by mr.asset_id)
                     from mission_requisitions mr
                    where mr.mission_id = m.id and mr.asset_id ilike $1) as matching_requisitions,
                  (select string_agg(rl, ', ' order by rl)
                     from unnest(coalesce(m.required_loadout, ARRAY[]::text[])) rl
                    where rl ilike $1) as matching_loadout,
                  ${
                    identity
                      ? `null::text as matching_after_actions,
                  null::text as matching_objectives,
                  (select string_agg(c.label || ' ' || c.value::text || c.unit, ', ' order by c.id)
                     from mission_constraints c
                    where c.mission_id = m.id and c.label ilike $1) as matching_constraints`
                      : `(select string_agg(a.text, ' | ' order by a.position)
                     from mission_after_actions a
                    where a.mission_id = m.id and a.text ilike $1) as matching_after_actions,
                  (select string_agg(o.text, ' | ' order by o.id)
                     from mission_objectives o
                    where o.mission_id = m.id and o.text ilike $1) as matching_objectives,
                  (select string_agg(c.label || ' ' || c.value::text || c.unit, ', ' order by c.id)
                     from mission_constraints c
                    where c.mission_id = m.id
                       and (c.label ilike $1 or c.unit ilike $1)) as matching_constraints`
                  }
             from missions m
            where ${missionWhere(identity)}
            order by m.id`,
          [like],
        )
      ).rows,
      full,
      undefined,
      identity,
    );

    hits += print(
      'CAPABILITIES',
      (
        await client.query(
          `select id, name, description, unlocked, bay
             from capabilities
            where ${capabilityWhere(identity)}
            order by id`,
          [like],
        )
      ).rows,
      full,
      undefined,
      identity,
    );

    hits += print(
      'WISHLIST',
      (
        await client.query(
          `select w.asset_id, a.name, w.rationale, w.risk_note, w.source,
                  w.for_asset_id, w.for_mission_id
             from wishlist_meta w
             join assets a on a.id = w.asset_id
            where ${wishlistWhere(identity)}
            order by w.asset_id`,
          [like],
        )
      ).rows,
      full,
      undefined,
      identity,
    );

    const insightRows = (
      await client.query(
        `select i.id, i.title, i.confidence, i.source, i.captured_at, i.body,
                count(*) over() as total_matches
           from insights i
          where ${insightWhere(identity)}
          order by i.captured_at desc nulls last
          limit ${LIST_LIMIT}`,
        [like],
      )
    ).rows;
    hits += print('INSIGHTS', insightRows, full, totalFrom(insightRows), identity);

    const briefingRows = (
      await client.query(
        `select id, title, kind, summary, tags, aliases, body_markdown,
                count(*) over() as total_matches
           from briefings
          where ${briefingWhere(identity)}
          order by id
          limit ${LIST_LIMIT}`,
        [like],
      )
    ).rows;
    hits += print('BRIEFINGS', briefingRows, full, totalFrom(briefingRows), identity);

    if (hits === 0) {
      console.log('\nNo matches.');
    }
  } finally {
    await client.end();
  }
}

const launchedDirectly =
  typeof process.argv[1] === 'string' &&
  /[/\\]find\.ts$/.test(process.argv[1].replaceAll('\\', '/'));

if (launchedDirectly) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
