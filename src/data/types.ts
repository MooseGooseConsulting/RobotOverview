// ─────────────────────────────────────────────────────────────────────────────
// The Hangar — data spine types.
// Per the North Star: the data is the source of truth; the UI is a projection.
// Everything scales by adding records, not screens.
// ─────────────────────────────────────────────────────────────────────────────

export const UNIT_STATUSES = [
  'researching',
  'planned',
  'on-order',
  'inventory',
  'integrating',
  'operational',
  'needs-attention',
  'blocked',
  'retired',
] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];

export type BayId = 'robotics' | 'compute' | 'network' | 'home' | 'audio';

export const HANGAR_BAY_IDS: readonly BayId[] = [
  'robotics',
  'compute',
  'network',
  'home',
  'audio',
] as const;

export function isHangarBayId(value: unknown): value is BayId {
  return typeof value === 'string' && (HANGAR_BAY_IDS as readonly string[]).includes(value);
}

export const BAY_ACCENTS = ['cyan', 'amber'] as const;
export type BayAccent = (typeof BAY_ACCENTS)[number];

export interface Bay {
  id: BayId;
  name: string;
  code: string; // short HUD code, e.g. "RBT"
  tagline: string;
  accent: BayAccent;
}

export interface Price {
  us: number | null; // domestic distributor price (USD)
  import: number | null; // overseas import (AliExpress) landed-ish price (USD)
  currency?: string;
}

export interface SpecRow {
  label: string;
  value: string;
}

export const INVENTORY_ITEM_STATUSES = [
  'owned',
  'on-order',
  'wishlist',
  'researching',
  'deployed',
  'retired',
  'rejected',
] as const;
export type InventoryItemStatus = (typeof INVENTORY_ITEM_STATUSES)[number];

export const SOURCE_RECORD_KINDS = [
  'official',
  'certification',
  'review',
  'community',
  'research',
] as const;
export type SourceRecordKind = (typeof SOURCE_RECORD_KINDS)[number];

export interface SourceRecord {
  label: string;
  url: string;
  accessedAt: string;
  kind: SourceRecordKind;
}

export const PROVENANCE_KINDS = ['owner', 'inferred', 'open'] as const;
export type ProvenanceKind = (typeof PROVENANCE_KINDS)[number];

export interface InventoryItem {
  id: string;
  name: string;
  manufacturer?: string;
  model?: string;
  bay: BayId;
  category: string;
  status: InventoryItemStatus;
  summary: string;
  description: string;
  planningNotes?: string;
  limitations?: string[];
  specs: SpecRow[];
  price?: Price;
  quantity?: number;
  relatedUnits?: string[];
  relatedMissions?: string[];
  relatedCapabilities?: string[];
  relatedInsights?: string[];
  tags?: string[];
  sources?: SourceRecord[];
  acquired?: string;
  horizon?: string;
  provenance?: ProvenanceKind;
}

export interface LoadoutSlot {
  group?: string; // e.g. "Chassis Mounts", "Driver Board"
  slot: string; // e.g. "Lighting", "Compute", "Sensing"
  filledBy: string | null; // unit id currently slotted, or null if empty
  note?: string;
  hotspotId?: string; // Links this structural slot to a visual region on the schematic
}

export const POWER_RAILS = ['5V', '12V', 'battery', 'mains'] as const;
export type PowerRail = (typeof POWER_RAILS)[number];

export interface PowerProfile {
  watts: number | null;
  volts?: number | null;
  rail?: PowerRail | null;
}

export interface Hotspot {
  id: string;
  label: string;
  x: number; // % of viewBox 0-100
  y: number;
  // detail and status are now derived dynamically from the LoadoutSlots mapped to this hotspotId!
}

export const UNIT_SHORTCUT_TYPES = ['url', 'command'] as const;
export type UnitShortcutType = (typeof UNIT_SHORTCUT_TYPES)[number];

