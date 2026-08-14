// ─────────────────────────────────────────────────────────────────────────────
// Connected-twin core — pure graph + layout math for "THE BOARD".
//
// This module is deliberately React-free and deterministic (no Date/Math.random)
// so the whole wiring model is unit-testable and snapshot-stable. It renders the
// terminals/nets/documents authored in the data spine into three interchangeable
// layouts (board / iso / bus) over one normalized shape.
//
// Layout constants live at the top as named exports: design-mode tuning is a
// single-value edit here, not a component rewrite.
// ─────────────────────────────────────────────────────────────────────────────
import type { DocumentRef, Net, NetKind, Terminal, Unit } from '../data/types';

export const VIEW_MODES = ['board', 'iso', 'bus'] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

export const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  board: 'Board',
  iso: 'Cutaway',
  bus: 'Bus',
};

export const ACTIVE_HOSTS = ['pi5', 'orin'] as const;
export type ActiveHost = (typeof ACTIVE_HOSTS)[number];

export const ACTIVE_HOST_LABELS: Record<ActiveHost, string> = {
  pi5: 'Raspberry Pi 5',
  orin: 'Jetson Orin',
};

type Edge = 'top' | 'right' | 'bottom' | 'left';

/** Semantic color key per net kind; the UI maps this to CSS vars. */
export type NetColorKey = 'amber' | 'cyan' | 'mixed' | 'idle';

