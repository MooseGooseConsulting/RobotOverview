export const BEAST_COCKPIT_WS_URL_DEFAULT = 'wss://beast-01.tyrannosaurus-magellanic.ts.net/';

/** Env slice for bridge URL resolution (avoids requiring full ProcessEnv in tests). */
export type BeastCockpitWsEnv = {
  BEAST_COCKPIT_WS_URL?: string | undefined;
};

export function resolveBeastCockpitWsUrl(
  env: BeastCockpitWsEnv = process.env,
): string {
  return env.BEAST_COCKPIT_WS_URL?.trim() || BEAST_COCKPIT_WS_URL_DEFAULT;
}