export type UnitShortcut =
  | {
      id: string;
      label: string;
      type: Extract<UnitShortcutType, 'url'>;
      url: string;
      note?: string;
    }
  | {
      id: string;
      label: string;
      type: Extract<UnitShortcutType, 'command'>;
      command: string;
      note?: string;
    };

export interface Unit {
  id: string;
  name: string;
  callsign?: string;
  bay: BayId;
  class: string; // e.g. "Tracked Rover", "Workstation", "Gateway"
  status: UnitStatus;
  flagship?: boolean;
  summary: string;
  specs: SpecRow[];
  price?: Price;
  power?: PowerProfile;
  massGrams?: number | null;
  loadout?: LoadoutSlot[];
  hotspots?: Hotspot[];
  capabilities?: string[]; // capability ids this unit grants/enables
  missions?: string[]; // mission ids
  insights?: string[]; // insight ids
  tags?: string[];
  shortcuts?: UnitShortcut[];
  links?: { label: string; url: string }[];
  acquired?: string; // ISO date or "—"
  horizon?: string; // for future items: when it's expected
  provenance?: ProvenanceKind;
  // External system this unit's live status may be referenced from (e.g. "Home Assistant").
  // Optional cross-link; does not by itself imply Hangar owns that system's control plane.
  monitoredVia?: string;
}

export interface MissionObjective {
  text: string;
  done: boolean;
}

export const MISSION_CONSTRAINT_UNITS = ['W', 'g', '$'] as const;
export type MissionConstraintUnit = (typeof MISSION_CONSTRAINT_UNITS)[number];

export interface ConstraintGauge {
  label: string;
  value: number;
  budget: number;
  unit: MissionConstraintUnit;
}

export const MISSION_STATUSES = ['planning', 'active', 'standby', 'complete'] as const;
export type MissionStatus = (typeof MISSION_STATUSES)[number];

export interface Mission {
  id: string;
  code: string; // "MSN-01"
  name: string;
  status: MissionStatus;
  objective: string;
  environment?: string;
  requisitionedUnits: string[]; // unit ids
  requiredLoadout: string[]; // capability ids / part descriptions
  wishlist: string[]; // wishlist item ids
  objectives: MissionObjective[];
  constraints: ConstraintGauge[];
  afterAction?: string[];
  insights?: string[];
}

export interface WishlistItem {
  id: string;
  name: string;
  category: string;
  forUnit?: string; // unit id
  forMission?: string; // mission id
  rationale: string; // why it matters
  price: Price;
  power?: PowerProfile;
  massGrams?: number | null;
  status: WishlistStatus;
  unlocks?: string; // capability id
  riskNote?: string; // import / counterfeit / warranty risk
  horizon?: string; // "next 6 months" etc.
  source?: string;
}

export const WISHLIST_STATUSES = [
  'watching',
  'researching',
  'planned',
  'buy-next',
  'on-order',
  'received',
  'rejected',
] as const;
export type WishlistStatus = (typeof WISHLIST_STATUSES)[number];

export function isWishlistStatus(value: unknown): value is WishlistStatus {
  return typeof value === 'string' && WISHLIST_STATUSES.includes(value as WishlistStatus);
}

export interface Capability {
  id: string;
  name: string;
  description: string;
  unlockedBy: string[]; // unit ids or wishlist item ids required
  dependsOn?: string[]; // capability ids
  bay?: BayId;
  unlocked: boolean;
}

export interface Insight {
  id: string;
  title: string;
  body: string;
  tags: string[];
  bay?: BayId;
  units?: string[];
  missions?: string[];
  confidence: InsightConfidence;
  source?: string;
  capturedAt: string;
}

export const INSIGHT_CONFIDENCE_LEVELS = ['high', 'medium', 'low'] as const;
export type InsightConfidence = (typeof INSIGHT_CONFIDENCE_LEVELS)[number];

export function isInsightConfidence(value: unknown): value is InsightConfidence {
  return (
    typeof value === 'string' &&
    INSIGHT_CONFIDENCE_LEVELS.includes(value as InsightConfidence)
  );
}

