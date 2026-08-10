/**
 * Search the live Hangar database from the command line.
 *
 *   doppler run --project homelab --config dev -- npx tsx db/hangar/find.ts battery
 *   doppler run --project homelab --config dev -- npx tsx db/hangar/find.ts --full 12.6
 *
 * This exists because AGENTS.md documented the *write* path (POST
 * /api/hangar/ingest, every op verb, every error code) and no read path at
 * all. Agents therefore grepped `src/data/hangar.ts`, found plausible data,
 * and stopped -- but that file is a CI fixture, not the record. On 2026-08-07
 * that cost a round trip asking the owner to photograph a battery label whose
 * spec was already in `assets` as `stock-ups`.
 *
 * Searches assets (including the `specs` JSON, where a lot of the real detail
 * hides), terminals, sockets, insights, and briefings.
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

type Row = Record<string, unknown>;

function parseArgs(argv: string[]) {
  const full = argv.includes('--full');
  const terms = argv.filter((a) => !a.startsWith('--'));
  return { full, term: terms.join(' ').trim() };
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

function print(label: string, rows: Row[], full: boolean) {
  if (!rows.length) return;
  console.log(`\n===== ${label} (${rows.length}) =====`);
  for (const row of rows) {
    console.log('---');
    for (const [key, value] of Object.entries(row)) {
      if (value === null || value === undefined || value === '') continue;
      let text = typeof value === 'object' ? JSON.stringify(value) : String(value);
      const limit = full ? 100_000 : 700;
      if (text.length > limit) text = `${text.slice(0, limit)} …[--full for more]`;
      console.log(`${key}: ${text}`);
    }
  }
}

async function main() {
  const { full, term } = parseArgs(process.argv.slice(2));
  if (!term) {
    console.error('usage: npx tsx db/hangar/find.ts [--full] <search term>');
    process.exitCode = 2;
    return;
  }

  const like = `%${term}%`;
  const client = resolveClient();
  await client.connect();

  try {
    // specs is JSONB and holds a lot of the real hardware detail (cell counts,
    // voltages, connector types) that never appears in name or summary.
    print(
      'ASSETS',
      (
        await client.query(
          `select id, kind, name, callsign, manufacturer, model, status, summary,
                  description, power_volts, power_watts, power_rail, specs, limitations
             from assets
            where id ilike $1 or name ilike $1 or summary ilike $1
               or coalesce(description,'') ilike $1
               or coalesce(callsign,'') ilike $1
               or coalesce(manufacturer,'') ilike $1
               or coalesce(model,'') ilike $1
               or coalesce(power_rail,'') ilike $1
               or coalesce(power_volts::text,'') ilike $1
               or coalesce(power_watts::text,'') ilike $1
               or specs::text ilike $1
            order by id`,
          [like],
        )
      ).rows,
      full,
    );

    // terminals, not asset_interfaces: the latter is just a join table
    // (asset_id, interface_type_id). Connector-level facts -- voltages, rails,
    // "3S pack, 9-12.6V @ 2A" -- live here. Match parent asset fields so a
    // search for stock-ups / battery also surfaces ups-charge-in rails.
    print(
      'TERMINALS (connectors / rails)',
      (
        await client.query(
          `select t.id, t.asset_id, a.name as asset_name, a.callsign as asset_callsign,
                  t.name, t.connector, t.role, t.note
             from terminals t
             join assets a on a.id = t.asset_id
            where t.id ilike $1 or t.name ilike $1
               or coalesce(t.note,'') ilike $1
               or coalesce(t.connector,'') ilike $1
               or t.asset_id ilike $1
               or a.name ilike $1
               or coalesce(a.callsign,'') ilike $1
               or coalesce(a.summary,'') ilike $1
            order by t.asset_id, t.id`,
          [like],
        )
      ).rows,
      full,
    );

    print(
      'SOCKETS (loadout slots)',
      (
        await client.query(
          // id is integer here, unlike every other table — cast before ilike.
          `select id, host_asset_id, slot_group, name, note
             from sockets
            where id::text ilike $1 or name ilike $1
               or coalesce(note,'') ilike $1
               or coalesce(slot_group,'') ilike $1
               or host_asset_id ilike $1
            order by host_asset_id, id`,
          [like],
        )
      ).rows,
      full,
    );

    print(
      'INSIGHTS',
      (
        await client.query(
          `select i.id, i.title, i.confidence, i.source, i.captured_at, i.body
             from insights i
            where i.id ilike $1 or i.title ilike $1 or i.body ilike $1
               or coalesce(i.source,'') ilike $1
               or exists (
                    select 1 from insight_assets ia
                     where ia.insight_id = i.id and ia.asset_id ilike $1
                  )
               or exists (
                    select 1 from insight_missions im
                     where im.insight_id = i.id and im.mission_id ilike $1
                  )
            order by i.captured_at desc nulls last
            limit 25`,
          [like],
        )
      ).rows,
      full,
    );

    print(
      'BRIEFINGS',
      (
        await client.query(
          `select id, title, kind, summary, tags, aliases, body_markdown
             from briefings
            where id ilike $1 or title ilike $1 or coalesce(summary,'') ilike $1
               or body_markdown ilike $1
               or array_to_string(tags, ' ') ilike $1
               or array_to_string(aliases, ' ') ilike $1
            order by id
            limit 25`,
          [like],
        )
      ).rows,
      full,
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
