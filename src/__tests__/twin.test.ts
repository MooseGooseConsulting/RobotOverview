import { describe, it, expect } from 'vitest';
import { hangarData } from '@/data/hangar';
import {
  ACTIVE_HOST_LABELS,
  ACTIVE_HOSTS,
  buildBoardLayout,
  buildBusLayout,
  buildIsoLayout,
  buildLayout,
  documentsForNet,
  netKindColor,
  netsForTerminal,
  resolveActive,
  traceFromNet,
  traceFromTerminal,
  VIEW_MODE_LABELS,
  VIEW_MODES,
  type TwinLayout,
} from '@/lib/twin';

const { units, terminals, nets, documents } = hangarData;
const terminalIds = new Set(terminals.map((t) => t.id));

describe('twin graph helpers', () => {
  it('maps every net kind to a stable color key', () => {
    expect(netKindColor('power')).toBe('amber');
    expect(netKindColor('data')).toBe('cyan');
    expect(netKindColor('mixed')).toBe('mixed');
    expect(netKindColor('mechanical')).toBe('idle');
  });

  it('netsForTerminal round-trips against the net terminal lists', () => {
    for (const net of nets) {
      for (const tid of net.terminals) {
        expect(netsForTerminal(nets, tid).map((n) => n.id)).toContain(net.id);
      }
    }
    // pi5-40pin is the super-hub — it belongs to three nets.
    expect(netsForTerminal(nets, 'pi5-40pin').map((n) => n.id).sort()).toEqual(
      ['net-5v-host', 'net-host-uart', 'net-ups-telemetry'].sort(),
    );
  });

  it('resolves proving documents for a net in order', () => {
    const servo = nets.find((n) => n.id === 'net-servo-bus')!;
    expect(documentsForNet(documents, servo).map((d) => d.id)).toEqual([
      'doc-st-protocol',
      'doc-st-circuit',
      'doc-st3215-manual',
    ]);
    const bare = documentsForNet(documents, { ...servo, documents: undefined });
    expect(bare).toEqual([]);
  });

  it('traces a terminal to its nets and sibling terminals', () => {
    const trace = traceFromTerminal(nets, 'gdb-servo-bus');
    expect(trace.netIds.has('net-servo-bus')).toBe(true);
    expect(trace.terminalIds.has('beast-pan-tilt')).toBe(true);
    expect(trace.terminalIds.size).toBe(2);
    // Not on the servo bus.
    expect(trace.terminalIds.has('pi5-40pin')).toBe(false);
  });

  it('traces a net to exactly its own terminals', () => {
    const trace = traceFromNet(nets, 'net-5v-host');
    expect([...trace.netIds]).toEqual(['net-5v-host']);
    expect([...trace.terminalIds].sort()).toEqual(['gdb-5v-host', 'pi5-40pin'].sort());
  });
});

