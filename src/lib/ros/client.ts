'use client';

import { useSyncExternalStore } from 'react';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

// ── ROBOT-SIDE MESSAGE-TYPE CONTRACT ────────────────────────────────────────
// Verified against Coldaine/ugv_ws@fc1c29e. These strings are not cosmetic: DDS
// matches publisher and subscriber by type, so a wrong type here means the
// robot's subscriber never matches and the control is silently DEAD — no error,
// no motion, nothing. `src/__tests__/ros-client.test.ts` pins every one of them.
//
//   /ugv/led_ctrl            Float32MultiArray  (was Int32MultiArray → headlights dead)
//   /ugv/pt_steady_ctrl      Float32MultiArray  (was Float64MultiArray → steady dead)
//   /pt_joint_position_controller/commands
//                            Float64MultiArray  (ros2_control — CORRECT as-is.
//                            Do NOT "harmonize" this with pt_steady_ctrl; they
//                            are different robot-side subscribers.)
//   /imu/raw                 sensor_msgs/msg/Imu (nothing publishes /imu/data)
export const ROS_SUBSCRIPTIONS = [
  { topic: '/ugv/voltage', type: 'sensor_msgs/msg/BatteryState' },
  { topic: '/scan', type: 'sensor_msgs/msg/LaserScan' },
  { topic: '/odom', type: 'nav_msgs/msg/Odometry' },
  // ugv_bringup publishes /imu/raw. /imu/data has no publisher on this robot.
  { topic: '/imu/raw', type: 'sensor_msgs/msg/Imu' },
  { topic: '/cockpit/overhead_clearance', type: 'std_msgs/msg/Float32' },
  { topic: '/cockpit/status', type: 'diagnostic_msgs/msg/DiagnosticArray' },
  { topic: '/diagnostics', type: 'diagnostic_msgs/msg/DiagnosticArray' },
  // Dedicated safety topics, latched robot-side. `/ugv/allow_motion` is the
  // rendered motion authority (see SET_ALLOW_MOTION_SERVICE below); a field it
  // feeds must render UNKNOWN when silent, never a cleared/false default.
  { topic: '/ugv/allow_motion', type: 'std_msgs/msg/Bool' },
  { topic: '/oak/rgb/image_raw/compressed', type: 'sensor_msgs/msg/CompressedImage' },
  { topic: '/cockpit/depth/compressed', type: 'sensor_msgs/msg/CompressedImage' },
] as const;

export const ROS_PUBLICATIONS = [
  { topic: '/cmd_vel_ui', type: 'geometry_msgs/msg/Twist' },
  { topic: '/ugv/led_ctrl', type: 'std_msgs/msg/Float32MultiArray' },
  { topic: '/pt_joint_position_controller/commands', type: 'std_msgs/msg/Float64MultiArray' },
  { topic: '/ugv/pt_steady_ctrl', type: 'std_msgs/msg/Float32MultiArray' },
] as const;

export const IMAGE_TOPICS = [
  '/oak/rgb/image_raw/compressed',
  '/cockpit/depth/compressed',
] as const;

// ── LiDAR BLIND-SECTOR CROP ─────────────────────────────────────────────────
// The single source of truth for scan orientation and the blind sector. The
// scan parser rotates every point by LIDAR_SCAN_TO_BODY_YAW_DEG and drops the
// LIDAR_CROP_SECTOR_DEG range; SpatialView draws its wedge from the SAME
// constants through the SAME ROS→canvas mapping the points use, so the picture
// cannot drift from the deletion.
// Scan→body yaw: the LD19 publishes in base_lidar_link, whose URDF joint is
// rpy 0 0 +90° (ugv_description/urdf/bases/ugv_beast.xacro), so scan bearing θ
// lands at BODY bearing θ + 90° (REP-103: 0° forward, +90° left). Verified
// live 2026-08-10: robot square-on to a wall measured at 39 in / 0.99 m from
// the LiDAR read 1.00–1.02 m across scan 255–285° — scan 270° = body forward.
// The parser rotates every point by this constant before use.
export const LIDAR_SCAN_TO_BODY_YAW_DEG = 90 as const;

// Blind sector in BODY frame. The driver crops scan 38°–142°
// (/etc/beast/ugv.env crop 218–322; the published masked band is mirrored:
// [360−max, 360−min]) — rear mast occlusion plus margin. +90° ⇒ body 128–232.
export const LIDAR_CROP_SECTOR_DEG = { startDeg: 128, endDeg: 232 } as const;

/**
 * Map a ROS scan bearing (rad, +x forward / +y left) to the top-down canvas the
 * cockpit draws, where forward is up. Returns canvas pixel offsets from centre
 * per unit range — exactly the transform SpatialView applies to scan points, so
 * anything drawn through it lands where the matching points would.
 */
export function rosBearingToCanvasOffset(angleRad: number): { dx: number; dy: number } {
  // x = r·cos(θ) forward, y = r·sin(θ) left; canvas px = Cx − y, py = Cy − x.
  return { dx: -Math.sin(angleRad), dy: -Math.cos(angleRad) };
}

