import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  rosClient,
  useConnectionState,
  useCockpitVoltage,
  useCockpitOdom,
  useCockpitScan,
  useCockpitMap,
  useCockpitMapOdom,
  useCockpitMux,
  useCockpitBridge,
  useCockpitDiagnostics,
  ROS_SUBSCRIPTIONS,
  ROS_PUBLICATIONS,
  LIDAR_CROP_SECTOR_DEG,
  LIDAR_SCAN_TO_BODY_YAW_DEG,
  DEFERRED_WIRE_TOPICS,
  MAP_MAX_CELLS,
} from '@/lib/ros/client';
import { renderHook, act } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Mock WebSocket
class MockWebSocket {
  url: string;
  readyState: number = 0; // CONNECTING
  send = vi.fn();
  close = vi.fn();
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;

  static OPEN = 1;
  static CONNECTING = 0;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.latestInstance = this;
  }

  static latestInstance: MockWebSocket | null = null;

  triggerOpen() {
    this.readyState = 1; // OPEN
    if (this.onopen) this.onopen();
  }

  triggerClose() {
    this.readyState = 3; // CLOSED
    if (this.onclose) this.onclose();
  }

  triggerMessage(data: Record<string, unknown>) {
    this.triggerRaw(JSON.stringify(data));
  }

  /**
   * Deliver a payload EXACTLY as it came off the wire. Required for anything
   * testing malformed JSON: `triggerMessage` would serialise NaN to `null` and
   * quietly turn the assertion into a tautology.
   */
  triggerRaw(raw: string) {
    if (this.onmessage) this.onmessage({ data: raw });
  }
}

function wireOps(ws: MockWebSocket): Array<{ op: string; topic?: string; type?: string; id?: string }> {
  return ws.send.mock.calls.map((c) => JSON.parse(c[0]));
}

function openSocket(url = 'wss://beast-test-url:9090'): MockWebSocket {
  act(() => {
    rosClient.connect(url);
    MockWebSocket.latestInstance?.triggerOpen();
  });
  return MockWebSocket.latestInstance!;
}

