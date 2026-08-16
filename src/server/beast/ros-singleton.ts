import { resolveBeastCockpitWsUrl } from '@/lib/beast-constants';
import type {
  BackUpInput,
  BeastConnectionState,
  BeastRobotBridge,
  BeastRobotStatus,
  DriveOnHeadingInput,
  MotionToolResult,
  NavigateToPoseInput,
  SpinInput,
} from './types';
import { BEAST_MAX_SPEED_MPS } from './types';

/** Minimal surface we need from roslib — injectable for Vitest. */
export type RosHandle = {
  isConnected: boolean;
  connect(url: string): void;
  close(): void;
  on(event: string, cb: (...args: unknown[]) => void): unknown;
  off?(event: string, cb: (...args: unknown[]) => void): unknown;
};

export type TopicHandle = {
  subscribe(cb: (msg: Record<string, unknown>) => void): void;
  unsubscribe(): void;
};

export type ActionHandle = {
  sendGoal(
    goal: Record<string, unknown>,
    resultCb?: (result: Record<string, unknown>) => void,
    feedbackCb?: (feedback: Record<string, unknown>) => void,
  ): string | void;
  cancelGoal?(goalId?: string): void;
  cancelAllGoals?(): void;
};

export type RosLibLike = {
  Ros: new (opts?: { url?: string }) => RosHandle;
  Topic: new (opts: {
    ros: RosHandle;
    name: string;
    messageType: string;
  }) => TopicHandle;
  Action: new (opts: {
    ros: RosHandle;
    name: string;
    actionType: string;
  }) => ActionHandle;
};

export type BeastRosClientOptions = {
  /** Override env; null → unconfigured (no connect). Undefined → default tailnet URL. */
  url?: string | null;
  /** Injected roslib (or a mock). Defaults to dynamic import of `roslib`. */
  roslib?: RosLibLike;
  /** Reconnect delay after close/error while a URL is configured. */
  reconnectMs?: number;
  /** Scan freshness window for scanAlive. */
  scanFreshMs?: number;
  now?: () => number;
  /** Override timers for tests. */
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
};

const STATUS_TOPICS = [
  { name: '/ugv/allow_motion', messageType: 'std_msgs/msg/Bool' },
  { name: '/ugv/voltage', messageType: 'sensor_msgs/msg/BatteryState' },
  { name: '/scan', messageType: 'sensor_msgs/msg/LaserScan' },
] as const;

const ACTION_NAMES = {
  drive: '/drive_on_heading',
  spin: '/spin',
  backup: '/backup',
  navToPose: '/navigate_to_pose',
} as const;

function envBridgeUrl(): string | null {
  return resolveBeastCockpitWsUrl();
}

function durationFromSeconds(seconds: number): { sec: number; nanosec: number } {
  const sec = Math.floor(seconds);
  const nanosec = Math.round((seconds - sec) * 1e9);
  return { sec, nanosec };
}

/** Matches a bare non-finite literal at an exact offset. Sticky, not global. */
const NON_FINITE_TOKEN = /-?(?:NaN|Infinity)/y;

/** Rewrite bare `NaN` / `Infinity` to `null`, but ONLY outside string literals. */
function repairNonFiniteTokens(raw: string): string {
  let out = '';
  let i = 0;
  let inString = false;
  while (i < raw.length) {
    const ch = raw[i];
    if (inString) {
      out += ch;
      if (ch === '\\') {
        i += 1;
        if (i < raw.length) out += raw[i];
      } else if (ch === '"') {
        inString = false;
      }
    } else {
      if (ch === '"') {
        inString = true;
        out += ch;
      } else if (ch === 'N' || ch === 'I' || ch === '-') {
        NON_FINITE_TOKEN.lastIndex = i;
        const match = NON_FINITE_TOKEN.exec(raw);
        if (match) {
          out += 'null';
          i += match[0].length;
          continue;
        }
        out += ch;
      } else {
        out += ch;
      }
    }
    i++;
  }
  return out;
}

/**
 * Server-side rosbridge singleton. Connects only when a URL is configured;
 * reconnects after drop; exposes BeastRobotBridge for agent tools.
 */
export class BeastRosClient implements BeastRobotBridge {
  private readonly url: string | null;
  private readonly reconnectMs: number;
  private readonly scanFreshMs: number;
  private readonly now: () => number;
  private readonly setTimeoutFn: typeof setTimeout;
  private readonly clearTimeoutFn: typeof clearTimeout;
  private readonly injectedRoslib: RosLibLike | undefined;