export interface InboundMsg {
  data?: string | number | boolean | number[];
  format?: string;
  voltage?: number;
  current?: number;
  power_supply_status?: number;
  present?: boolean;
  header?: { stamp?: { sec?: number; nanosec?: number } };
  pose?: {
    pose?: {
      position?: { x?: number; y?: number };
      orientation?: { z?: number; w?: number };
    };
  };
  twist?: {
    twist?: {
      linear?: { x?: number };
      angular?: { z?: number };
    };
  };
  linear_acceleration?: { x?: number; y?: number; z?: number };
  angular_velocity?: { x?: number; y?: number; z?: number };
  // DiagnosticArray carries `status[]`; a bare DiagnosticStatus carries these
  // at the top level.
  status?: Array<{
    name?: string;
    message?: string;
    level?: number;
    hardware_id?: string;
    values?: Array<{ key: string; value: string }>;
  }>;
  name?: string;
  message?: string;
  level?: number;
  values?: Array<{ key: string; value: string }>;
  ranges?: number[];
  angle_min?: number;
  angle_max?: number;
  angle_increment?: number;
  range_min?: number;
  range_max?: number;
}

// ── STALENESS ───────────────────────────────────────────────────────────────
// Every slice carries when it last heard from the robot. A cockpit that keeps
// rendering the last good number in confident live styling after the feed dies
// is worse than one that renders nothing, so:
//   * `hasReceived` is false until the first message OF THIS CONNECTION lands —
//     a field whose topic has no publisher renders "UNKNOWN — no publisher",
//     never a default.
//   * `stale` flips when nothing has arrived inside the slice's budget, and is
//     forced true for EVERY slice the instant the socket closes.
export interface SliceMeta {
  /** Epoch ms of the most recent message for this slice, null if none. */
  receivedAt: number | null;
  /** Has this slice received anything since the current connection opened? */
  hasReceived: boolean;
  /** Nothing has arrived inside the freshness budget (or the socket is down). */
  stale: boolean;
}

const FRESHNESS_MS = {
  voltage: 2000,
  odom: 1000,
  imu: 1000,
  clearance: 2000,
  status: 2000,
  diagnostics: 2000,
  scan: 2000,
} as const;

type SliceKey = keyof typeof FRESHNESS_MS;

const STALENESS_TICK_MS = 250;

export interface CockpitVoltage extends SliceMeta {
  /** Pack volts, or null when the robot has not reported a usable number. */
  voltage: number | null;
  /**
   * Signed pack amps (positive = charging), or null. Carried only when the
   * publisher fills power_supply_status — bringup's legacy dummy current
   * arrives as 0.0 with status UNKNOWN and is nulled at ingest so it can never
   * render as a real 0.0 A draw. (SOC stays deliberately un-carried: no honest
   * percentage exists yet — see beast_power/soc.py.)
   */
  current: number | null;
  /** sensor_msgs/BatteryState power_supply_status (1=CHARGING … 4=FULL), null if unreported/UNKNOWN-0. */
  powerSupplyStatus: number | null;
  /** BatteryState.present — false is the publisher's own absent-sensor report. */
  present: boolean | null;
}

export interface CockpitOdom extends SliceMeta {
  x: number | null;
  y: number | null;
  yaw: number | null;
  linearSpeed: number | null;
  angularSpeed: number | null;
}

export interface CockpitImu extends SliceMeta {
  ax: number | null;
  ay: number | null;
  az: number | null;
  gx: number | null;
  gy: number | null;
  gz: number | null;
}

export interface CockpitClearance extends SliceMeta {
  meters: number | null;
}

/**
 * Every field is `null` until the robot actually reports it. `null` means
 * UNKNOWN and must render as such — it is NOT "false", "clear", or "NONE".
 * The topics behind `allowMotion` / `muxSource` are not deployed
 * on the robot yet, so `null` is the expected steady state today.
 */
export interface CockpitStatus extends SliceMeta {
  muxSource: string | null;
  /** Seconds since the last /cmd_vel. The robot sends -1 for "unknown". */
  cmdAge: number | null;
  pubCount: number | null;
  allowMotion: boolean | null;
  wifiRssi: number | null;
  diskFree: string | null;
  cpuTemp: number | null;
  gpuTemp: number | null;
  /** Physical tether / charging motion lock status */
  isCharging: boolean | null;
  isEthernetConnected: boolean | null;
}

export interface CockpitScanPoint {
  range: number;
  angle: number;
  x: number;
  y: number;
}

export interface CockpitScan extends SliceMeta {
  points: CockpitScanPoint[];
  angleMin: number;
  angleMax: number;
  angleIncrement: number;
  rangeMin: number;
  rangeMax: number;
  /** Mean interval between the last few scans, ms — null until measurable. */
  intervalMs: number | null;
}

export interface DiagnosticsItem {
  name: string;
  message: string;
  level: number;
  hardware_id?: string;
  values: Record<string, string>;
  /** Message header stamp in epoch ms — NOT the time we happened to render. */
  stampMs: number | null;
}

export interface CockpitDiagnostics extends SliceMeta {
  items: DiagnosticsItem[];
}

/** A rosbridge `op:"status"` frame — the bridge refusing or complaining. */
export interface BridgeFault {
  /** The op id we attached, e.g. `adv:/ugv/led_ctrl`. null if unattributable. */
  id: string | null;
  level: 'error' | 'warning';
  msg: string;
  at: number;
  /** Topic parsed out of `id`, when the fault is attributable to one. */
  topic: string | null;
}

export interface CockpitBridge {
  faults: BridgeFault[];
  /** Topics the bridge has thrown an ERROR about — treat their controls as dead. */
  deadTopics: string[];
}

const MAX_BRIDGE_FAULTS = 12;

