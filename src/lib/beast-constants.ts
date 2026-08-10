export const BEAST_COCKPIT_WS_URL_DEFAULT = 'wss://beast-01.tyrannosaurus-magellanic.ts.net/';

/** Accepts process.env or a small test stub (`{}` / `{ BEAST_COCKPIT_WS_URL }`). */
export function resolveBeastCockpitWsUrl(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): string {
  return env.BEAST_COCKPIT_WS_URL?.trim() || BEAST_COCKPIT_WS_URL_DEFAULT;
}
