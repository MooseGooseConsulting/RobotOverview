/** Connection lifecycle for the server-side rosbridge client. */
export type BeastConnectionState =
  | 'unconfigured'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

/** Snapshot the agent tools (and UI honesty rail) can read. */
export type BeastRobotStatus = {
  connection: BeastConnectionState;
  bridgeUrl: string | null;
  allowMotion: boolean | null;
  voltage: number | null;
  scanAlive: boolean | null;
  /** Human-readable reason motion is gated, when known. */
  lockReason: string | null;
  /** Epoch ms of the last topic update that refreshed this snapshot. */
  updatedAt: number | null;
};

export type MotionToolStatus =
  | 'refused'
  | 'dispatched'
  | 'done'
  | 'canceled'
  | 'failed'
  | 'timed_out'
  | 'bridge_unavailable';

export type MotionToolResult = {
  ok: boolean;
  status: MotionToolStatus;
  message: string;
  feedback?: Record<string, unknown>;
};

export type DriveOnHeadingInput = {
  meters: number;
  speed?: number;
};

export type SpinInput = {
  degrees: number;
};

export type BackUpInput = {
  meters: number;
  speed?: number;
};

export type NavigateToPoseInput = {
  x: number;
  y: number;
  yaw: number;
};

/**
 * Transport-agnostic robot face used by agent tools.
 * Production wires this to the roslib singleton; tests inject mocks.
 */
export interface BeastRobotBridge {
  getConnectionState(): BeastConnectionState;
  getStatus(): Promise<BeastRobotStatus>;
  driveOnHeading(input: DriveOnHeadingInput): Promise<MotionToolResult>;
  spin(input: SpinInput): Promise<MotionToolResult>;
  backUp(input: BackUpInput): Promise<MotionToolResult>;
  navigateToPose(input: NavigateToPoseInput): Promise<MotionToolResult>;
  stop(): Promise<MotionToolResult>;
}

/** Default Beast crawl speed ceiling from the Set 4 plan (m/s). */
export const BEAST_MAX_SPEED_MPS = 0.15;

/** Soft caps for Zod schemas — keep goals short while the path is unproven. */
export const BEAST_MAX_DRIVE_METERS = 5;
export const BEAST_MAX_BACKUP_METERS = 2;
export const BEAST_MAX_SPIN_DEGREES = 360;