// Parse a numeric field defensively — live diagnostics can carry "unknown",
// empty, or garbage strings that must never render as NaN. Returns null (not a
// fallback number) so callers render UNKNOWN instead of a plausible lie.
function safeNumber(value: string | undefined): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * A number, or null when the field is absent/unusable. `null` must NOT coerce:
 * `Number(null)` is 0, which is how a repaired NaN would silently render as a
 * real reading of zero.
 */
function finite(value: unknown): number | null {
  if (typeof value !== 'number') return null;
  return Number.isFinite(value) ? value : null;
}

function safeBool(value: string | undefined): boolean | null {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function stampToMs(header: InboundMsg['header']): number | null {
  const sec = header?.stamp?.sec;
  const nanosec = header?.stamp?.nanosec;
  if (typeof sec !== 'number' || !Number.isFinite(sec)) return null;
  const ns = typeof nanosec === 'number' && Number.isFinite(nanosec) ? nanosec : 0;
  return sec * 1000 + ns / 1e6;
}

// ── SLICE STORAGE ───────────────────────────────────────────────────────────
// Payload and freshness metadata are kept apart so a staleness tick can rebuild
// a slice without re-deriving its data, and so `useSyncExternalStore` snapshots
// stay referentially stable when nothing changed.
function blankMeta(): SliceMeta {
  return { receivedAt: null, hasReceived: false, stale: false };
}

const meta: Record<SliceKey, SliceMeta> = {
  voltage: blankMeta(),
  odom: blankMeta(),
  imu: blankMeta(),
  clearance: blankMeta(),
  status: blankMeta(),
  diagnostics: blankMeta(),
  scan: blankMeta(),
};

type VoltageData = Omit<CockpitVoltage, keyof SliceMeta>;
type OdomData = Omit<CockpitOdom, keyof SliceMeta>;
type ImuData = Omit<CockpitImu, keyof SliceMeta>;
type ClearanceData = { meters: number | null };
type StatusData = Omit<CockpitStatus, keyof SliceMeta>;
type ScanData = Omit<CockpitScan, keyof SliceMeta>;
type DiagnosticsData = { items: DiagnosticsItem[] };

function blankStatus(): StatusData {
  return {
    muxSource: null,
    cmdAge: null,
    pubCount: null,
    allowMotion: null,
    wifiRssi: null,
    diskFree: null,
    cpuTemp: null,
    gpuTemp: null,
    isCharging: null,
    isEthernetConnected: null,
  };
}

function blankScan(): ScanData {
  return {
    points: [],
    angleMin: 0,
    angleMax: 0,
    angleIncrement: 0,
    rangeMin: 0,
    rangeMax: 0,
    intervalMs: null,
  };
}

function blankVoltage(): VoltageData {
  return { voltage: null, current: null, powerSupplyStatus: null, present: null };
}

let voltageData: VoltageData = blankVoltage();
let odomData: OdomData = { x: null, y: null, yaw: null, linearSpeed: null, angularSpeed: null };
let imuData: ImuData = { ax: null, ay: null, az: null, gx: null, gy: null, gz: null };
let clearanceData: ClearanceData = { meters: null };
let statusData: StatusData = blankStatus();

// ── DIRECT TOPIC vs AGGREGATOR PROVENANCE ───────────────────────────────────
// `/cockpit/status` is a 1 Hz roll-up that also reports allow_motion. When the
// robot has nothing real to put there it emits placeholders, and those would
// overwrite the dedicated `/ugv/allow_motion` topic we subscribe to precisely
// so we do not depend on the roll-up — the aggregator would defeat its own
// hedge, once a second.
//
// So the dedicated topic wins while it is fresh, and the aggregator fills in
// only where the dedicated topic has never published or has gone stale.
const DIRECT_TOPIC_AUTHORITY_MS = 2000;
let allowMotionDirectAt: number | null = null;

function directStillAuthoritative(at: number | null): boolean {
  return at !== null && Date.now() - at <= DIRECT_TOPIC_AUTHORITY_MS;
}
let scanData: ScanData = blankScan();
let diagnosticsData: DiagnosticsData = { items: [] };

let connectionState: ConnectionState = 'disconnected';
let voltageState: CockpitVoltage = { ...voltageData, ...meta.voltage };
let odomState: CockpitOdom = { ...odomData, ...meta.odom };
let imuState: CockpitImu = { ...imuData, ...meta.imu };
let clearanceState: CockpitClearance = { ...clearanceData, ...meta.clearance };
let statusState: CockpitStatus = { ...statusData, ...meta.status };
let scanState: CockpitScan = { ...scanData, ...meta.scan };
let diagnosticsState: CockpitDiagnostics = { ...diagnosticsData, ...meta.diagnostics };
let bridgeState: CockpitBridge = { faults: [], deadTopics: [] };

// Listeners per category
const listeners = {
  connection: new Set<() => void>(),
  voltage: new Set<() => void>(),
  odom: new Set<() => void>(),
  imu: new Set<() => void>(),
  clearance: new Set<() => void>(),
  status: new Set<() => void>(),
  diagnostics: new Set<() => void>(),
  scan: new Set<() => void>(),
  bridge: new Set<() => void>(),
};

function notify(category: keyof typeof listeners) {
  for (const l of listeners[category]) {
    l();
  }
}

const rebuild: Record<SliceKey, () => void> = {
  voltage: () => {
    voltageState = { ...voltageData, ...meta.voltage };
    notify('voltage');
  },
  odom: () => {
    odomState = { ...odomData, ...meta.odom };
    notify('odom');
  },
  imu: () => {
    imuState = { ...imuData, ...meta.imu };
    notify('imu');
  },
  clearance: () => {
    clearanceState = { ...clearanceData, ...meta.clearance };
    notify('clearance');
  },
  status: () => {
    statusState = { ...statusData, ...meta.status };
    notify('status');
  },
  diagnostics: () => {
    diagnosticsState = { ...diagnosticsData, ...meta.diagnostics };
    notify('diagnostics');
  },
  scan: () => {
    scanState = { ...scanData, ...meta.scan };
    notify('scan');
  },
};

/** Stamp a slice as freshly received and republish its snapshot. */
function commit(key: SliceKey) {
  meta[key] = { receivedAt: Date.now(), hasReceived: true, stale: false };
  rebuild[key]();
}

/** Recompute `stale` for every slice; rebuild only the ones that changed. */
function tickStaleness() {
  const now = Date.now();
  (Object.keys(meta) as SliceKey[]).forEach((key) => {
    const m = meta[key];
    const stale = m.receivedAt === null ? m.stale : now - m.receivedAt > FRESHNESS_MS[key];
    if (stale !== m.stale) {
      meta[key] = { ...m, stale };
      rebuild[key]();
    }
  });
}

/**
 * The socket is gone: nothing on screen is live any more. Mark everything stale
 * at once rather than letting each slice age out on its own budget.
 */
function markAllStale() {
  (Object.keys(meta) as SliceKey[]).forEach((key) => {
    if (!meta[key].stale) {
      meta[key] = { ...meta[key], stale: true };
      rebuild[key]();
    }
  });
}

/** A new connection: "has this topic ever published?" restarts from zero. */
function resetSlicesForNewConnection() {
  voltageData = blankVoltage();
  odomData = { x: null, y: null, yaw: null, linearSpeed: null, angularSpeed: null };
  imuData = { ax: null, ay: null, az: null, gx: null, gy: null, gz: null };
  clearanceData = { meters: null };
  statusData = blankStatus();
  scanData = blankScan();
  diagnosticsData = { items: [] };
  scanArrivals = [];
  allowMotionDirectAt = null;
  (Object.keys(meta) as SliceKey[]).forEach((key) => {
    meta[key] = blankMeta();
    rebuild[key]();
  });
  bridgeState = { faults: [], deadTopics: [] };
  notify('bridge');
}

// Ref for reactive-image-rendering callbacks that bypass React state
type ImageFrame = { src: string; latencyMs: number | null };
const imageCallbacks = new Map<string, (frame: ImageFrame) => void>();
const imageObjectUrls = new Map<string, string>();

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let stalenessTimer: ReturnType<typeof setInterval> | null = null;
let reconnectDelay = 1000;
const MAX_RECONNECT_DELAY = 10000;
let lastWsUrl = '';
let scanArrivals: number[] = [];

// ── MOTION AUTHORITY: /ugv/set_allow_motion ─────────────────────────────────
// The cockpit never publishes a mux lock. Motion authority is the latched
// `allow_motion` flag inside ugv_bringup, flipped through the
// `std_srvs/SetBool` service below. That flag gates the serial write to the
// ESP32 below the mux, so it covers every command source (UI, pads, nav), and
// it survives twist_mux restarts because it does not live in the mux at all.
// The UI renders ARMED/DISARMED from the latched `/ugv/allow_motion` topic —
// never from what it last asked for.
export const SET_ALLOW_MOTION_SERVICE = '/ugv/set_allow_motion';

export interface ServiceResult {
  /** True only when the bridge delivered the call AND the service answered success. */
  ok: boolean;
  /** Service's own message (SetBool.message) or a local failure reason. */
  message: string | null;
}

const SERVICE_CALL_TIMEOUT_MS = 3000;

interface PendingServiceCall {
  resolve: (result: ServiceResult) => void;
  timer: ReturnType<typeof setTimeout>;
}

const pendingServiceCalls = new Map<string, PendingServiceCall>();

/** Every in-flight call fails when the socket goes away — resolve, don't hang. */
function failPendingServiceCalls(reason: string) {
  pendingServiceCalls.forEach((pending) => {
    clearTimeout(pending.timer);
    pending.resolve({ ok: false, message: reason });
  });
  pendingServiceCalls.clear();
}

// ── ROSBRIDGE STATUS FRAMES ─────────────────────────────────────────────────
// rosbridge 2.0.7 answers a refused op with
//   {"op":"status","level":"error"|"warning","msg":"…","id":"<our op id>"}
// A glob-whitelisted bridge denies unlisted topics EXACTLY this way and
// otherwise silently. Without ids on our ops the message is unattributable, so
// every advertise/subscribe/publish carries one.
function opId(kind: 'sub' | 'unsub' | 'adv' | 'pub', topic: string): string {
  return `${kind}:${topic}`;
}

function topicFromOpId(id: string | null): string | null {
  if (!id) return null;
  const m = /^(?:sub|unsub|adv|pub):(.+)$/.exec(id);
  return m ? m[1] : null;
}

function recordBridgeFault(level: 'error' | 'warning', msg: string, id: string | null) {
  const topic = topicFromOpId(id);
  const fault: BridgeFault = { id, level, msg, at: Date.now(), topic };
  const faults = [fault, ...bridgeState.faults].slice(0, MAX_BRIDGE_FAULTS);
  const deadTopics = level === 'error' && topic && !bridgeState.deadTopics.includes(topic)
    ? [...bridgeState.deadTopics, topic]
    : bridgeState.deadTopics;
  bridgeState = { faults, deadTopics };
  notify('bridge');
}

/**
 * rosbridge emits floats as bare `NaN` / `Infinity` tokens, which are NOT valid
 * JSON — `JSON.parse` throws and the whole frame (a scan, a voltage) is lost
 * before any of our NaN guards can run. Retry a failed parse with those tokens
 * rewritten to `null`, which the per-field guards already handle. Only failed
 * parses take this path, so well-formed frames are untouched by the regex.
 */
function parseRosbridgeFrame(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(repairNonFiniteTokens(raw));
  }
}