  private roslib: RosLibLike | null = null;
  private ros: RosHandle | null = null;
  private topics: TopicHandle[] = [];
  private actions: Partial<Record<'drive' | 'spin' | 'backup' | 'navToPose', ActionHandle>> = {};
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;
  private disposed = false;
  private state: BeastConnectionState;
  private lastError: string | null = null;

  private allowMotion: boolean | null = null;
  private voltage: number | null = null;
  private lastScanAt: number | null = null;
  private updatedAt: number | null = null;
  private onConnection = () => {
    this.state = 'connected';
    this.lastError = null;
    this.subscribeStatusTopics();
    this.ensureActions();
  };

  private onClose = () => {
    this.teardownTopics();
    if (this.intentionalClose || this.disposed || !this.url) {
      if (!this.disposed && this.url && !this.intentionalClose) {
        this.state = 'disconnected';
      }
      return;
    }
    this.state = 'disconnected';
    this.scheduleReconnect();
  };

  private onError = (err: unknown) => {
    this.state = 'error';
    this.lastError = err instanceof Error ? err.message : String(err ?? 'rosbridge error');
  };

  constructor(options: BeastRosClientOptions = {}) {
    this.url = options.url === undefined ? envBridgeUrl() : options.url ? options.url : null;
    this.reconnectMs = options.reconnectMs ?? 2000;
    this.scanFreshMs = options.scanFreshMs ?? 2000;
    this.now = options.now ?? Date.now;
    this.setTimeoutFn = options.setTimeoutFn ?? setTimeout;
    this.clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout;
    this.injectedRoslib = options.roslib;
    this.state = this.url ? 'disconnected' : 'unconfigured';
  }

  getConnectionState(): BeastConnectionState {
    return this.state;
  }

