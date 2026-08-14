import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommandRail } from "@/components/cockpit/CommandRail";
import {
  ANGULAR_MAX,
  ARC_ANGULAR_SCALE,
  ARC_LINEAR_SCALE,
  LINEAR_MAX,
  RATE_BOOST,
  RATE_DEFAULT_INDEX,
  RATE_PRESETS,
  STOP_TAIL_COUNT,
  STOP_TAIL_INTERVAL_MS,
} from "@/lib/ros/drive-law";

const mocks = vi.hoisted(() => ({
  publish: vi.fn<(topic: string, message: unknown) => boolean>(() => true),
  setMotionAllowed: vi.fn(async () => ({ ok: true })),
  callService: vi.fn(async () => ({ ok: true })),
  allowMotion: true as boolean | null,
  isCharging: false,
  isEthernetConnected: false,
}));

vi.mock("@/lib/ros/client", () => ({
  rosClient: {
    publish: mocks.publish,
    setMotionAllowed: mocks.setMotionAllowed,
    callService: mocks.callService,
  },
  useConnectionState: () => "connected",
  useCockpitBridge: () => ({ faults: [], deadTopics: [] }),
  useCockpitStatus: () => ({
    muxSource: "NONE",
    commandAge: null,
    publisherCount: 1,
    allowMotion: mocks.allowMotion,
    isCharging: mocks.isCharging,
    isEthernetConnected: mocks.isEthernetConnected,
    wifiRssi: null,
    diskFree: null,
    cpuTemp: null,
    gpuTemp: null,
    hasReceived: true,
    receivedAt: Date.now(),
    stale: false,
  }),
}));

type Twist = { linear: { x: number }; angular: { z: number } };

/** Straight-line speed at the boot default — Waveshare's min_rate. */
const DEFAULT_STRAIGHT = LINEAR_MAX * RATE_PRESETS[RATE_DEFAULT_INDEX];
const PRECISION = 10;

function twistPublishes() {
  return mocks.publish.mock.calls.filter(([topic]) => topic === "/cmd_vel_ui");
}

function movingPublishes() {
  return twistPublishes().filter(([, message]) => {
    const twist = message as Twist;
    return twist.linear.x !== 0 || twist.angular.z !== 0;
  });
}

function zeroPublishes() {
  return twistPublishes().filter(([, message]) => {
    const twist = message as Twist;
    return twist.linear.x === 0 && twist.angular.z === 0;
  });
}

function lastTwist(): Twist {
  const calls = twistPublishes();
  return calls[calls.length - 1][1] as Twist;
}

/** Run the stop tail's timers to completion. */
function drainStopTail() {
  act(() => vi.advanceTimersByTime(STOP_TAIL_COUNT * STOP_TAIL_INTERVAL_MS));
}