/** Matches a bare non-finite literal at an exact offset. Sticky, not global. */
const NON_FINITE_TOKEN = /-?(?:NaN|Infinity)/y;

/**
 * Rewrite bare `NaN` / `Infinity` to `null`, but ONLY outside string literals.
 *
 * A plain regex corrupts payloads: `/diagnostics` carries operator-facing text,
 * and a status message like "covariance NaN, using defaults" would silently
 * become "covariance null, using defaults" — we would be editing the robot's
 * words while claiming to repair its numbers. Scanning with string-awareness
 * costs one pass and is exact, so it needs no per-topic allowlist to stay safe.
 *
 * Outside a string, a bare non-finite token is unambiguously the malformed JSON
 * we are here to fix, so no delimiter guessing is required either.
 */
function repairNonFiniteTokens(raw: string): string {
  let out = '';
  let i = 0;
  let inString = false;
  while (i < raw.length) {
    const ch = raw[i];
    if (inString) {
      out += ch;
      if (ch === '\\') {
        // Copy the escaped character verbatim so \" does not end the string.
        i += 1;
        if (i < raw.length) out += raw[i];
      } else if (ch === '"') {
        inString = false;
      }
      i += 1;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      i += 1;
      continue;
    }
    NON_FINITE_TOKEN.lastIndex = i;
    const match = NON_FINITE_TOKEN.exec(raw);
    if (match) {
      out += 'null';
      i += match[0].length;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

function decodeImageFrame(topic: string, msg: InboundMsg): ImageFrame | null {
  if (typeof msg.data !== 'string' || msg.data.length === 0) return null;
  // Whitelist the format token — it lands in an <img> source. Not an XSS sink
  // (src, not innerHTML), but keeps a malformed value from silently producing a
  // broken frame.
  const raw = (msg.format || 'jpeg').toLowerCase();
  const format = raw.includes('png') ? 'png' : 'jpeg';
  const mime = `image/${format}`;

  // Latency from the message stamp. This is robot clock vs browser clock, so it
  // is only meaningful while both track NTP — treat it as an indicator, not a
  // measurement, and never let a negative skew read as "fresh".
  const stamp = stampToMs(msg.header);
  const latencyMs = stamp === null ? null : Math.max(0, Date.now() - stamp);

  // Object URLs beat data: URLs here — a data URL re-encodes ~30 KB of base64
  // into a fresh string on every frame and pins it in the DOM attribute.
  let src: string;
  try {
    const bin = atob(msg.data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    src = URL.createObjectURL(new Blob([bytes], { type: mime }));
    // Revoke the PREVIOUS frame, not this one: the old frame is already decoded
    // and painted, and revoking the live src would blank the feed.
    const previous = imageObjectUrls.get(topic);
    if (previous) URL.revokeObjectURL(previous);
    imageObjectUrls.set(topic, src);
  } catch {
    // No Blob/createObjectURL (jsdom, locked-down runtimes) — fall back.
    src = `data:${mime};base64,${msg.data}`;
  }
  return { src, latencyMs };
}

function releaseImageUrls() {
  imageObjectUrls.forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* nothing holds it; ignore */
    }
  });
  imageObjectUrls.clear();
}

// SSR compatible Server Snapshots (stable references)
const serverState = {
  connection: 'disconnected' as ConnectionState,
  voltage: { voltage: null, current: null, powerSupplyStatus: null, present: null, ...blankMeta() } as CockpitVoltage,
  odom: { x: null, y: null, yaw: null, linearSpeed: null, angularSpeed: null, ...blankMeta() } as CockpitOdom,
  imu: { ax: null, ay: null, az: null, gx: null, gy: null, gz: null, ...blankMeta() } as CockpitImu,
  clearance: { meters: null, ...blankMeta() } as CockpitClearance,
  status: { ...blankStatus(), ...blankMeta() } as CockpitStatus,
  diagnostics: { items: [], ...blankMeta() } as CockpitDiagnostics,
  scan: { ...blankScan(), ...blankMeta() } as CockpitScan,
  bridge: { faults: [], deadTopics: [] } as CockpitBridge,
};

export const rosClient = {
  connect(url: string) {
    if (typeof window === 'undefined') return;
    if (socket && lastWsUrl === url) {
      if (socket.readyState === WebSocket.OPEN) {
        // The socket outlived the component (a route change with the socket
        // still open). Returning bare here is what left a remounted cockpit
        // with no subscriptions and a dead-looking screen — re-arm the wire.
        this.advertiseAndSubscribe();
        return;
      }
      if (socket.readyState === WebSocket.CONNECTING) return;
    }
    lastWsUrl = url;
    this.disconnect();
    this.initiateConnection(url);
  },

  disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    this.stopStalenessTicker();
    failPendingServiceCalls('socket disconnected');
    releaseImageUrls();
    if (socket) {
      socket.onopen = null;
      socket.onclose = null;
      socket.onerror = null;
      socket.onmessage = null;
      socket.close();
      socket = null;
    }
    if (connectionState !== 'disconnected') {
      connectionState = 'disconnected';
      markAllStale();
      notify('connection');
    }

    notify('voltage');
    notify('odom');
    notify('imu');
    notify('clearance');
    notify('status');
    notify('diagnostics');
    notify('scan');
  },

  startStalenessTicker() {
    if (stalenessTimer) return;
    stalenessTimer = setInterval(tickStaleness, STALENESS_TICK_MS);
  },

  stopStalenessTicker() {
    if (stalenessTimer) {
      clearInterval(stalenessTimer);
      stalenessTimer = null;
    }
  },

  initiateConnection(url: string) {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    connectionState = 'connecting';
    notify('connection');

    try {
      socket = new WebSocket(url);
    } catch (e) {
      console.error('WebSocket connection failed:', e);
      this.handleScheduleReconnect(url);
      return;
    }

    socket.onopen = () => {
      connectionState = 'connected';
      reconnectDelay = 1000;
      resetSlicesForNewConnection();
      notify('connection');
      this.advertiseAndSubscribe();
      this.startStalenessTicker();
    };

    socket.onclose = () => {
      connectionState = 'disconnected';
      this.stopStalenessTicker();
      failPendingServiceCalls('socket closed');
      markAllStale();
      notify('connection');
      this.handleScheduleReconnect(url);
    };

    socket.onerror = () => {
      connectionState = 'disconnected';
      this.stopStalenessTicker();
      failPendingServiceCalls('socket error');
      markAllStale();
      notify('connection');
    };

    socket.onmessage = (event) => {
      try {
        const data = parseRosbridgeFrame(event.data) as {
          op?: string;
          topic?: string;
          msg?: InboundMsg;
          level?: string;
          id?: string;
          result?: boolean;
          values?: { success?: boolean; message?: string };
        };
        if (data.op === 'publish' && data.topic) {
          this.handleInboundPublish(data.topic, data.msg as InboundMsg);
        } else if (data.op === 'service_response' && data.id) {
          const pending = pendingServiceCalls.get(data.id);
          if (pending) {
            pendingServiceCalls.delete(data.id);
            clearTimeout(pending.timer);
            const success = data.values?.success ?? data.result === true;
            pending.resolve({ ok: success, message: data.values?.message ?? null });
          }
        } else if (data.op === 'status') {
          const level = data.level === 'error' ? 'error' : data.level === 'warning' ? 'warning' : null;
          if (level) {
            recordBridgeFault(level, String((data as { msg?: unknown }).msg ?? ''), data.id ?? null);
          }
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };
  },

  handleScheduleReconnect(url: string) {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      reconnectDelay = Math.min(reconnectDelay * 1.5, MAX_RECONNECT_DELAY);
      this.initiateConnection(url);
    }, reconnectDelay);
  },

  advertiseAndSubscribe() {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    // Ask the bridge to actually tell us about refusals. Default `level: none`
    // means a glob-whitelisted bridge denies our topics in total silence.
    socket.send(JSON.stringify({ op: 'set_level', level: 'warning' }));

    ROS_SUBSCRIPTIONS.forEach(({ topic, type }) => {
      const isImage = (IMAGE_TOPICS as readonly string[]).includes(topic);
      socket?.send(JSON.stringify({
        op: 'subscribe',
        id: opId('sub', topic),
        topic,
        type,
        throttle_rate: isImage ? 100 : 50,
        // Never buffer video: one frame deep means a slow link drops frames
        // instead of queueing a growing lag behind the robot.
        ...(isImage ? { queue_length: 1 } : {}),
      }));
    });

    ROS_PUBLICATIONS.forEach(({ topic, type }) => {
      socket?.send(JSON.stringify({
        op: 'advertise',
        id: opId('adv', topic),
        topic,
        type,
      }));
    });
  },

  publish(topic: string, msg: unknown): boolean {
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify({
      op: 'publish',
      id: opId('pub', topic),
      topic,
      msg,
    }));
    return true;
  },

  /**
   * Call a ROS service and await the bridge's `service_response`. Resolves
   * `{ok: false, message}` on a closed socket, a timeout, or a bridge-level
   * failure — it never throws and never hangs, because the caller renders a
   * motion-authority state from the answer.
   */
  callService(serviceName: string, args: unknown): Promise<ServiceResult> {
    return new Promise((resolve) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        resolve({ ok: false, message: 'socket not open' });
        return;
      }
      const callId = `call_${Math.random().toString(36).slice(2, 11)}`;
      const timer = setTimeout(() => {
        if (pendingServiceCalls.delete(callId)) {
          resolve({ ok: false, message: `no service_response within ${SERVICE_CALL_TIMEOUT_MS} ms` });
        }
      }, SERVICE_CALL_TIMEOUT_MS);
      pendingServiceCalls.set(callId, { resolve, timer });
      socket.send(JSON.stringify({
        op: 'call_service',
        service: serviceName,
        args,
        id: callId,
      }));
    });
  },

  /**
   * The cockpit's ONLY motion-authority operation. `false` disarms (one click,
   * immediate); `true` re-arms (behind the SafetyStrip hold-to-confirm). The
   * answer to "did it work" comes from the latched `/ugv/allow_motion` topic
   * echo — this Promise only answers "did the service call complete".
   */
  setMotionAllowed(allowed: boolean): Promise<ServiceResult> {
    return this.callService(SET_ALLOW_MOTION_SERVICE, { data: allowed });
  },

  registerImageCallback(topic: string, callback: (frame: ImageFrame) => void) {
    imageCallbacks.set(topic, callback);
    return () => {
      imageCallbacks.delete(topic);
      const url = imageObjectUrls.get(topic);
      if (url) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          /* ignore */
        }
        imageObjectUrls.delete(topic);
      }
    };
  },

  handleInboundPublish(topic: string, msg: InboundMsg) {
    if (!msg) return;

    if ((IMAGE_TOPICS as readonly string[]).includes(topic)) {
      const cb = imageCallbacks.get(topic);
      if (!cb) return;
      const frame = decodeImageFrame(topic, msg);
      if (frame) cb(frame);
      return; // Handled, bypass React
    }

    switch (topic) {
      case '/ugv/voltage': {
        // BatteryState, two honesty gates:
        //   * present=false is the publisher's own absent-sensor report — its
        //     voltage/current are filler zeros, never render them as readings.
        //   * current is only a measurement when the publisher fills
        //     power_supply_status (beast_power sets 1-4). Bringup's legacy
        //     dummy current arrives as 0.0 with status UNKNOWN (0) and must
        //     not surface as a real 0.0 A draw.
        const present =
          msg.present === true ? true : msg.present === false ? false : null;
        const status = finite(msg.power_supply_status);
        const measured = present !== false && status !== null && status > 0;
        voltageData = {
          voltage: present === false ? null : finite(msg.voltage),
          current: measured ? finite(msg.current) : null,
          powerSupplyStatus: status !== null && status > 0 ? status : null,
          present,
        };
        commit('voltage');
        break;
      }
      case '/odom': {
        const qz = finite(msg.pose?.pose?.orientation?.z) ?? 0;
        const qw = finite(msg.pose?.pose?.orientation?.w) ?? 1;
        odomData = {
          x: finite(msg.pose?.pose?.position?.x),
          y: finite(msg.pose?.pose?.position?.y),
          yaw: 2.0 * Math.atan2(qz, qw),
          linearSpeed: finite(msg.twist?.twist?.linear?.x),
          angularSpeed: finite(msg.twist?.twist?.angular?.z),
        };
        commit('odom');
        break;
      }
      case '/imu/raw': {
        imuData = {
          ax: finite(msg.linear_acceleration?.x),
          ay: finite(msg.linear_acceleration?.y),
          az: finite(msg.linear_acceleration?.z),
          gx: finite(msg.angular_velocity?.x),
          gy: finite(msg.angular_velocity?.y),
          gz: finite(msg.angular_velocity?.z),
        };
        commit('imu');
        break;
      }
      case '/cockpit/overhead_clearance': {
        clearanceData = { meters: finite(msg.data) };
        commit('clearance');
        break;
      }
      case '/ugv/allow_motion': {
        // A std_msgs/Bool carries a real boolean. Anything else is a malformed
        // frame, and `=== true` would silently render that as "motion locked"
        // instead of "we do not know".
        statusData = {
          ...statusData,
          allowMotion: typeof msg.data === 'boolean' ? msg.data : null,
        };
        allowMotionDirectAt = Date.now();
        commit('status');
        break;
      }
      case '/cockpit/status': {
        const next: StatusData = { ...statusData };
        const diagArray = msg.status;
        if (diagArray && Array.isArray(diagArray)) {
          diagArray.forEach((d) => {
            const values: Record<string, string> = {};
            if (d.values && Array.isArray(d.values)) {
              d.values.forEach((kv) => {
                values[kv.key] = kv.value;
              });
            }

            if (d.name === 'twist_mux') {
              // No fallback to 'NONE': absent means unknown, and "NONE" reads
              // as a positive report that nothing holds the mux.
              next.muxSource = values.active_source ?? null;
              next.cmdAge = safeNumber(values.command_age);
              const pubs = safeNumber(values.publisher_count);
              next.pubCount = pubs === null ? null : Math.max(0, pubs);
            } else if (d.name === 'bringup') {
              if (!directStillAuthoritative(allowMotionDirectAt)) {
                next.allowMotion = safeBool(values.allow_motion);
              }
            } else if (d.name === 'system_metrics' || d.name === 'power') {
              if (values.charging !== undefined) next.isCharging = safeBool(values.charging);
              if (values.ethernet !== undefined || values.ethernet_connected !== undefined) {
                next.isEthernetConnected = safeBool(values.ethernet_connected ?? values.ethernet);
              }
              next.wifiRssi = safeNumber(values.wifi_rssi);
              next.diskFree = values.disk_free || null;
              next.cpuTemp = safeNumber(values.cpu_temp);
              next.gpuTemp = safeNumber(values.gpu_temp);
            }
          });
        }
        statusData = next;
        commit('status');
        break;
      }
      case '/diagnostics': {
        const rawDiags = msg.status;
        if (rawDiags && Array.isArray(rawDiags)) {
          // One header stamp covers the whole array — that is the robot's own
          // timestamp for these entries, not the moment we drew them.
          const stampMs = stampToMs(msg.header);
          diagnosticsData = {
            items: rawDiags.map((d) => {
              const values: Record<string, string> = {};
              if (d.values && Array.isArray(d.values)) {
                d.values.forEach((kv) => {
                  values[kv.key] = kv.value;
                });
              }
              return {
                name: d.name ?? 'unknown',
                message: d.message ?? '',
                level: finite(d.level) ?? 0,
                hardware_id: d.hardware_id ?? '',
                values,
                stampMs,
              };
            }),
          };
          commit('diagnostics');
        }
        break;
      }
      case '/scan': {
        const ranges = msg.ranges;
        if (!ranges || !Array.isArray(ranges)) break;

        const angleMin = finite(msg.angle_min) ?? 0;
        const angleMax = finite(msg.angle_max) ?? 0;
        const angleIncrement = finite(msg.angle_increment) ?? 0;
        const rangeMin = finite(msg.range_min) ?? 0;
        const rangeMax = finite(msg.range_max) ?? 0;

        const points: CockpitScanPoint[] = [];
        for (let i = 0; i < ranges.length; i++) {
          const r = ranges[i];
          // `null` arrives from the NaN/Infinity repair above; Number(null) is
          // 0, so the explicit null check has to come first.
          if (r === null || r === undefined || !Number.isFinite(r) || r < rangeMin || r > rangeMax) {
            continue;
          }

          // Rotate scan bearing into the body frame — see LIDAR_SCAN_TO_BODY_YAW_DEG.
          const angle = angleMin + i * angleIncrement + (LIDAR_SCAN_TO_BODY_YAW_DEG * Math.PI) / 180;
          let normDeg = ((angle * 180.0) / Math.PI) % 360;
          if (normDeg < 0) normDeg += 360;

          if (normDeg >= LIDAR_CROP_SECTOR_DEG.startDeg && normDeg <= LIDAR_CROP_SECTOR_DEG.endDeg) {
            continue; // inside the blind sector — see LIDAR_CROP_SECTOR_DEG
          }

          points.push({ range: r, angle, x: r * Math.cos(angle), y: r * Math.sin(angle) });
        }

        // Measure the real scan rate instead of printing a nominal one.
        const now = Date.now();
        scanArrivals = [...scanArrivals, now].slice(-8);
        const intervalMs =
          scanArrivals.length >= 2
            ? (scanArrivals[scanArrivals.length - 1] - scanArrivals[0]) / (scanArrivals.length - 1)
            : null;

        scanData = { points, angleMin, angleMax, angleIncrement, rangeMin, rangeMax, intervalMs };
        commit('scan');
        break;
      }
    }
  },
};

