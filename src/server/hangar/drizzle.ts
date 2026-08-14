import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { getHangarPool } from './db';
import * as schema from './schema';

export type HangarDrizzle = NodePgDatabase<typeof schema>;

let db: HangarDrizzle | null = null;
let boundPool: unknown = null;

/** Drizzle client over the shared Hangar pg pool. Null when DB is not configured. */
export async function getHangarDrizzle(): Promise<HangarDrizzle | null> {
  const pool = await getHangarPool();
  if (!pool) {
    db = null;
    boundPool = null;
    return null;
  }
  if (db && boundPool === pool) return db;
  db = drizzle(pool, { schema });
  boundPool = pool;
  return db;
}
