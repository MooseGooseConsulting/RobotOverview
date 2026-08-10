import { describe, expect, it } from 'vitest';

import {
  BEAST_COCKPIT_WS_URL_DEFAULT,
  resolveBeastCockpitWsUrl,
} from '@/lib/beast-constants';

describe('beast cockpit bridge URL', () => {
  it('defaults to Tailscale Serve MagicDNS WSS (port 443 path)', () => {
    expect(BEAST_COCKPIT_WS_URL_DEFAULT).toBe(
      'wss://beast-01.tyrannosaurus-magellanic.ts.net/',
    );
    expect(resolveBeastCockpitWsUrl({})).toBe(BEAST_COCKPIT_WS_URL_DEFAULT);
  });

  it('honors BEAST_COCKPIT_WS_URL override', () => {
    expect(
      resolveBeastCockpitWsUrl({ BEAST_COCKPIT_WS_URL: ' wss://example.test/ ' }),
    ).toBe('wss://example.test/');
  });
});