  getBridgeUrl(): string | null {
    return this.url;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  /** Start connecting when a URL is configured. Safe to call repeatedly. */
  async start(): Promise<void> {
    if (this.disposed) return;
    if (!this.url) {
      this.state = 'unconfigured';
      return;
    }
    if (this.ros?.isConnected) {
      this.state = 'connected';
      return;
    }
    await this.ensureRoslib();
    this.openSocket();
  }

  dispose(): void {
    this.disposed = true;
    this.intentionalClose = true;
    this.clearReconnect();
    this.teardownTopics();
    if (this.ros) {
      this.detachRosListeners(this.ros);
      try {
        this.ros.close();
      } catch {
        /* ignore */
      }
    }
    this.ros = null;
    this.actions = {};
    if (this.url) this.state = 'disconnected';
    else this.state = 'unconfigured';
  }

  async getStatus(): Promise<BeastRobotStatus> {
    // Lazy-start so route handlers that only call get_status still attempt connect.
    if (this.url && this.state !== 'connected' && !this.disposed) {
      await this.start();
    }

    const scanAlive =
      this.lastScanAt === null ? null : this.now() - this.lastScanAt <= this.scanFreshMs;

    let lockReason: string | null = null;
    if (this.state === 'unconfigured') {
      lockReason = 'BEAST_COCKPIT_WS_URL unset — server rosbridge client idle';
    } else if (this.state !== 'connected') {
      lockReason = `bridge ${this.state}${this.lastError ? `: ${this.lastError}` : ''}`;
    } else if (this.allowMotion === false && !lockReason) {
      lockReason = 'allow_motion is false';
    } else if (this.allowMotion === null && !lockReason) {
      lockReason = 'allow_motion unknown (topic not received)';
    } else if (this.allowMotion === true) {
      lockReason = null;
    }

    return {
      connection: this.state,
      bridgeUrl: this.url,
      allowMotion: this.allowMotion,
      voltage: this.voltage,
      scanAlive,
      lockReason,
      updatedAt: this.updatedAt,
    };
  }

  async driveOnHeading(input: DriveOnHeadingInput): Promise<MotionToolResult> {
    return this.runAction('drive', {
      target: { x: input.meters, y: 0, z: 0 },
      speed: input.speed ?? BEAST_MAX_SPEED_MPS,
      time_allowance: durationFromSeconds(Math.max(10, input.meters / 0.05 + 5)),
    });
  }

  async spin(input: SpinInput): Promise<MotionToolResult> {
    const yaw = (input.degrees * Math.PI) / 180;
    return this.runAction('spin', {
      target_yaw: yaw,
      time_allowance: durationFromSeconds(Math.max(10, Math.abs(input.degrees) / 15 + 5)),
    });
  }

  async backUp(input: BackUpInput): Promise<MotionToolResult> {
    return this.runAction('backup', {
      target: input.meters,
      speed: input.speed ?? BEAST_MAX_SPEED_MPS,
      time_allowance: durationFromSeconds(Math.max(10, input.meters / 0.05 + 5)),
    });
  }

  async navigateToPose(input: NavigateToPoseInput): Promise<MotionToolResult> {
    return this.runAction('navToPose', {
      pose: {
        header: { frame_id: 'map' },
        pose: {
          position: { x: input.x, y: input.y, z: 0.0 },
          orientation: {
            x: 0,
            y: 0,
            z: Math.sin(input.yaw / 2),
            w: Math.cos(input.yaw / 2),
          },
        },
      }
    });
  }

  async stop(): Promise<MotionToolResult> {
    if (!this.url) {
      return {
        ok: false,
        status: 'bridge_unavailable',
        message: 'No bridge configured — nothing to cancel.',
      };
    }
    if (this.state !== 'connected' || !this.ros?.isConnected) {
      return {
        ok: false,
        status: 'bridge_unavailable',
        message: `Bridge ${this.state} — cancel not sent.`,
      };
    }
    this.ensureActions();
    for (const action of Object.values(this.actions)) {
      try {
        action?.cancelAllGoals?.();
      } catch {
        /* ignore per-action cancel failures */
      }
    }
    return {
      ok: true,
      status: 'canceled',
      message: 'Cancel requested on drive_on_heading / spin / backup action servers.',
    };
  }

  /** Test helper: inject a status topic message as if rosbridge published it. */
  __ingestTopicForTests(topic: string, msg: Record<string, unknown>): void {
    this.handleTopic(topic, msg);
  }

  private async ensureRoslib(): Promise<RosLibLike> {
    if (this.roslib) return this.roslib;

    // Prevent NaN scan defect from crashing roslib handlers upstream
    type PatchedJsonParse = typeof JSON.parse & { _nanPatched?: boolean };
    const jsonParse = JSON.parse as PatchedJsonParse;
    if (!jsonParse._nanPatched) {
      const origParse = JSON.parse;
      JSON.parse = function (text: string, reviver?: Parameters<typeof origParse>[1]) {
        try {
          return origParse(text, reviver);
        } catch (err) {
          if (typeof text === 'string' && (text.includes('NaN') || text.includes('Infinity'))) {
            return origParse(repairNonFiniteTokens(text), reviver);
          }
          throw err;
        }
      };
      (JSON.parse as PatchedJsonParse)._nanPatched = true;
    }

    if (this.injectedRoslib) {
      this.roslib = this.injectedRoslib;
      return this.roslib;
    }
    const mod = (await import('roslib')) as unknown as RosLibLike;
    this.roslib = mod;
    return mod;
  }

  private openSocket(): void {
    if (!this.url || !this.roslib || this.disposed) return;
    this.clearReconnect();
    this.intentionalClose = false;

    if (this.ros) {
      this.detachRosListeners(this.ros);
      try {
        this.ros.close();
      } catch {
        /* ignore */
      }
      this.ros = null;
    }

    this.state = 'connecting';
    const ros = new this.roslib.Ros();
    this.ros = ros;
    ros.on('connection', this.onConnection);
    ros.on('close', this.onClose);
    ros.on('error', this.onError);
    try {
      ros.connect(this.url);
    } catch (err) {
      this.onError(err);
      this.scheduleReconnect();
    }
  }

  private detachRosListeners(ros: RosHandle): void {
    ros.off?.('connection', this.onConnection);
    ros.off?.('close', this.onClose);
    ros.off?.('error', this.onError);
  }

  private scheduleReconnect(): void {
    if (this.disposed || !this.url || this.intentionalClose) return;
    this.clearReconnect();
    this.reconnectTimer = this.setTimeoutFn(() => {
      this.reconnectTimer = null;
      if (this.disposed || !this.url) return;
      void this.ensureRoslib().then(() => this.openSocket());
    }, this.reconnectMs) as ReturnType<typeof setTimeout>;
  }

  private clearReconnect(): void {
    if (this.reconnectTimer !== null) {
      this.clearTimeoutFn(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private subscribeStatusTopics(): void {
    if (!this.ros || !this.roslib) return;
    this.teardownTopics();
    for (const spec of STATUS_TOPICS) {
      const topic = new this.roslib.Topic({
        ros: this.ros,
        name: spec.name,
        messageType: spec.messageType,
      });
      topic.subscribe((msg) => this.handleTopic(spec.name, msg));
      this.topics.push(topic);
    }
  }

  private teardownTopics(): void {
    for (const t of this.topics) {
      try {
        t.unsubscribe();
      } catch {
        /* ignore */
      }
    }
    this.topics = [];
  }

  private ensureActions(): void {
    if (!this.ros || !this.roslib) return;
    if (!this.actions.drive) {
      this.actions.drive = new this.roslib.Action({
        ros: this.ros,
        name: ACTION_NAMES.drive,
        actionType: 'nav2_msgs/action/DriveOnHeading',
      });
    }
    if (!this.actions.spin) {
      this.actions.spin = new this.roslib.Action({
        ros: this.ros,
        name: ACTION_NAMES.spin,
        actionType: 'nav2_msgs/action/Spin',
      });
    }
    if (!this.actions.backup) {
      this.actions.backup = new this.roslib.Action({
        ros: this.ros,
        name: ACTION_NAMES.backup,
        actionType: 'nav2_msgs/action/BackUp',
      });
    }
    if (!this.actions.navToPose) {
      this.actions.navToPose = new this.roslib.Action({
        ros: this.ros,
        name: ACTION_NAMES.navToPose,
        actionType: 'nav2_msgs/action/NavigateToPose',
      });
    }
  }

  private handleTopic(name: string, msg: Record<string, unknown>): void {
    this.updatedAt = this.now();
    switch (name) {
      case '/ugv/allow_motion': {
        this.allowMotion = typeof msg.data === 'boolean' ? msg.data : null;
        break;
      }
      case '/ugv/voltage': {
        const v = msg.voltage;
        this.voltage = typeof v === 'number' && Number.isFinite(v) ? v : null;
        break;
      }
      case '/scan': {
        // Prevent NaN scan defect from crashing roslib handlers upstream or causing logic errors here
        this.lastScanAt = this.now();
        break;
      }
      default:
        break;
    }
  }

  private async runAction(
    which: 'drive' | 'spin' | 'backup' | 'navToPose',
    goal: Record<string, unknown>,
  ): Promise<MotionToolResult> {
    if (!this.url) {
      return {
        ok: false,
        status: 'bridge_unavailable',
        message: 'BEAST_COCKPIT_WS_URL unset — action not sent.',
      };
    }
    if (this.state !== 'connected' || !this.ros?.isConnected) {
      return {
        ok: false,
        status: 'bridge_unavailable',
        message: `Bridge ${this.state} — action not sent.`,
      };
    }

    this.ensureActions();
    const action = this.actions[which];
    if (!action) {
      return {
        ok: false,
        status: 'failed',
        message: `Action client ${which} not available.`,
      };
    }

    try {
      // Wave 1 skeleton: fire-and-ack. Waiting on result / streaming feedback
      // to the chat UI is Wave 3 live smoke once behavior_server is on-robot.
      action.sendGoal(goal);
      return {
        ok: true,
        status: 'dispatched',
        message: `${which} goal sent to nav2 behavior_server (result wait deferred to Wave 3)`,
      };
    } catch (err) {
      return {
        ok: false,
        status: 'failed',
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

let singleton: BeastRosClient | null = null;

/** Process-wide server rosbridge client. Lazy; reconnects when URL is set. */
export function getBeastRosClient(options?: BeastRosClientOptions): BeastRosClient {
  if (!singleton) {
    singleton = new BeastRosClient(options);
  }
  return singleton;
}

/** Vitest helper — tear down and forget the singleton. */
export function resetBeastRosClientForTests(): void {
  singleton?.dispose();
  singleton = null;
}

/** Create a fresh client that also becomes the singleton (tests). */
export function createBeastRosClient(options?: BeastRosClientOptions): BeastRosClient {
  resetBeastRosClientForTests();
  singleton = new BeastRosClient(options);
  return singleton;
}