describe('resolveActive (host swap)', () => {
  it('lights the Pi stack path and dims the Orin under pi5', () => {
    const active = resolveActive(terminals, nets, 'pi5');
    expect(active.terminalIds.has('pi5-40pin')).toBe(true);
    expect(active.terminalIds.has('pi5-usb')).toBe(true);
    expect(active.terminalIds.has('orin-uart')).toBe(false);
    expect(active.terminalIds.has('orin-dc-in')).toBe(false);
    expect(active.terminalIds.has('orin-usb')).toBe(false);
    // The 5V host rail powers the Pi; UPS telemetry and camera reach the Pi.
    expect(active.netIds.has('net-5v-host')).toBe(true);
    expect(active.netIds.has('net-ups-telemetry')).toBe(true);
    expect(active.netIds.has('net-camera')).toBe(true);
    // UART is live via the stacked header.
    expect(active.netIds.has('net-host-uart')).toBe(true);
  });

  it('lights the Orin jumpers and drops the 5V rail under orin', () => {
    const active = resolveActive(terminals, nets, 'orin');
    expect(active.terminalIds.has('orin-uart')).toBe(true);
    expect(active.terminalIds.has('orin-dc-in')).toBe(true);
    expect(active.terminalIds.has('orin-usb')).toBe(true);
    expect(active.terminalIds.has('pi5-40pin')).toBe(false);
    expect(active.terminalIds.has('pi5-usb')).toBe(false);
    // Orin can't draw header 5V and the optional Pi-bound UPS telemetry goes dark.
    // The camera and ACCE sensors move to the Orin USB host at cutover.
    expect(active.netIds.has('net-5v-host')).toBe(false);
    expect(active.netIds.has('net-ups-telemetry')).toBe(false);
    expect(active.netIds.has('net-camera')).toBe(true);
    expect(active.netIds.has('net-oak-camera')).toBe(true);
    expect(active.netIds.has('net-d500-lidar')).toBe(true);
    // UART stays live via TX/RX/GND jumpers; battery rail still energized.
    expect(active.netIds.has('net-host-uart')).toBe(true);
    expect(active.netIds.has('net-battery-rail')).toBe(true);
  });

  it('keeps host-agnostic subsystems live under either host', () => {
    for (const host of ACTIVE_HOSTS) {
      const active = resolveActive(terminals, nets, host);
      expect(active.netIds.has('net-servo-bus')).toBe(true);
      expect(active.netIds.has('net-motor-left')).toBe(true);
      expect(active.netIds.has('net-motor-right')).toBe(true);
      expect(active.netIds.has('net-oled-i2c')).toBe(true);
    }
  });
});

const wiredUnitCount = new Set(terminals.map((t) => t.unitId)).size;

function everyCoordFinite(layout: TwinLayout): boolean {
  const nums = [
    layout.width,
    layout.height,
    ...layout.modules.flatMap((m) => [m.x, m.y, m.w, m.h]),
    ...layout.ports.flatMap((p) => [p.x, p.y, p.nx, p.ny]),
    ...layout.wires.flatMap((w) => [w.midX, w.midY]),
  ];
  return nums.every((n) => Number.isFinite(n));
}

describe('twin control vocabularies', () => {
  it('labels every exported view mode and host option', () => {
    expect(VIEW_MODES).toEqual(['board', 'iso', 'bus']);
    expect(VIEW_MODES.map((mode) => VIEW_MODE_LABELS[mode])).toEqual(['Board', 'Cutaway', 'Bus']);
    expect(ACTIVE_HOSTS).toEqual(['pi5', 'orin']);
    expect(ACTIVE_HOSTS.map((host) => ACTIVE_HOST_LABELS[host])).toEqual(['Raspberry Pi 5', 'Jetson Orin']);
  });
});

describe.each(VIEW_MODES)('layout builder: %s', (mode) => {
  const layout = buildLayout(mode, units, terminals, nets);

  it('emits a module for every wired unit', () => {
    expect(layout.modules.length).toBe(wiredUnitCount);
    expect(new Set(layout.modules.map((m) => m.unitId)).size).toBe(wiredUnitCount);
  });

  it('emits a non-empty path for every net', () => {
    expect(layout.wires.length).toBe(nets.length);
    for (const w of layout.wires) {
      expect(w.d.length, `net "${w.netId}" has empty path`).toBeGreaterThan(0);
      expect(w.d.includes('NaN'), `net "${w.netId}" path has NaN`).toBe(false);
    }
  });

  it('only references real terminals in ports', () => {
    for (const p of layout.ports) {
      expect(terminalIds.has(p.terminalId), `port references unknown terminal "${p.terminalId}"`).toBe(true);
    }
  });

  it('only references terminals rendered as ports in wires', () => {
    for (const w of layout.wires) {
      for (const tid of w.terminalIds) {
        const hasPort =
          mode === 'bus'
            ? layout.ports.some((p) => p.netId === w.netId && p.terminalId === tid)
            : layout.ports.some((p) => p.terminalId === tid);
        expect(hasPort, `wire "${w.netId}" references unrendered terminal "${tid}"`).toBe(true);
      }
    }
  });

  it('has only finite coordinates', () => {
    expect(everyCoordFinite(layout)).toBe(true);
  });

  it('is deterministic', () => {
    const again = buildLayout(mode, units, terminals, nets);
    expect(again).toEqual(layout);
  });
});