describe('rosClient and hooks', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', MockWebSocket);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rosClient.disconnect();
    MockWebSocket.latestInstance = null;
  });

  it('manages connection state and reconnect backoff correctly', () => {
    const { result } = renderHook(() => useConnectionState());
    expect(result.current).toBe('disconnected');

    act(() => {
      rosClient.connect('wss://beast-test-url:9090');
    });

    expect(result.current).toBe('connecting');
    expect(MockWebSocket.latestInstance).toBeTruthy();

    act(() => {
      MockWebSocket.latestInstance?.triggerOpen();
    });

    expect(result.current).toBe('connected');

    const subscribeCalls = wireOps(MockWebSocket.latestInstance!).filter((c) => c.op === 'subscribe');
    expect(subscribeCalls.some((s) => s.topic === '/scan')).toBe(true);

    // Close and test reconnect
    act(() => {
      MockWebSocket.latestInstance?.triggerClose();
    });

    expect(result.current).toBe('disconnected');

    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(result.current).toBe('connecting');
  });

  it("manages topic slice snapshot identity and doesn't trigger unrelated notifications", () => {
    openSocket();

    const voltageHook = renderHook(() => useCockpitVoltage());
    const odomHook = renderHook(() => useCockpitOdom());

    const initialVoltage = voltageHook.result.current;
    const initialOdom = odomHook.result.current;

    act(() => {
      MockWebSocket.latestInstance?.triggerMessage({
        op: 'publish',
        topic: '/ugv/voltage',
        msg: { voltage: 11.5 },
      });
    });

    // Voltage hook should see new value, but odom hook MUST stay referentially stable!
    expect(voltageHook.result.current.voltage).toBe(11.5);
    expect(voltageHook.result.current.hasReceived).toBe(true);
    expect(voltageHook.result.current).not.toBe(initialVoltage);
    expect(odomHook.result.current).toBe(initialOdom); // REFERENTIALLY EQUAL
  });

  // `BatteryState.percentage` from BEAST-01 is exactly voltage / 12.6 (measured
  // 2026-09-14), i.e. the volts restated, not a charge estimate. It is dropped
  // at ingest so no panel can render it as state-of-charge; this pins the drop
  // so a future "we already have a percentage, why not show it" cannot land
  // without deleting a test.
  it('drops BatteryState.percentage instead of carrying it as a charge estimate', () => {
    openSocket();
    const voltageHook = renderHook(() => useCockpitVoltage());

    act(() => {
      MockWebSocket.latestInstance?.triggerMessage({
        op: 'publish',
        topic: '/ugv/voltage',
        // A real frame off the robot: 12.11 / 12.6 = 0.96111.
        msg: { voltage: 12.11, percentage: 0.9611111283302307, present: true },
      });
    });

    expect(voltageHook.result.current.voltage).toBeCloseTo(12.11, 5);
    expect(voltageHook.result.current).not.toHaveProperty('percentage');
  });

  // BatteryState honesty gates (2026-08-07): current is a measurement only when
  // the publisher fills power_supply_status; present=false is the publisher's
  // own absent-sensor report and nulls the filler zeros it arrives with.
  it('carries BatteryState current/status/present through the honesty gates', () => {
    openSocket();
    const voltageHook = renderHook(() => useCockpitVoltage());

    // beast_power-style: real measurement, discharging at 30 mA.
    act(() => {
      MockWebSocket.latestInstance?.triggerMessage({
        op: 'publish',
        topic: '/ugv/voltage',
        msg: { voltage: 12.07, current: -0.03, power_supply_status: 2, present: true },
      });
    });
    expect(voltageHook.result.current.voltage).toBe(12.07);
    expect(voltageHook.result.current.current).toBe(-0.03);
    expect(voltageHook.result.current.powerSupplyStatus).toBe(2);
    expect(voltageHook.result.current.present).toBe(true);

    // bringup-style legacy dummy: current 0.0 with status UNKNOWN must NOT
    // surface as a real 0.0 A draw.
    act(() => {
      MockWebSocket.latestInstance?.triggerMessage({
        op: 'publish',
        topic: '/ugv/voltage',
        msg: { voltage: 11.5, current: 0.0, power_supply_status: 0, present: true },
      });
    });
    expect(voltageHook.result.current.voltage).toBe(11.5);
    expect(voltageHook.result.current.current).toBeNull();
    expect(voltageHook.result.current.powerSupplyStatus).toBeNull();

    // Absent-sensor report: the publisher's filler zeros never render as readings.
    act(() => {
      MockWebSocket.latestInstance?.triggerMessage({
        op: 'publish',
        topic: '/ugv/voltage',
        msg: { voltage: 0.0, current: 0.0, power_supply_status: 0, present: false },
      });
    });
    expect(voltageHook.result.current.voltage).toBeNull();
    expect(voltageHook.result.current.current).toBeNull();
    expect(voltageHook.result.current.present).toBe(false);
  });

  // ── ROBOT MESSAGE-TYPE CONTRACT ───────────────────────────────────────────
  // DDS matches by type. A wrong type string means the robot's subscriber never
  // matches and the control is silently dead — the exact failure that left the
  // headlights and the steady toggle inert. Pin every string against
  // ugv_ws@fc1c29e so a "harmonising" edit has to break a test to land.
  describe('message-type contract', () => {
    const EXPECTED_SUBSCRIPTIONS: Record<string, string> = {
      '/ugv/voltage': 'sensor_msgs/msg/BatteryState',
      '/scan': 'sensor_msgs/msg/LaserScan',
      '/odom': 'nav_msgs/msg/Odometry',
      '/imu/raw': 'sensor_msgs/msg/Imu',
      '/diagnostics': 'diagnostic_msgs/msg/DiagnosticArray',
      '/oak/rgb/image_raw/compressed': 'sensor_msgs/msg/CompressedImage',
      // Phase E: occupancy grid + the map→odom link for robot-on-map placement.
      '/map': 'nav_msgs/msg/OccupancyGrid',
      '/tf': 'tf2_msgs/msg/TFMessage',
      // NOT HERE, and each absence is load-bearing (2026-09-14): the bridge
      // allowlist in beast-ros config/bridge.yaml refuses /cockpit/status,
      // /cockpit/depth/compressed and /cockpit/overhead_clearance, and
      // /ugv/allow_motion does not exist on the robot at all. Subscribing to
      // any of them buys a panel that waits forever.
    };

    const EXPECTED_PUBLICATIONS: Record<string, string> = {
      '/cmd_vel_ui': 'geometry_msgs/msg/Twist',
      // Robot subscriber is Float32MultiArray. Int32MultiArray never matches.
      '/ugv/led_ctrl': 'std_msgs/msg/Float32MultiArray',
      // ros2_control controller — genuinely Float64. Do NOT harmonise with the
      // Float32 topic above; they are different robot-side subscribers.
      '/pt_joint_position_controller/commands': 'std_msgs/msg/Float64MultiArray',
      '/ugv/pt_steady_ctrl': 'std_msgs/msg/Float32MultiArray',
      // No /cmd_vel_estop_lock: the cockpit never publishes mux locks, and
      // there is no arming service either — twist_mux on this stack has no
      // locks at all, by design.
    };

    it('declares exactly the robot-side topic set', () => {
      expect(Object.fromEntries(ROS_SUBSCRIPTIONS.map((s) => [s.topic, s.type]))).toEqual(
        EXPECTED_SUBSCRIPTIONS,
      );
      expect(Object.fromEntries(ROS_PUBLICATIONS.map((p) => [p.topic, p.type]))).toEqual(
        EXPECTED_PUBLICATIONS,
      );
    });

    it('puts those exact types on the wire, with attributable ids', () => {
      const ws = openSocket();
      const ops = wireOps(ws);
      const deferred = new Set<string>(DEFERRED_WIRE_TOPICS);

      Object.entries(EXPECTED_SUBSCRIPTIONS).forEach(([topic, type]) => {
        const op = ops.find((o) => o.op === 'subscribe' && o.topic === topic);
        if (deferred.has(topic)) {
          expect(op, `${topic} must stay off the wire until the grid is room-scale`).toBeUndefined();
          return;
        }
        expect(op, `no subscribe for ${topic}`).toBeTruthy();
        expect(op!.type).toBe(type);
        // Without ids, a glob-whitelist denial is unattributable.
        expect(op!.id).toBe(`sub:${topic}`);
      });

      Object.entries(EXPECTED_PUBLICATIONS).forEach(([topic, type]) => {
        const op = ops.find((o) => o.op === 'advertise' && o.topic === topic);
        expect(op, `no advertise for ${topic}`).toBeTruthy();
        expect(op!.type).toBe(type);
        expect(op!.id).toBe(`adv:${topic}`);
      });
    });

    it('never subscribes /imu/data — nothing publishes it on this robot', () => {
      const ws = openSocket();
      const topics = wireOps(ws).map((o) => o.topic);
      expect(topics).not.toContain('/imu/data');
      expect(topics).toContain('/imu/raw');
    });

    it('caps the image subscriptions at one queued frame', () => {
      const ws = openSocket();
      const images = wireOps(ws).filter(
        (o) => o.op === 'subscribe' && typeof o.topic === 'string' && o.topic.includes('compressed'),
      ) as Array<{ queue_length?: number }>;
      // One: the RGB feed. The depth topic the cockpit used to subscribe to is
      // gone — see EXPECTED_SUBSCRIPTIONS.
      expect(images).toHaveLength(1);
      images.forEach((op) => expect(op.queue_length).toBe(1));
    });

    it('raises the bridge status level so refusals are not silent', () => {
      const ws = openSocket();
      expect(wireOps(ws).some((o) => o.op === 'set_level')).toBe(true);
    });

    it('auto-subscribes /map now that the live grid is room-scale', () => {
      const ws = openSocket();
      const topics = wireOps(ws)
        .filter((o) => o.op === 'subscribe')
        .map((o) => o.topic);
      expect(topics).toContain('/map');
      expect(topics).toContain('/scan');
      expect(topics).toContain('/tf');
      // The deferral list must actually keep topics off the wire — if a topic
      // is ever re-deferred, this catches a subscribe leaking through.
      for (const deferred of DEFERRED_WIRE_TOPICS) {
        expect(topics).not.toContain(deferred);
      }
    });

    it('unsubscribes /map when the bridge starts fragmenting an oversized dump', () => {
      const ws = openSocket();
      ws.send.mockClear();
      const bridgeHook = renderHook(() => useCockpitBridge());
      act(() => {
        ws.triggerMessage({ op: 'fragment', id: 'sub:/map', num: 0, total: 8 });
      });
      const unsub = wireOps(ws).find((o) => o.op === 'unsubscribe' && o.topic === '/map');
      expect(unsub).toBeTruthy();
      expect(bridgeHook.result.current.faults[0]?.msg).toMatch(/fragmented/);
    });
  });

  // ── MALFORMED JSON FROM THE BRIDGE ────────────────────────────────────────
  // rosbridge emits float NaN/Infinity as BARE tokens, which are not valid JSON.
  // These payloads are raw strings on purpose: JSON.stringify would turn them
  // into `null` and the test would prove nothing.
  describe('non-finite defence (raw wire payloads)', () => {
    it('survives bare NaN/Infinity tokens instead of dropping the whole frame', () => {
      openSocket();
      const scanHook = renderHook(() => useCockpitScan());

      act(() => {
        MockWebSocket.latestInstance?.triggerRaw(
          '{"op":"publish","topic":"/scan","msg":{"ranges":[1.0,NaN,Infinity,-Infinity,2.0],' +
            '"angle_min":0,"angle_max":0,"angle_increment":0,"range_min":0.1,"range_max":10.0}}',
        );
      });

      // The frame parsed at all (the old client threw in JSON.parse and lost it)
      // and the non-finite bins were dropped rather than rendered.
      expect(scanHook.result.current.hasReceived).toBe(true);
      expect(scanHook.result.current.points.map((p) => p.range)).toEqual([1.0, 2.0]);
    });

    it('renders a NaN voltage as unknown, not as zero volts', () => {
      openSocket();
      const voltageHook = renderHook(() => useCockpitVoltage());

      act(() => {
        MockWebSocket.latestInstance?.triggerRaw(
          '{"op":"publish","topic":"/ugv/voltage","msg":{"voltage":NaN}}',
        );
      });

      expect(voltageHook.result.current.voltage).toBeNull();
    });

    // ── N6: repair numbers, never the robot's words ─────────────────────────
    it('leaves NaN INSIDE a quoted string alone while repairing a bare one', () => {
      openSocket();
      const diagHook = renderHook(() => useCockpitDiagnostics());

      // One frame, both cases: a bare NaN that must become null, and the same
      // token inside operator-facing text that must survive untouched.
      act(() => {
        MockWebSocket.latestInstance?.triggerRaw(
          '{"op":"publish","topic":"/diagnostics","msg":{"status":[{"name":"imu",' +
            '"level":1,"message":"covariance NaN, using defaults",' +
            '"values":[{"key":"bias","value":"x"}]}],' +
            '"header":{"stamp":{"sec":NaN,"nanosec":0}}}}',
        );
      });

      expect(diagHook.result.current.items).toHaveLength(1);
      // A blind regex rewrites this to "covariance null, using defaults" —
      // editing the robot's words while claiming to repair its numbers.
      expect(diagHook.result.current.items[0].message).toBe('covariance NaN, using defaults');
      // …and the bare token in the header still got repaired.
      expect(diagHook.result.current.items[0].stampMs).toBeNull();
    });

    it('does not mistake an escaped quote for the end of a string', () => {
      openSocket();
      const diagHook = renderHook(() => useCockpitDiagnostics());

      act(() => {
        MockWebSocket.latestInstance?.triggerRaw(
          '{"op":"publish","topic":"/diagnostics","msg":{"status":[{"name":"imu",' +
            '"level":1,"message":"said \\"NaN\\" loudly","values":[]}],' +
            '"header":{"stamp":{"sec":NaN,"nanosec":0}}}}',
        );
      });

      expect(diagHook.result.current.items[0].message).toBe('said "NaN" loudly');
    });

    // ── N7: no lookbehind — it is a PARSE-time SyntaxError on iOS Safari <16.4,
    // which would take down every route that imports this module, on a platform
    // the spec names as a core use case.
    it('uses no lookbehind assertions anywhere in the client', () => {
      const source = readFileSync(resolve(process.cwd(), 'src/lib/ros/client.ts'), 'utf8');
      expect(source).not.toMatch(/\(\?<[=!]/);
    });

  });

  // ── LiDAR CROP ────────────────────────────────────────────────────────────
  describe('LiDAR blind-sector crop', () => {
    // 360 bins starting at 0 rad with a 1° increment, so bin index == SCAN
    // bearing in degrees. The parser rotates every point by
    // LIDAR_SCAN_TO_BODY_YAW_DEG into the body frame, then applies the
    // body-frame crop sector — so retained body bearings are bin + yaw.
    const send360 = () => {
      const ranges = Array(360).fill(2.0);
      act(() => {
        MockWebSocket.latestInstance?.triggerMessage({
          op: 'publish',
          topic: '/scan',
          msg: {
            ranges,
            angle_min: 0,
            angle_max: Math.PI * 2,
            angle_increment: (Math.PI * 2) / 360,
            range_min: 0.1,
            range_max: 10.0,
          },
        });
      });
    };

    const degreesOf = (points: Array<{ angle: number }>) =>
      points.map((p) => Math.round(((p.angle * 180) / Math.PI) % 360));

    it('drops exactly the declared sector and keeps everything else', () => {
      openSocket();
      const scanHook = renderHook(() => useCockpitScan());
      send360();

      const { startDeg, endDeg } = LIDAR_CROP_SECTOR_DEG;
      const expectedDropped: number[] = [];
      const expectedRetained: number[] = [];
      for (let deg = 0; deg < 360; deg++) {
        (deg >= startDeg && deg <= endDeg ? expectedDropped : expectedRetained).push(deg);
      }

      const retained = degreesOf(scanHook.result.current.points);

      // Absolute membership on BOTH sides — not just "fewer than 360".
      // (Order differs: points arrive in scan-bin order, so body bearings are
      // rotated by the +90° scan→body yaw. Compare as sets.)
      expect([...retained].sort((a, b) => a - b)).toEqual(expectedRetained);
      expect(retained).toHaveLength(360 - (endDeg - startDeg) - 1);
      expectedDropped.forEach((deg) => expect(retained).not.toContain(deg));

      // Boundary bins, spelled out from the declared sector.
      expect(retained).toContain((startDeg - 1 + 360) % 360);
      expect(retained).not.toContain(startDeg);
      expect(retained).not.toContain(endDeg);
      expect(retained).toContain((endDeg + 1) % 360);
    });

    it('rotates scan bearings into the body frame (verified wall test)', () => {
      openSocket();
      const scanHook = renderHook(() => useCockpitScan());
      // Single return at scan 270° — the 2026-08-10 wall test proved this is
      // body FORWARD (URDF base_lidar_link yaw +90°).
      const ranges = Array(360).fill(NaN);
      ranges[270] = 1.0;
      act(() => {
        MockWebSocket.latestInstance?.triggerMessage({
          op: 'publish',
          topic: '/scan',
          msg: {
            ranges,
            angle_min: 0,
            angle_max: Math.PI * 2,
            angle_increment: (Math.PI * 2) / 360,
            range_min: 0.1,
            range_max: 10.0,
          },
        });
      });

      const pts = scanHook.result.current.points;
      expect(pts).toHaveLength(1);
      // Body forward: x ≈ +1 m, y ≈ 0.
      expect(pts[0].x).toBeCloseTo(1.0, 5);
      expect(pts[0].y).toBeCloseTo(0.0, 5);
      expect(LIDAR_SCAN_TO_BODY_YAW_DEG).toBe(90);
    });

    it('measures the scan rate from arrivals rather than asserting a nominal one', () => {
      openSocket();
      const scanHook = renderHook(() => useCockpitScan());

      send360();
      expect(scanHook.result.current.intervalMs).toBeNull(); // one sample proves nothing

      act(() => {
        vi.advanceTimersByTime(100);
      });
      send360();
      expect(scanHook.result.current.intervalMs).toBeCloseTo(100, 0);
    });
  });

  // ── MAP INGEST (/map + /tf) ───────────────────────────────────────────────
  describe('map ingest', () => {
    it('parses the occupancy grid with its origin and resolution', () => {
      openSocket();
      const mapHook = renderHook(() => useCockpitMap());
      act(() => {
        MockWebSocket.latestInstance?.triggerMessage({
          op: 'publish',
          topic: '/map',
          msg: {
            info: {
              width: 3,
              height: 2,
              resolution: 0.05,
              origin: { position: { x: -1.5, y: -2.0 } },
            },
            data: [-1, 0, 50, 100, 0, -1],
          },
        });
      });
      const m = mapHook.result.current;
      expect(m.width).toBe(3);
      expect(m.height).toBe(2);
      expect(m.resolution).toBeCloseTo(0.05, 6);
      expect(m.originX).toBeCloseTo(-1.5, 6);
      expect(m.originY).toBeCloseTo(-2.0, 6);
      expect(m.data).toEqual([-1, 0, 50, 100, 0, -1]);
      expect(m.hasReceived).toBe(true);
    });

    it('unsubscribes /map when the grid exceeds MAP_MAX_CELLS', () => {
      const ws = openSocket();
      const mapHook = renderHook(() => useCockpitMap());
      const bridgeHook = renderHook(() => useCockpitBridge());
      const width = 600;
      const height = 500;
      expect(width * height).toBeGreaterThan(MAP_MAX_CELLS);
      ws.send.mockClear();
      act(() => {
        MockWebSocket.latestInstance?.triggerMessage({
          op: 'publish',
          topic: '/map',
          msg: {
            info: { width, height, resolution: 0.05, origin: { position: { x: 0, y: 0 } } },
            data: new Array(width * height).fill(0),
          },
        });
      });
      expect(mapHook.result.current.hasReceived).toBe(false);
      const unsub = wireOps(ws).find((o) => o.op === 'unsubscribe' && o.topic === '/map');
      expect(unsub).toBeTruthy();
      expect(bridgeHook.result.current.faults[0]?.msg).toMatch(/exceeds/);
    });

    it('rejects a grid whose data does not match its dimensions', () => {
      openSocket();
      const mapHook = renderHook(() => useCockpitMap());
      act(() => {
        MockWebSocket.latestInstance?.triggerMessage({
          op: 'publish',
          topic: '/map',
          msg: {
            info: { width: 4, height: 4, resolution: 0.05, origin: { position: { x: 0, y: 0 } } },
            data: [0, 1], // 2 cells for a 4x4 claim
          },
        });
      });
      // Rejected at ingest: a size-mismatched grid never enters the store.
      expect(mapHook.result.current.hasReceived).toBe(false);
      expect(mapHook.result.current.data).toHaveLength(0);
    });

    it('extracts only the map→odom link from the /tf firehose', () => {
      openSocket();
      const moHook = renderHook(() => useCockpitMapOdom());
      act(() => {
        MockWebSocket.latestInstance?.triggerMessage({
          op: 'publish',
          topic: '/tf',
          msg: {
            transforms: [
              // noise: some other link — must be ignored
              {
                header: { frame_id: 'odom' },
                child_frame_id: 'base_footprint',
                transform: { translation: { x: 9, y: 9 }, rotation: { z: 0, w: 1 } },
              },
              {
                header: { frame_id: 'map' },
                child_frame_id: 'odom',
                // 90° about z: z = sin(45°), w = cos(45°)
                transform: {
                  translation: { x: 1.25, y: -0.5 },
                  rotation: { z: Math.SQRT1_2, w: Math.SQRT1_2 },
                },
              },
            ],
          },
        });
      });
      const mo = moHook.result.current;
      expect(mo.x).toBeCloseTo(1.25, 6);
      expect(mo.y).toBeCloseTo(-0.5, 6);
      expect(mo.yaw).toBeCloseTo(Math.PI / 2, 5);
      expect(mo.hasReceived).toBe(true);
    });
  });

  // ── STALENESS ─────────────────────────────────────────────────────────────
  describe('staleness', () => {
    it('marks a slice stale once its freshness budget lapses', () => {
      openSocket();
      const voltageHook = renderHook(() => useCockpitVoltage());

      act(() => {
        MockWebSocket.latestInstance?.triggerMessage({
          op: 'publish',
          topic: '/ugv/voltage',
          msg: { voltage: 11.5 },
        });
      });
      expect(voltageHook.result.current.stale).toBe(false);

      act(() => {
        vi.advanceTimersByTime(2500); // budget is 2 s
      });
      expect(voltageHook.result.current.stale).toBe(true);
      // The last good value is still available — it is just no longer "live".
      expect(voltageHook.result.current.voltage).toBe(11.5);
    });

    it('marks every slice stale the instant the socket closes', () => {
      const ws = openSocket();
      const voltageHook = renderHook(() => useCockpitVoltage());
      const scanHook = renderHook(() => useCockpitScan());

      act(() => {
        ws.triggerMessage({ op: 'publish', topic: '/ugv/voltage', msg: { voltage: 11.5 } });
      });
      expect(voltageHook.result.current.stale).toBe(false);

      act(() => {
        ws.triggerClose();
      });

      // No waiting for the per-slice budget: the link is gone, nothing is live.
      expect(voltageHook.result.current.stale).toBe(true);
      expect(scanHook.result.current.stale).toBe(true);
    });

    it('reports UNKNOWN (not a default) for a topic that never published', () => {
      openSocket();
      const muxHook = renderHook(() => useCockpitMux());

      expect(muxHook.result.current.hasReceived).toBe(false);
      // `activePriority: 0` would read as "twist_mux says nothing is driving".
      // It has said nothing at all, which is a different claim.
      expect(muxHook.result.current.activePriority).toBeNull();
      expect(muxHook.result.current.inputs).toEqual([]);
    });

    it('clears has-received when a new connection opens', () => {
      const ws = openSocket();
      const voltageHook = renderHook(() => useCockpitVoltage());

      act(() => {
        ws.triggerMessage({ op: 'publish', topic: '/ugv/voltage', msg: { voltage: 11.5 } });
      });
      expect(voltageHook.result.current.hasReceived).toBe(true);

      act(() => {
        ws.triggerClose();
        vi.advanceTimersByTime(1100);
        MockWebSocket.latestInstance?.triggerOpen();
      });

      expect(voltageHook.result.current.hasReceived).toBe(false);
      expect(voltageHook.result.current.voltage).toBeNull();
    });
  });

  // ── TWIST_MUX LADDER, FROM /diagnostics ───────────────────────────────────
  // Payloads below are copied from a live `ros2 topic echo /diagnostics` on
  // BEAST-01 (2026-09-14), including twist_mux's leading space and its six-
  // decimal timeout formatting, so the parser is pinned against the real wire
  // rather than against a tidied-up idea of it.
  describe('twist_mux parsing', () => {
    const muxFrame = (values: Array<{ key: string; value: string }>) => ({
      op: 'publish',
      topic: '/diagnostics',
      msg: {
        status: [
          { name: 'twist_mux: Twist mux status', level: 0, message: 'ok', values },
        ],
      },
    });

    const LIVE_VALUES = [
      { key: 'velocity topics.joy_operator', value: ' masked (listening to cmd_vel_joy_operator @ 0.500000s with priority #100)' },
      { key: 'velocity topics.joy_robot', value: ' masked (listening to cmd_vel_joy_robot @ 0.500000s with priority #150)' },
      { key: 'velocity topics.nav', value: ' masked (listening to cmd_vel_nav @ 0.500000s with priority #10)' },
      { key: 'velocity topics.operator', value: ' masked (listening to cmd_vel_operator @ 0.500000s with priority #90)' },
      { key: 'velocity topics.ui', value: ' masked (listening to cmd_vel_ui @ 0.500000s with priority #50)' },
      { key: 'current priority', value: '0' },
      { key: 'loop time in [sec]', value: '0' },
      { key: 'data age in [sec]', value: '0' },
    ];

    it('reads the rung list out of the twist_mux diagnostic, ordered by priority', () => {
      const ws = openSocket();
      const muxHook = renderHook(() => useCockpitMux());

      act(() => {
        ws.triggerMessage(muxFrame(LIVE_VALUES));
      });

      const mux = muxHook.result.current;
      expect(mux.hasReceived).toBe(true);
      // Five rungs, not the four the hand-written ladder used to claim: the
      // robot really does run `operator` at 90.
      expect(mux.inputs.map((i) => i.priority)).toEqual([150, 100, 90, 50, 10]);
      expect(mux.inputs.map((i) => i.topic)).toEqual([
        'cmd_vel_joy_robot',
        'cmd_vel_joy_operator',
        'cmd_vel_operator',
        'cmd_vel_ui',
        'cmd_vel_nav',
      ]);
      expect(mux.inputs[3]).toMatchObject({ name: 'ui', timeoutSec: 0.5 });
    });

    it('treats current priority 0 as "nothing is driving", not as unknown', () => {
      const ws = openSocket();
      const muxHook = renderHook(() => useCockpitMux());

      act(() => {
        ws.triggerMessage(muxFrame(LIVE_VALUES));
      });

      expect(muxHook.result.current.activePriority).toBe(0);
      expect(muxHook.result.current.dataAgeSec).toBe(0);
    });

    it('reports the active rung by priority, not by the masked/unmasked wording', () => {
      const ws = openSocket();
      const muxHook = renderHook(() => useCockpitMux());

      act(() => {
        ws.triggerMessage(
          muxFrame(
            LIVE_VALUES.map((v) =>
              v.key === 'current priority' ? { key: 'current priority', value: '50' } : v,
            ),
          ),
        );
      });

      expect(muxHook.result.current.activePriority).toBe(50);
    });

    it('does not stamp the ladder fresh on a diagnostics array without twist_mux', () => {
      const ws = openSocket();
      const muxHook = renderHook(() => useCockpitMux());
      const diagHook = renderHook(() => useCockpitDiagnostics());

      act(() => {
        ws.triggerMessage({
          op: 'publish',
          topic: '/diagnostics',
          msg: {
            status: [
              { name: 'lifecycle_manager_navigation: Nav2 Health', level: 0, message: 'Nav2 is active', values: [] },
            ],
          },
        });
      });

      // Each publisher sends its OWN DiagnosticArray, so a Nav2 heartbeat must
      // not read as "twist_mux reported just now".
      expect(diagHook.result.current.hasReceived).toBe(true);
      expect(muxHook.result.current.hasReceived).toBe(false);
    });

    it('keeps an unparsable rung rather than inventing a priority for it', () => {
      const ws = openSocket();
      const muxHook = renderHook(() => useCockpitMux());

      act(() => {
        ws.triggerMessage(
          muxFrame([
            { key: 'velocity topics.ui', value: 'some future wording we do not know' },
            { key: 'current priority', value: '0' },
          ]),
        );
      });

      expect(muxHook.result.current.inputs).toEqual([
        { name: 'ui', topic: null, priority: null, timeoutSec: null },
      ]);
    });
  });

  // ── ROSBRIDGE STATUS FRAMES ───────────────────────────────────────────────
  describe('bridge status frames', () => {
    it('attributes an error frame to the topic whose op was refused', () => {
      const ws = openSocket();
      const bridgeHook = renderHook(() => useCockpitBridge());

      act(() => {
        ws.triggerMessage({
          op: 'status',
          level: 'error',
          msg: 'Topic /ugv/led_ctrl is not in the whitelist',
          id: 'adv:/ugv/led_ctrl',
        });
      });

      expect(bridgeHook.result.current.deadTopics).toContain('/ugv/led_ctrl');
      expect(bridgeHook.result.current.faults[0].level).toBe('error');
      expect(bridgeHook.result.current.faults[0].topic).toBe('/ugv/led_ctrl');
    });

    it('records a warning without declaring the control dead', () => {
      const ws = openSocket();
      const bridgeHook = renderHook(() => useCockpitBridge());

      act(() => {
        ws.triggerMessage({ op: 'status', level: 'warning', msg: 'slow subscriber', id: 'sub:/scan' });
      });

      expect(bridgeHook.result.current.faults).toHaveLength(1);
      expect(bridgeHook.result.current.deadTopics).toEqual([]);
    });
  });

  // ── NO SERVICE CALLS AT ALL ───────────────────────────────────────────────
  // The service-call machinery existed for /ugv/set_allow_motion and went with
  // it (2026-09-14). Nothing in the cockpit calls a service today, so nothing
  // may put a `call_service` op on the wire — a live bridge would answer an
  // unlisted service with a refusal, and a dead call path is how the arming gate
  // came to look functional while doing nothing.
  describe('service calls', () => {
    it('puts no call_service op on the wire', () => {
      const ws = openSocket();
      expect(wireOps(ws).some((o) => o.op === 'call_service')).toBe(false);
    });

    it('exposes no motion-authority call', () => {
      expect(rosClient).not.toHaveProperty('setMotionAllowed');
      expect(rosClient).not.toHaveProperty('callService');
    });

    it('ignores an unsolicited service_response instead of throwing', () => {
      const ws = openSocket();
      act(() => {
        ws.triggerMessage({ op: 'service_response', service: '/whatever', id: 'call_stale', result: true });
      });
      expect(true).toBe(true);
    });
  });

  // ── RETURNING TO A COCKPIT THAT NEVER DISCONNECTED ────────────────────────
  describe('reconnecting to a live socket', () => {
    it('re-subscribes instead of early-returning on an already-open socket', () => {
      const ws = openSocket();
      ws.send.mockClear();

      // Same URL, socket still OPEN — the path taken when the operator returns
      // to the cockpit after a route change. Previously this returned bare and
      // left the remounted page with no subscriptions.
      act(() => {
        rosClient.connect('wss://beast-test-url:9090');
      });

      const topics = wireOps(ws)
        .filter((o) => o.op === 'subscribe')
        .map((o) => o.topic);
      expect(topics).toContain('/scan');
      expect(topics).toContain('/diagnostics');
    });
  });
});
