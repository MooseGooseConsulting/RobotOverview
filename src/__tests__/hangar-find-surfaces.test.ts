import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FIND_FULL_ONLY_FIELDS,
  FIND_IDENTITY_FIELDS,
  FIND_SURFACE_SKIP,
  FIND_SURFACES,
  parseFindArgs,
} from '../../db/hangar/find';

function schemaTables(): string[] {
  const sql = readFileSync(resolve(process.cwd(), 'db/hangar/schema.sql'), 'utf8');
  const names = [...sql.matchAll(/CREATE TABLE\s+([a-z_]+)/g)].map((m) => m[1]!);
  return [...new Set(names)].sort();
}

describe('find.ts corpus coverage', () => {
  it('every schema table is searched or explicitly skipped', () => {
    const searched = new Set<string>(FIND_SURFACES);
    const skipped = new Set<string>(FIND_SURFACE_SKIP);
    const overlap = [...searched].filter((t) => skipped.has(t));
    expect(overlap).toEqual([]);

    const uncovered = schemaTables().filter((t) => !searched.has(t) && !skipped.has(t));
    expect(uncovered).toEqual([]);
  });

  it('searches the fact surfaces the pack miss needed', () => {
    expect(FIND_SURFACES).toEqual(
      expect.arrayContaining([
        'assets',
        'documents',
        'nets',
        'activity_log',
        'missions',
        'mission_after_actions',
        'capabilities',
        'wishlist_meta',
        'insights',
        'briefings',
      ]),
    );
  });

  it('parses --identity without treating it as the search term', () => {
    expect(parseFindArgs(['--identity', 'pack'])).toEqual({
      full: false,
      identity: true,
      term: 'pack',
    });
    expect(parseFindArgs(['--full', '--identity', 'NCR18650GA'])).toEqual({
      full: true,
      identity: true,
      term: 'NCR18650GA',
    });
  });

  it('identity fields exclude body, summary, and notes', () => {
    const named = Object.values(FIND_IDENTITY_FIELDS).flat();
    for (const banned of FIND_FULL_ONLY_FIELDS) {
      expect(named).not.toContain(banned);
      expect(named.some((field) => field.endsWith(`.${banned}`))).toBe(false);
    }
  });
});