describe("CommandRail control lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.publish.mockClear();
    mocks.publish.mockReturnValue(true);
    mocks.setMotionAllowed.mockClear();
    mocks.callService.mockClear();
    mocks.allowMotion = true;
    mocks.isCharging = false;
    mocks.isEthernetConnected = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("publishes held intent at 10 Hz and a checked 5-zero tail on release", () => {
    render(<CommandRail />);
    act(() => vi.advanceTimersByTime(250));
    mocks.publish.mockClear();

    fireEvent.keyDown(window, { key: "w", repeat: false });
    expect(movingPublishes()).toHaveLength(1);
    // The ceiling and the throttle, not a hard-coded step.
    expect(lastTwist().linear.x).toBeCloseTo(DEFAULT_STRAIGHT, PRECISION);
    expect(lastTwist().angular.z).toBe(0);

    act(() => vi.advanceTimersByTime(300));
    expect(movingPublishes()).toHaveLength(4);

    fireEvent.keyUp(window, { key: "w" });
    // The first zero is SYNCHRONOUS — a keyup still stops in the same tick.
    expect(zeroPublishes()).toHaveLength(1);
    drainStopTail();
    expect(zeroPublishes()).toHaveLength(STOP_TAIL_COUNT);

    // ...then silence. A bounded tail, not a stream: an idle-but-publishing
    // source at priority 50 would mask nav (10) forever.
    act(() => vi.advanceTimersByTime(300));
    expect(movingPublishes()).toHaveLength(4);
    expect(twistPublishes()).toHaveLength(4 + STOP_TAIL_COUNT);
  });

  it("stops a held pointer intent when the pointer leaves", () => {
    render(<CommandRail />);
    act(() => vi.advanceTimersByTime(250));
    mocks.publish.mockClear();
    const forward = screen.getByTitle("Forward (W)") as HTMLButtonElement;
    forward.setPointerCapture = vi.fn();

    fireEvent.pointerDown(forward, { pointerId: 7 });
    act(() => vi.advanceTimersByTime(200));
    expect(movingPublishes()).toHaveLength(3);

    fireEvent.pointerUp(forward, { pointerId: 7 });
    act(() => vi.advanceTimersByTime(200));

    expect(zeroPublishes()).toHaveLength(STOP_TAIL_COUNT);
    expect(lastTwist().linear.x).toBe(0);
    expect(lastTwist().angular.z).toBe(0);
  });

  // ── THE HEADLINE REGRESSION ──────────────────────────────────────────────
  it("releasing A while holding W keeps driving forward — NO zero at all", () => {
    render(<CommandRail />);
    act(() => vi.advanceTimersByTime(250));

    fireEvent.keyDown(window, { key: "w", repeat: false });
    fireEvent.keyDown(window, { key: "a", repeat: false });
    // The arc: both axes live at once.
    expect(lastTwist().linear.x).toBeCloseTo(DEFAULT_STRAIGHT * ARC_LINEAR_SCALE, PRECISION);
    expect(lastTwist().angular.z).toBeCloseTo(
      ANGULAR_MAX * RATE_PRESETS[RATE_DEFAULT_INDEX] * ARC_ANGULAR_SCALE,
      PRECISION,
    );

    mocks.publish.mockClear();
    fireEvent.keyUp(window, { key: "a" });

    // Course correction without stopping: straighten out, do not halt.
    expect(zeroPublishes()).toHaveLength(0);
    expect(lastTwist().linear.x).toBeCloseTo(DEFAULT_STRAIGHT, PRECISION);
    expect(lastTwist().angular.z).toBe(0);
  });

  it("releasing W while holding A transitions to spin-in-place with no zero between", () => {
    render(<CommandRail />);
    act(() => vi.advanceTimersByTime(250));

    fireEvent.keyDown(window, { key: "w", repeat: false });
    fireEvent.keyDown(window, { key: "a", repeat: false });
    mocks.publish.mockClear();
    fireEvent.keyUp(window, { key: "w" });

    expect(zeroPublishes()).toHaveLength(0);
    expect(lastTwist().linear.x).toBe(0);
    expect(lastTwist().angular.z).toBeCloseTo(
      ANGULAR_MAX * RATE_PRESETS[RATE_DEFAULT_INDEX],
      PRECISION,
    );
  });

  it("pressing 2 mid-drive raises the commanded magnitude without interrupting the stream", () => {
    render(<CommandRail />);
    act(() => vi.advanceTimersByTime(250));

    fireEvent.keyDown(window, { key: "w", repeat: false });
    const before = lastTwist().linear.x;
    mocks.publish.mockClear();

    fireEvent.keyDown(window, { key: "2", repeat: false });

    expect(zeroPublishes()).toHaveLength(0);
    expect(lastTwist().linear.x).toBeCloseTo(LINEAR_MAX * RATE_PRESETS[1], PRECISION);
    expect(lastTwist().linear.x).toBeGreaterThan(before);

    // The stream carries on at 10 Hz at the new magnitude.
    act(() => vi.advanceTimersByTime(100));
    expect(lastTwist().linear.x).toBeCloseTo(LINEAR_MAX * RATE_PRESETS[1], PRECISION);
  });

  it("SHIFT boosts to max_rate and releasing restores the SELECTED preset", () => {
    render(<CommandRail />);
    act(() => vi.advanceTimersByTime(250));

    fireEvent.keyDown(window, { key: "2", repeat: false });
    fireEvent.keyDown(window, { key: "w", repeat: false });
    expect(lastTwist().linear.x).toBeCloseTo(LINEAR_MAX * RATE_PRESETS[1], PRECISION);

    fireEvent.keyDown(window, { key: "Shift", repeat: false });
    expect(lastTwist().linear.x).toBeCloseTo(LINEAR_MAX * RATE_BOOST, PRECISION);
    expect(screen.getByText("BOOST")).toBeInTheDocument();

    mocks.publish.mockClear();
    fireEvent.keyUp(window, { key: "Shift" });

    // Back to CRUISE — never to full, never to zero.
    expect(zeroPublishes()).toHaveLength(0);
    expect(lastTwist().linear.x).toBeCloseTo(LINEAR_MAX * RATE_PRESETS[1], PRECISION);
    expect(screen.queryByText("BOOST")).not.toBeInTheDocument();
  });

  it("window blur clears BOTH the held keys and a stuck boost flag", () => {
    render(<CommandRail />);
    act(() => vi.advanceTimersByTime(250));

    fireEvent.keyDown(window, { key: "w", repeat: false });
    fireEvent.keyDown(window, { key: "Shift", repeat: false });
    expect(lastTwist().linear.x).toBeCloseTo(LINEAR_MAX * RATE_BOOST, PRECISION);

    // A Shift keyup that lands on another window never reaches us; a stuck
    // boost flag would make the next keypress full-rate.
    fireEvent.blur(window);
    drainStopTail();
    expect(zeroPublishes()).toHaveLength(STOP_TAIL_COUNT);

    mocks.publish.mockClear();
    fireEvent.keyDown(window, { key: "w", repeat: false });
    expect(lastTwist().linear.x).toBeCloseTo(DEFAULT_STRAIGHT, PRECISION);
  });

  it("a duplicate keydown neither double-publishes nor resets the republish interval", () => {
    render(<CommandRail />);
    act(() => vi.advanceTimersByTime(250));
    mocks.publish.mockClear();

    fireEvent.keyDown(window, { key: "w", repeat: false });
    expect(movingPublishes()).toHaveLength(1);

    act(() => vi.advanceTimersByTime(50));
    fireEvent.keyDown(window, { key: "w", repeat: false });
    expect(movingPublishes()).toHaveLength(1);

    // The interval still fires on its original 100 ms cadence — had the
    // duplicate restarted it, nothing would arrive until 150 ms.
    act(() => vi.advanceTimersByTime(50));
    expect(movingPublishes()).toHaveLength(2);
  });

  it("the stop tail publishes literal zero, never a ramped value", () => {
    // No rate limiter exists today, so this passes trivially. It is the
    // tripwire for the hard requirement that zeros bypass any future limiter:
    // a stop that ramps is not a stop on a robot whose ESP32 latches and has
    // no cmd_vel watchdog. DO NOT DELETE AS REDUNDANT.
    render(<CommandRail />);
    act(() => vi.advanceTimersByTime(250));

    fireEvent.keyDown(window, { key: "3", repeat: false });
    fireEvent.keyDown(window, { key: "w", repeat: false });
    expect(lastTwist().linear.x).toBeCloseTo(LINEAR_MAX * RATE_PRESETS[2], PRECISION);

    mocks.publish.mockClear();
    fireEvent.keyDown(window, { key: " ", repeat: false });

    const first = twistPublishes()[0][1] as Twist;
    expect(first.linear.x).toBe(0);
    expect(first.angular.z).toBe(0);
  });

  it("raises a sticky STOP NOT CONFIRMED banner when a tail zero does not leave the browser", () => {
    render(<CommandRail />);
    act(() => vi.advanceTimersByTime(250));

    fireEvent.keyDown(window, { key: "w", repeat: false });
    fireEvent.keyUp(window, { key: "w" });
    expect(zeroPublishes()).toHaveLength(1);

    // The socket dies before the second zero.
    mocks.publish.mockReturnValue(false);
    act(() => vi.advanceTimersByTime(STOP_TAIL_INTERVAL_MS));

    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent(/stop not confirmed/i);
    expect(banner).toHaveTextContent(`1 of ${STOP_TAIL_COUNT} zero commands`);

    // The rest of the tail is abandoned — retrying on a closed socket is
    // pointless and would fail identically.
    const afterFailure = zeroPublishes().length;
    act(() => vi.advanceTimersByTime(500));
    expect(zeroPublishes()).toHaveLength(afterFailure);

    // The banner carries a DISARM control: the robot may still be driving, and
    // sending the operator hunting for the safety strip is not acceptable.
    fireEvent.click(screen.getByTitle(/disarm motion/i));
    expect(mocks.setMotionAllowed).toHaveBeenCalledWith(false);
  });

  it("the STOP NOT CONFIRMED banner survives a later successful publish and clears only on a full tail", () => {
    render(<CommandRail />);
    act(() => vi.advanceTimersByTime(250));

    fireEvent.keyDown(window, { key: "w", repeat: false });
    fireEvent.keyUp(window, { key: "w" });
    mocks.publish.mockReturnValue(false);
    act(() => vi.advanceTimersByTime(STOP_TAIL_INTERVAL_MS));
    expect(screen.getByRole("alert")).toHaveTextContent(/stop not confirmed/i);

    // An unrelated control succeeding does NOT mean the stop was heard.
    mocks.publish.mockReturnValue(true);
    fireEvent.change(screen.getByTitle("Chassis headlights PWM duty"), {
      target: { value: "120" },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/stop not confirmed/i);

    // Only a confirmed, complete tail clears it.
    fireEvent.keyDown(window, { key: " ", repeat: false });
    drainStopTail();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("ignores the throttle number keys while an input has focus", () => {
    render(<CommandRail />);
    act(() => vi.advanceTimersByTime(250));

    const slider = screen.getByTitle("Chassis headlights PWM duty") as HTMLInputElement;
    slider.focus();
    fireEvent.keyDown(window, { key: "2", repeat: false });
    slider.blur();

    mocks.publish.mockClear();
    fireEvent.keyDown(window, { key: "w", repeat: false });
    expect(lastTwist().linear.x).toBeCloseTo(DEFAULT_STRAIGHT, PRECISION);
  });

  it("renders the throttle selector, the live commanded readout and the ceiling", () => {
    render(<CommandRail />);
    act(() => vi.advanceTimersByTime(250));

    // SLOW is the boot default and prints the speed it commands.
    const slow = screen.getByTitle(/^SLOW —/);
    expect(slow).toHaveAttribute("aria-pressed", "true");
    expect(slow).toHaveTextContent(DEFAULT_STRAIGHT.toFixed(2));
    expect(screen.getByTitle(/^FAST —/)).toHaveAttribute("aria-pressed", "false");

    const readout = screen.getByTitle(/^Commanded —/);
    expect(readout).toHaveTextContent("X +0.00 m/s · Z +0.00 rad/s");

    fireEvent.keyDown(window, { key: "w", repeat: false });
    expect(readout).toHaveTextContent(`X +${DEFAULT_STRAIGHT.toFixed(2)} m/s · Z +0.00 rad/s`);

    // The word is CEILING, not cap — it is what FAST reaches, not a limiter.
    expect(screen.getByText(/Ceiling 1\.30 m\/s · 1\.00 rad\/s · 10 Hz held/)).toBeInTheDocument();
  });

  it("clicking a throttle button changes the preset for pointer operators", () => {
    render(<CommandRail />);
    act(() => vi.advanceTimersByTime(250));

    fireEvent.click(screen.getByTitle(/^CRUISE —/));
    expect(screen.getByTitle(/^CRUISE —/)).toHaveAttribute("aria-pressed", "true");

    mocks.publish.mockClear();
    fireEvent.keyDown(window, { key: "w", repeat: false });
    expect(lastTwist().linear.x).toBeCloseTo(LINEAR_MAX * RATE_PRESETS[1], PRECISION);
  });

  it("lights each D-pad arrow on its own held flag, so a diagonal lights two", () => {
    render(<CommandRail />);
    act(() => vi.advanceTimersByTime(250));

    const forward = screen.getByTitle("Forward (W)");
    const left = screen.getByTitle("Left (A)");
    const right = screen.getByTitle("Right (D)");
    expect(forward.className).not.toMatch(/emerald/);

    fireEvent.keyDown(window, { key: "w", repeat: false });
    fireEvent.keyDown(window, { key: "a", repeat: false });
    expect(forward.className).toMatch(/emerald/);
    expect(left.className).toMatch(/emerald/);
    expect(right.className).not.toMatch(/emerald/);
  });

  it("does not gate drive controls while charging — no automatic interlock (ugv_safety_monitor removed 2026-08-07)", () => {
    mocks.isCharging = true;
    render(<CommandRail />);
    act(() => vi.advanceTimersByTime(500));
    mocks.publish.mockClear();

    fireEvent.keyDown(window, { key: "w", repeat: false });

    expect(mocks.publish).toHaveBeenCalled();
    expect(screen.queryByText(/drive disabled/i)).not.toBeInTheDocument();
  });

  it("fails closed when motion state is unknown", () => {
    mocks.allowMotion = null;
    render(<CommandRail />);
    act(() => vi.advanceTimersByTime(500));
    mocks.publish.mockClear();

    fireEvent.keyDown(window, { key: "w", repeat: false });

    expect(mocks.publish).not.toHaveBeenCalled();
    expect(screen.getAllByText(/motion state unknown/i).length).toBeGreaterThan(0);
  });

  it("gates drive controls when motion is disarmed", () => {
    mocks.allowMotion = false;
    render(<CommandRail />);
    act(() => vi.advanceTimersByTime(500));
    mocks.publish.mockClear();

    fireEvent.keyDown(window, { key: "w", repeat: false });

    expect(mocks.publish).not.toHaveBeenCalled();
    expect(
      screen.getAllByText(/motion disarmed/i).length,
    ).toBeGreaterThan(0);
  });

  it("does not gate drive controls on Ethernet connection — no automatic interlock (ugv_safety_monitor removed 2026-08-07)", () => {
    mocks.isEthernetConnected = true;
    render(<CommandRail />);
    act(() => vi.advanceTimersByTime(500));
    mocks.publish.mockClear();

    fireEvent.keyDown(window, { key: "w", repeat: false });

    expect(mocks.publish).toHaveBeenCalled();
    expect(screen.queryByText(/drive disabled/i)).not.toBeInTheDocument();
  });
});