// ── REACT BINDINGS ──────────────────────────────────────────────────────────
// Every subscribe/getSnapshot function below is defined ONCE at module scope.
//
// Passing inline arrow functions to useSyncExternalStore hands React a new
// `subscribe` identity on every render, so React tears the subscription down and
// rebuilds it every time — for every hook, in every mounted component. That is
// pure overhead on the cockpit, and it stopped being cockpit-only when the shell
// started subscribing to e-stop state on every route in the app.
//
// Stable identities mean React subscribes once and keeps it.
type Unsubscribe = () => void;

function makeSubscriber(key: keyof typeof listeners): (cb: () => void) => Unsubscribe {
  return (cb) => {
    listeners[key].add(cb);
    return () => listeners[key].delete(cb);
  };
}

const subscribeConnection = makeSubscriber('connection');
const subscribeVoltage = makeSubscriber('voltage');
const subscribeOdom = makeSubscriber('odom');
const subscribeImu = makeSubscriber('imu');
const subscribeClearance = makeSubscriber('clearance');
const subscribeStatus = makeSubscriber('status');
const subscribeDiagnostics = makeSubscriber('diagnostics');
const subscribeBridge = makeSubscriber('bridge');
const subscribeScan = makeSubscriber('scan');

const getConnection = () => connectionState;
const getVoltage = () => voltageState;
const getOdom = () => odomState;
const getImu = () => imuState;
const getClearance = () => clearanceState;
const getStatus = () => statusState;
const getDiagnostics = () => diagnosticsState;
const getBridge = () => bridgeState;
const getScan = () => scanState;