export function isSourceRecordKind(value: unknown): value is SourceRecordKind {
  return typeof value === 'string' && SOURCE_RECORD_KINDS.includes(value as SourceRecordKind);
}

export const ACTIVITY_KINDS = [
  'acquired',
  'price-drop',
  'shipped',
  'insight',
  'mission',
  'researched',
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export interface ActivityEvent {
  id: string;
  at: string; // ISO
  kind: ActivityKind;
  text: string;
}

// ── Connected twin: terminals + nets ─────────────────────────────────────────
// A Terminal is a physical connector/port on a unit (a driver-board socket, a
// UPS output, a Pi header). A Net joins terminals that are electrically or
// logically wired together (a power rail, a UART link, a servo daisy-chain).
// This is the data the wiring view renders; documents prove each net.

export const NET_KINDS = ['power', 'data', 'mixed', 'mechanical'] as const;
export type NetKind = (typeof NET_KINDS)[number];

export const TERMINAL_ROLES = ['input', 'output', 'bidirectional'] as const;
export type TerminalRole = (typeof TERMINAL_ROLES)[number];

export interface Terminal {
  id: string; // e.g. 'gdb-servo-bus'
  unitId: string; // unit that physically carries the connector
  name: string; // 'Serial Bus Servo Port'
  connector?: string; // 'XH2.54-2P' | 'PH2.0-6P' | '40-pin header' | 'USB-C' ...
  role?: TerminalRole;
  note?: string;
}

export const NET_GRAINS = ['module', 'connector', 'internal'] as const;
export type NetGrain = (typeof NET_GRAINS)[number];

export interface Net {
  id: string; // e.g. 'net-servo-bus'
  name: string; // 'ST3215 Serial Servo Bus'
  kind: NetKind;
  /** module = Board trunks; connector = one cable; internal = intra-board rail */
  grain: NetGrain;
  /** connector/internal → parent module net id */
  parentNet?: string;
  carries?: string; // '11.1V pack rail' | 'UART 115200 8N1' | 'I²C' ...
  terminals: string[]; // terminal ids joined by this net (≥2)
  documents?: string[]; // document ids that prove this wiring
  note?: string;
}

// ── Wiring: build variant + signal class ─────────────────────────────────────
// Shared by every wiring surface. These are facts about the robot, so they live
// here rather than beside the component that happens to draw them. The colour
// each category renders in is presentation and stays with the view (`CAT` in
// bench-data.ts).

export const BUILDS = ['pi5', 'orin'] as const;
/** Which host the robot is wired for: the original Pi 5 kit, or the Jetson target. */
export type Build = (typeof BUILDS)[number];

export const PORT_CATEGORIES = [
  'power', 'uart', 'usb', 'i2c', 'motor', 'servo',
  'sensor', 'video', 'net', 'rf', 'storage', 'audio',
] as const;
/** What a port carries or a cable conveys. */
export type PortCategory = (typeof PORT_CATEGORIES)[number];

// ── Documents: the downloaded source-of-truth library ────────────────────────
// References into the Datacore hardware library (and, later, object storage).
// The libraryPath is the stable key; url is filled once files live in storage.

export const DOCUMENT_KINDS = [
  'schematic',
  'manual',
  'cad',
  'firmware',
  'wiki',
  'datasheet',
  'image',
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export interface DocumentRef {
  id: string;
  title: string;
  kind: DocumentKind;
  libraryPath: string; // path under beast/
  url?: string; // public/object-storage URL once uploaded
  units?: string[]; // related unit ids
  note?: string;
}

export interface HangarData {
  meta: {
    title: string;
    operator: string;
    codename: string;
    updated: string;
  };
  bays: Bay[];
  items: InventoryItem[];
  units: Unit[];
  missions: Mission[];
  wishlist: WishlistItem[];
  capabilities: Capability[];
  insights: Insight[];
  activity: ActivityEvent[];
  terminals: Terminal[];
  nets: Net[];
  documents: DocumentRef[];
}
