import { getHangarPool } from './db';
import type { Queryable } from './queryable';
import type { HangarFallbackReason } from '@/lib/hangar-read-status';

export type HangarRead<T> =
  | {
      source: 'postgres';
      fallbackReason?: undefined;
      data: T;
    }
  | {
      source: 'unavailable';
      fallbackReason: HangarFallbackReason;
    };

export async function readHangarOrUnavailable<T>({
  label,
  readFromPostgres,
  getClient = getHangarPool,
}: {
  label: string;
  readFromPostgres: (client: Queryable) => Promise<T>;
  getClient?: () => Promise<Queryable | null>;
}): Promise<HangarRead<T>> {
  try {
    const pool = await getClient();
    if (!pool) {
      return {
        source: 'unavailable',
        fallbackReason: 'not-configured',
      };
    }

    return {
      source: 'postgres',
      data: await readFromPostgres(pool),
    };
  } catch (error) {
    console.warn(`Hangar Postgres ${label} read failed; not serving a TypeScript roster.`, error);
    return {
      source: 'unavailable',
      fallbackReason: 'postgres-error',
    };
  }
}