// Server snapshots are constants, so these are stable by construction.
const getServerConnection = () => serverState.connection;
const getServerVoltage = () => serverState.voltage;
const getServerOdom = () => serverState.odom;
const getServerImu = () => serverState.imu;
const getServerClearance = () => serverState.clearance;
const getServerStatus = () => serverState.status;
const getServerDiagnostics = () => serverState.diagnostics;
const getServerBridge = () => serverState.bridge;
const getServerScan = () => serverState.scan;

export function useConnectionState(): ConnectionState {
  return useSyncExternalStore(subscribeConnection, getConnection, getServerConnection);
}

export function useCockpitVoltage(): CockpitVoltage {
  return useSyncExternalStore(subscribeVoltage, getVoltage, getServerVoltage);
}

export function useCockpitOdom(): CockpitOdom {
  return useSyncExternalStore(subscribeOdom, getOdom, getServerOdom);
}

export function useCockpitImu(): CockpitImu {
  return useSyncExternalStore(subscribeImu, getImu, getServerImu);
}

export function useCockpitOverheadClearance(): CockpitClearance {
  return useSyncExternalStore(subscribeClearance, getClearance, getServerClearance);
}

export function useCockpitStatus(): CockpitStatus {
  return useSyncExternalStore(subscribeStatus, getStatus, getServerStatus);
}

export function useCockpitDiagnostics(): CockpitDiagnostics {
  return useSyncExternalStore(subscribeDiagnostics, getDiagnostics, getServerDiagnostics);
}

export function useCockpitBridge(): CockpitBridge {
  return useSyncExternalStore(subscribeBridge, getBridge, getServerBridge);
}

export function useCockpitScan(): CockpitScan {
  return useSyncExternalStore(subscribeScan, getScan, getServerScan);
}