describe('board & iso place every terminal', () => {
  it.each([
    ['board', buildBoardLayout],
    ['iso', buildIsoLayout],
  ] as const)('%s has a port for each terminal exactly once', (_mode, build) => {
    const layout = build(units, terminals, nets);
    const portTerminals = layout.ports.map((p) => p.terminalId);
    expect(new Set(portTerminals).size).toBe(terminals.length);
    expect(portTerminals.length).toBe(terminals.length);
  });
});

describe('terminals with no authored edge', () => {
  // A terminal ingested into Postgres after these layouts were hand-drawn has
  // no BOARD_EDGES entry. It used to land on 'top' whatever module carried it,
  // so its wires left the wrong side of the box.
  const strays = [
    // orin-nano sits right of the driver-board hub -> should exit left
    { id: 'zz-orin-stray', unitId: 'orin-nano', name: 'Ingested Orin port' },
    // stock-ups sits above-left of the hub -> should exit right or bottom
    { id: 'zz-ups-stray', unitId: 'stock-ups', name: 'Ingested UPS port' },
  ];

  it.each([
    ['board', buildBoardLayout],
    ['iso', buildIsoLayout],
  ] as const)('%s reports them instead of hiding them', (_mode, build) => {
    const layout = build(units, [...terminals, ...strays], nets);
    expect(layout.unmappedTerminalIds).toEqual(strays.map((s) => s.id));
    // Everything hand-authored stays authored.
    for (const t of terminals) expect(layout.unmappedTerminalIds).not.toContain(t.id);
  });

  it('board places them facing the hub, not always on top', () => {
    const layout = buildBoardLayout(units, [...terminals, ...strays], nets);
    const orin = layout.ports.find((p) => p.terminalId === 'zz-orin-stray');
    // orin-nano is right of the hub, so its stray port must exit leftward.
    expect(orin?.nx).toBe(-1);
    expect(orin?.ny).toBe(0);

    const ups = layout.ports.find((p) => p.terminalId === 'zz-ups-stray');
    // stock-ups is up and to the left; either inward edge is correct, but the
    // old 'top' fallback (ny === -1) points away from the hub and is not.
    expect(ups?.ny).not.toBe(-1);
  });

  it('reports nothing when every terminal is authored', () => {
    expect(buildBoardLayout(units, terminals, nets).unmappedTerminalIds).toEqual([]);
    expect(buildIsoLayout(units, terminals, nets).unmappedTerminalIds).toEqual([]);
    // Bus mode never edge-places, so it has nothing to report either.
    expect(buildBusLayout(units, [...terminals, ...strays], nets).unmappedTerminalIds).toEqual([]);
  });
});

describe('bus taps each net terminal on its row', () => {
  it('gives every net at least two tap nodes', () => {
    const layout = buildBusLayout(units, terminals, nets);
    for (const net of nets) {
      const taps = layout.ports.filter((p) => p.netId === net.id);
      expect(taps.length, `net "${net.id}" should tap ≥2 columns`).toBeGreaterThanOrEqual(2);
    }
  });

  it('lets the super-hub terminal tap multiple rows', () => {
    const layout = buildBusLayout(units, terminals, nets);
    const taps = layout.ports.filter((p) => p.terminalId === 'pi5-40pin');
    expect(taps.length).toBe(3);
    expect(new Set(taps.map((p) => p.netId)).size).toBe(3);
  });
});