// ── Normalized layout shape (identical across all three view modes) ──────────
export interface ModuleBox {
  unitId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PortNode {
  /** Unique per node. In bus mode a terminal taps once per net, so key !== terminalId. */
  key: string;
  terminalId: string;
  /** Set only in bus mode, where a tap belongs to a specific net row. */
  netId?: string;
  x: number;
  y: number;
  /** Outward unit normal — control-point direction for wires and label offset. */
  nx: number;
  ny: number;
}

export interface WirePath {
  netId: string;
  kind: NetKind;
  /** SVG path data. */
  d: string;
  /** Anchor for a net label / traveling pulse origin. */
  midX: number;
  midY: number;
  terminalIds: string[];
}

export interface TwinLayout {
  width: number;
  height: number;
  modules: ModuleBox[];
  ports: PortNode[];
  wires: WirePath[];
  /**
   * Terminals placed by geometry because no hand-authored edge names them —
   * i.e. wiring ingested into Postgres since this layout was drawn. Their
   * anchors are a reasonable guess, not authored truth; surface them rather
   * than let the drift stay invisible.
   */
  unmappedTerminalIds: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Graph helpers
// ─────────────────────────────────────────────────────────────────────────────

export function netKindColor(kind: NetKind): NetColorKey {
  switch (kind) {
    case 'power':
      return 'amber';
    case 'data':
      return 'cyan';
    case 'mixed':
      return 'mixed';
    case 'mechanical':
      return 'idle';
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/** Every net that includes the given terminal. */
export function netsForTerminal(nets: Net[], terminalId: string): Net[] {
  return nets.filter((n) => n.terminals.includes(terminalId));
}

/** The documents that prove a net's wiring, resolved in order. */
export function documentsForNet(documents: DocumentRef[], net: Net): DocumentRef[] {
  const byId = new Map(documents.map((d) => [d.id, d]));
  return (net.documents ?? []).map((id) => byId.get(id)).filter((d): d is DocumentRef => Boolean(d));
}

export interface TraceSet {
  netIds: Set<string>;
  terminalIds: Set<string>;
}

/** Hover a port → light every net it touches and all their sibling terminals. */
export function traceFromTerminal(nets: Net[], terminalId: string): TraceSet {
  const netIds = new Set<string>();
  const terminalIds = new Set<string>([terminalId]);
  for (const net of nets) {
    if (net.terminals.includes(terminalId)) {
      netIds.add(net.id);
      net.terminals.forEach((t) => terminalIds.add(t));
    }
  }
  return { netIds, terminalIds };
}

/** Hover a wire → light that net and its terminals. */
export function traceFromNet(nets: Net[], netId: string): TraceSet {
  const net = nets.find((n) => n.id === netId);
  return {
    netIds: new Set(net ? [net.id] : []),
    terminalIds: new Set(net ? net.terminals : []),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Host swap — the Jetson-vs-Pi hero interaction, as data.
//
// A terminal is "owned" by a host if it only exists when that host is installed.
// A net stays energized while ≥2 of its terminals are active, so flipping the
// host re-lights and drops nets exactly the way the physical swap does:
//   • 5V host rail   → dies on Orin (Orin can't draw header 5V)
//   • host↔ESP32 UART→ Pi stacks the 40-pin; Orin uses TX/RX/GND jumpers
//   • battery rail   → Orin taps the barrel jack (extra live terminal)
//   • UPS telemetry / Pi-USB camera → follow the Pi, dark on Orin
// ─────────────────────────────────────────────────────────────────────────────
const HOST_TERMINALS: Record<string, ActiveHost> = {
  'pi5-40pin': 'pi5',
  'pi5-usb': 'pi5',
  'orin-uart': 'orin',
  'orin-dc-in': 'orin',
  'orin-usb': 'orin',
};

export interface ActiveSet {
  terminalIds: Set<string>;
  netIds: Set<string>;
}

export function resolveActive(terminals: Terminal[], nets: Net[], host: ActiveHost): ActiveSet {
  const terminalIds = new Set<string>();
  for (const t of terminals) {
    const owner = HOST_TERMINALS[t.id];
    if (!owner || owner === host) terminalIds.add(t.id);
  }
  const netIds = new Set<string>();
  for (const net of nets) {
    const live = net.terminals.filter((t) => terminalIds.has(t));
    if (live.length >= 2) netIds.add(net.id);
  }
  return { terminalIds, netIds };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared layout primitives
// ─────────────────────────────────────────────────────────────────────────────

function wiredUnitIds(terminals: Terminal[]): Set<string> {
  return new Set(terminals.map((t) => t.unitId));
}

interface Anchor {
  x: number;
  y: number;
  nx: number;
  ny: number;
}

/** Evenly place the i-th of `count` ports along a module edge. */
function edgeAnchor(m: ModuleBox, edge: Edge, i: number, count: number): Anchor {
  const t = (i + 1) / (count + 1);
  switch (edge) {
    case 'top':
      return { x: m.x + t * m.w, y: m.y, nx: 0, ny: -1 };
    case 'bottom':
      return { x: m.x + t * m.w, y: m.y + m.h, nx: 0, ny: 1 };
    case 'left':
      return { x: m.x, y: m.y + t * m.h, nx: -1, ny: 0 };
    case 'right':
      return { x: m.x + m.w, y: m.y + t * m.h, nx: 1, ny: 0 };
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Route a net through its (positioned) terminals. Two terminals → a single
 * cubic bowed along their normals; three+ → a star through the centroid so a
 * shared rail/bus reads as one junction rather than a tangle.
 */
function routeWire(net: Net, positions: Map<string, Anchor>, bow: number): WirePath | null {
  const pts = net.terminals
    .map((id) => {
      const anchor = positions.get(id);
      return anchor ? { id, ...anchor } : null;
    })
    .filter((p): p is Anchor & { id: string } => Boolean(p));
  if (pts.length < 2) return null;
  const terminalIds = pts.map((p) => p.id);

  if (pts.length === 2) {
    const [a, b] = pts;
    const c0x = a.x + a.nx * bow;
    const c0y = a.y + a.ny * bow;
    const c1x = b.x + b.nx * bow;
    const c1y = b.y + b.ny * bow;
    const d = `M ${round(a.x)} ${round(a.y)} C ${round(c0x)} ${round(c0y)} ${round(c1x)} ${round(c1y)} ${round(b.x)} ${round(b.y)}`;
    // Cubic midpoint at t=0.5.
    const midX = 0.125 * a.x + 0.375 * c0x + 0.375 * c1x + 0.125 * b.x;
    const midY = 0.125 * a.y + 0.375 * c0y + 0.375 * c1y + 0.125 * b.y;
    return { netId: net.id, kind: net.kind, d, midX: round(midX), midY: round(midY), terminalIds };
  }

  const jx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const jy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const legs = pts
    .map((p) => {
      const cx = p.x + p.nx * bow;
      const cy = p.y + p.ny * bow;
      return `M ${round(p.x)} ${round(p.y)} Q ${round(cx)} ${round(cy)} ${round(jx)} ${round(jy)}`;
    })
    .join(' ');
  return { netId: net.id, kind: net.kind, d: legs, midX: round(jx), midY: round(jy), terminalIds };
}

// ─────────────────────────────────────────────────────────────────────────────
// Board layout — driver-board (ESP32) as the central hub, satellites around it.
// ─────────────────────────────────────────────────────────────────────────────
const BOARD_W = 1040;
const BOARD_H = 680;
const BOARD_WIRE_BOW = 48;

/** Fixed hub-and-satellite anchors, in board space. */
const BOARD_MODULES: Record<string, Omit<ModuleBox, 'unitId'>> = {
  'driver-board': { x: 390, y: 250, w: 260, h: 190 },
  'stock-ups': { x: 60, y: 70, w: 210, h: 130 },
  'oak-d-lite': { x: 70, y: 280, w: 210, h: 120 },
  'd500-lidar': { x: 80, y: 470, w: 200, h: 120 },
  pi5: { x: 790, y: 80, w: 190, h: 120 },
  'orin-nano': { x: 810, y: 300, w: 190, h: 120 },
  beast: { x: 350, y: 500, w: 350, h: 140 },
};

/** Which edge each terminal exits, chosen so wires flow toward their partners. */
const BOARD_EDGES: Record<string, Edge> = {
  // driver-board hub
  'gdb-power-in': 'left',
  'gdb-12v-switched': 'left',
  'gdb-5v-host': 'top',
  'gdb-usb-esp32': 'top',
  'gdb-lidar-uart': 'top',
  'gdb-host-uart': 'right',
  'gdb-servo-bus': 'bottom',
  'gdb-motor-a': 'bottom',
  'gdb-motor-b': 'bottom',
  'gdb-i2c': 'bottom',
  // UPS (top-left)
  'ups-rail-out': 'bottom',
  'ups-telemetry': 'right',
  'ups-charge-in': 'top',
  // Pi 5 (top-right)
  'pi5-40pin': 'left',
  'pi5-usb': 'bottom',
  // Orin (right)
  'orin-uart': 'left',
  'orin-dc-in': 'left',
  'orin-usb': 'left',
  // ACCE sensing payload (left)
  'oak-usb': 'right',
  'd500-uart': 'right',
  // Beast chassis (bottom-center) — all face the hub above
  'beast-motor-left': 'top',
  'beast-motor-right': 'top',
  'beast-pan-tilt': 'top',
  'beast-camera': 'top',
  'beast-oled': 'top',
};

const BOARD_MODULE_ORDER = ['stock-ups', 'oak-d-lite', 'd500-lidar', 'driver-board', 'pi5', 'orin-nano', 'beast'];

/** The unit every satellite cables back to; its box anchors the fallback. */
const HUB_UNIT_ID = 'driver-board';

/**
 * Centre of the hub, in whatever space the caller's modules live in (board or
 * iso). Falls back to the centroid of the placed modules when the driver-board
 * itself is unwired, so the result is always inside the drawing.
 */
function hubCenter(modules: Iterable<ModuleBox>): { x: number; y: number } {
  const all = [...modules];
  const hub = all.find((m) => m.unitId === HUB_UNIT_ID);
  const boxes = hub ? [hub] : all;
  if (!boxes.length) return { x: 0, y: 0 };
  return {
    x: boxes.reduce((s, m) => s + m.x + m.w / 2, 0) / boxes.length,
    y: boxes.reduce((s, m) => s + m.y + m.h / 2, 0) / boxes.length,
  };
}

/**
 * Which edge a terminal exits when BOARD_EDGES doesn't name it.
 *
 * BOARD_EDGES only covers the terminals that existed when these layouts were
 * drawn by hand. Anything ingested into Postgres since then used to land on
 * 'top' regardless of where its module sits, so a newly wired unit rendered
 * its wires leaving the wrong side of the box — geometry that looks
 * authoritative and isn't. Face the hub instead: deterministic, right for most
 * real connectors (they point at whatever they cable to), and it degrades
 * toward the truth rather than toward a fixed lie.
 */
function hubFacingEdge(m: ModuleBox, hub: { x: number; y: number }): Edge {
  const dx = hub.x - (m.x + m.w / 2);
  const dy = hub.y - (m.y + m.h / 2);
  if (dx === 0 && dy === 0) return 'top'; // the hub's own box
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'bottom' : 'top';
}

function buildEdgeGroupedPorts(terminals: Terminal[], moduleById: Map<string, ModuleBox>) {
  // Group each unit's terminals by the edge they exit, preserving spine order.
  const hub = hubCenter(moduleById.values());
  const unmappedTerminalIds: string[] = [];
  const byUnitEdge = new Map<string, Terminal[]>();
  for (const t of terminals) {
    const m = moduleById.get(t.unitId);
    if (!m) continue;
    let edge = BOARD_EDGES[t.id];
    if (!edge) {
      edge = hubFacingEdge(m, hub);
      unmappedTerminalIds.push(t.id);
    }
    const key = `${t.unitId}|${edge}`;
    const list = byUnitEdge.get(key);
    if (list) list.push(t);
    else byUnitEdge.set(key, [t]);
  }

  const ports: PortNode[] = [];
  const positions = new Map<string, Anchor>();
  for (const [key, ts] of byUnitEdge) {
    const [unitId, edge] = key.split('|') as [string, Edge];
    const m = moduleById.get(unitId)!;
    ts.forEach((t, i) => {
      const a = edgeAnchor(m, edge, i, ts.length);
      positions.set(t.id, a);
      ports.push({ key: t.id, terminalId: t.id, x: round(a.x), y: round(a.y), nx: a.nx, ny: a.ny });
    });
  }

  return { ports, positions, unmappedTerminalIds };
}

export function buildBoardLayout(units: Unit[], terminals: Terminal[], nets: Net[]): TwinLayout {
  const wired = wiredUnitIds(terminals);
  const modules: ModuleBox[] = BOARD_MODULE_ORDER.filter(
    (id) => wired.has(id) && BOARD_MODULES[id],
  ).map((id) => ({ unitId: id, ...BOARD_MODULES[id] }));
  const moduleById = new Map(modules.map((m) => [m.unitId, m]));
  const { ports, positions, unmappedTerminalIds } = buildEdgeGroupedPorts(terminals, moduleById);

  const wires = nets
    .map((n) => routeWire(n, positions, BOARD_WIRE_BOW))
    .filter((w): w is WirePath => Boolean(w));

  return { width: BOARD_W, height: BOARD_H, modules, ports, wires, unmappedTerminalIds };
}

// ─────────────────────────────────────────────────────────────────────────────
// Iso layout — units stacked on decks, projected to a 2.5D cutaway.
// ─────────────────────────────────────────────────────────────────────────────
const ISO_W = 1040;
const ISO_H = 680;
const ISO_WIRE_BOW = 90;
const ISO_MODULE_W = 210;
const ISO_MODULE_H = 120;

const ISO_ORIGIN_X = 250;
const ISO_ORIGIN_Y = 250;
const ISO_UNIT = 210; // ground grid spacing
const ISO_SCALE_X = 0.92;
const ISO_SCALE_Y = 0.5;
const ISO_DECK_H = 150;

/** Ground grid cell (col,row) + vertical deck for each unit. */
const ISO_PLACEMENT: Record<string, { col: number; row: number; deck: number }> = {
  'stock-ups': { col: 0, row: 0, deck: 0 },
  beast: { col: 1, row: 1, deck: 0 },
  'driver-board': { col: 1, row: 0, deck: 1 },
  'oak-d-lite': { col: 0, row: 1, deck: 2 },
  'd500-lidar': { col: 1, row: 1, deck: 2 },
  pi5: { col: 2, row: 0, deck: 2 },
  'orin-nano': { col: 2, row: 1, deck: 2 },
};

const ISO_MODULE_ORDER = ['stock-ups', 'beast', 'driver-board', 'oak-d-lite', 'd500-lidar', 'pi5', 'orin-nano'];

function isoProject(col: number, row: number, deck: number): { x: number; y: number } {
  const gx = col * ISO_UNIT;
  const gy = row * ISO_UNIT;
  return {
    x: ISO_ORIGIN_X + (gx - gy) * ISO_SCALE_X,
    y: ISO_ORIGIN_Y + (gx + gy) * ISO_SCALE_Y - deck * ISO_DECK_H,
  };
}

export function buildIsoLayout(units: Unit[], terminals: Terminal[], nets: Net[]): TwinLayout {
  const wired = wiredUnitIds(terminals);
  const modules: ModuleBox[] = ISO_MODULE_ORDER.filter(
    (id) => wired.has(id) && ISO_PLACEMENT[id],
  ).map((id) => {
    const p = ISO_PLACEMENT[id];
    const c = isoProject(p.col, p.row, p.deck);
    return { unitId: id, x: round(c.x - ISO_MODULE_W / 2), y: round(c.y - ISO_MODULE_H / 2), w: ISO_MODULE_W, h: ISO_MODULE_H };
  });
  const moduleById = new Map(modules.map((m) => [m.unitId, m]));
  const { ports, positions, unmappedTerminalIds } = buildEdgeGroupedPorts(terminals, moduleById);

  const wires = nets
    .map((n) => routeWire(n, positions, ISO_WIRE_BOW))
    .filter((w): w is WirePath => Boolean(w));

  return { width: ISO_W, height: ISO_H, modules, ports, wires, unmappedTerminalIds };
}

// ─────────────────────────────────────────────────────────────────────────────
// Bus layout — nets become horizontal spines; units are columns that tap in.
// A terminal on N nets taps N rows in its column (the metro-map read).
// ─────────────────────────────────────────────────────────────────────────────
const BUS_W = 1040;
const BUS_H = 680;
const BUS_MODULE_W = 150;

const BUS_X0 = 150;
const BUS_COL_GAP = 165;
const BUS_Y0 = 150;
const BUS_ROW_GAP = 52;
const BUS_TOP = 70;
const BUS_BOTTOM = 630;

const BUS_COLUMN_ORDER = ['stock-ups', 'driver-board', 'pi5', 'orin-nano', 'oak-d-lite', 'd500-lidar', 'beast'];
const BUS_ROW_ORDER = [
  'net-battery-rail',
  'net-5v-host',
  'net-host-uart',
  'net-servo-bus',
  'net-ups-telemetry',
  'net-oled-i2c',
  'net-camera',
  'net-oak-camera',
  'net-d500-lidar',
  'net-motor-left',
  'net-motor-right',
];

export function buildBusLayout(units: Unit[], terminals: Terminal[], nets: Net[]): TwinLayout {
  const wired = wiredUnitIds(terminals);
  const columns = BUS_COLUMN_ORDER.filter((id) => wired.has(id));
  const colX = new Map(columns.map((id, i) => [id, BUS_X0 + i * BUS_COL_GAP]));

  const modules: ModuleBox[] = columns.map((id) => ({
    unitId: id,
    x: round((colX.get(id) as number) - BUS_MODULE_W / 2),
    y: BUS_TOP,
    w: BUS_MODULE_W,
    h: BUS_BOTTOM - BUS_TOP,
  }));

  const termUnit = new Map(terminals.map((t) => [t.id, t.unitId]));
  const orderedNets = BUS_ROW_ORDER.map((id) => nets.find((n) => n.id === id)).filter(
    (n): n is Net => Boolean(n),
  );
  // Any net not in the explicit order still gets a row appended.
  for (const n of nets) if (!BUS_ROW_ORDER.includes(n.id)) orderedNets.push(n);

  const ports: PortNode[] = [];
  const wires: WirePath[] = [];

  orderedNets.forEach((net, rowIdx) => {
    const rowY = BUS_Y0 + rowIdx * BUS_ROW_GAP;
    const taps = net.terminals
      .map((tid) => {
        const unitId = termUnit.get(tid);
        const x = unitId ? colX.get(unitId) : undefined;
        return x === undefined ? null : { tid, x };
      })
      .filter((t): t is { tid: string; x: number } => Boolean(t));
    if (taps.length < 2) return;

    taps.forEach(({ tid, x }) => {
      ports.push({ key: `${net.id}:${tid}`, terminalId: tid, netId: net.id, x: round(x), y: rowY, nx: 0, ny: -1 });
    });

    const xs = taps.map((t) => t.x);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    wires.push({
      netId: net.id,
      kind: net.kind,
      d: `M ${round(minX)} ${rowY} L ${round(maxX)} ${rowY}`,
      midX: round((minX + maxX) / 2),
      midY: rowY,
      terminalIds: taps.map((t) => t.tid),
    });
  });

  // Bus mode lays terminals on net rows, not module edges, so no terminal is
  // ever edge-placed by guesswork here.
  return { width: BUS_W, height: BUS_H, modules, ports, wires, unmappedTerminalIds: [] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dispatcher
// ─────────────────────────────────────────────────────────────────────────────
export function buildLayout(mode: ViewMode, units: Unit[], terminals: Terminal[], nets: Net[]): TwinLayout {
  switch (mode) {
    case 'board':
      return buildBoardLayout(units, terminals, nets);
    case 'iso':
      return buildIsoLayout(units, terminals, nets);
    case 'bus':
      return buildBusLayout(units, terminals, nets);
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}
