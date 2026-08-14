import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SafetyStrip } from '@/components/cockpit/SafetyStrip';

const mocks = vi.hoisted(() => ({
  allowMotion: true as boolean | null,
  isCharging: false,
  isEthernetConnected: false,
  receivedAt: 1_000,
  setMotionAllowed: vi.fn(),
  voltage: null as number | null,
  powerSupplyStatus: null as number | null,
  voltageStale: false,
  voltageHasReceived: false,
}));

vi.mock('@/lib/ros/client', () => ({
  rosClient: { setMotionAllowed: mocks.setMotionAllowed },
  useConnectionState: () => 'connected',
  useCockpitVoltage: () => ({
    voltage: mocks.voltage,
    current: null,
    powerSupplyStatus: mocks.powerSupplyStatus,
    present: null,
    stale: mocks.voltageStale,
    hasReceived: mocks.voltageHasReceived,
  }),
  useCockpitStatus: () => ({
    muxSource: null,
    cmdAge: null,
    pubCount: null,
    allowMotion: mocks.allowMotion,
    wifiRssi: null,
    diskFree: null,
    cpuTemp: null,
    gpuTemp: null,
    isCharging: mocks.isCharging,
    isEthernetConnected: mocks.isEthernetConnected,
    hasReceived: true,
    receivedAt: mocks.receivedAt,
    stale: false,
  }),
}));

function motionState() {
  return screen.getByText('Motion state').parentElement!;
}

describe('SafetyStrip motion authority', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    mocks.allowMotion = true;
    mocks.isCharging = false;
    mocks.isEthernetConnected = false;
    mocks.receivedAt = 1_000;
    mocks.voltage = null;
    mocks.powerSupplyStatus = null;
    mocks.voltageStale = false;
    mocks.voltageHasReceived = false;
    mocks.setMotionAllowed.mockReset();
    mocks.setMotionAllowed.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stays ARMED while charging — no automatic interlock (ugv_safety_monitor removed 2026-08-07)', () => {
    mocks.isCharging = true;

    render(<SafetyStrip />);

    expect(within(motionState()).getByText('ARMED')).toBeInTheDocument();
    expect(within(motionState()).queryByText('LOCKED')).not.toBeInTheDocument();
  });

  it('shows UNCONFIRMED as the primary state after a failed service call', async () => {
    mocks.setMotionAllowed.mockResolvedValue({ ok: false, message: 'bridge refused' });
    render(<SafetyStrip />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /DISARM/i }));
    });

    expect(within(motionState()).getByText('UNCONFIRMED')).toBeInTheDocument();
    expect(within(motionState()).queryByText('ARMED')).not.toBeInTheDocument();
  });

  it('keeps DISARM available so a failed call can be retried', async () => {
    mocks.setMotionAllowed
      .mockResolvedValueOnce({ ok: false, message: 'bridge refused' })
      .mockResolvedValue({ ok: true });
    render(<SafetyStrip />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /DISARM/i }));
    });

    const button = screen.getByRole('button', { name: /DISARM/i });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(mocks.setMotionAllowed).toHaveBeenCalledTimes(2);
    expect(mocks.setMotionAllowed).toHaveBeenLastCalledWith(false);
  });

  it('shows UNCONFIRMED when the service echo times out', () => {
    const view = render(<SafetyStrip />);
    fireEvent.click(screen.getByRole('button', { name: /DISARM/i }));

    mocks.receivedAt = 5_001;
    view.rerender(<SafetyStrip />);

    expect(within(motionState()).getByText('UNCONFIRMED')).toBeInTheDocument();
    expect(within(motionState()).queryByText('ARMED')).not.toBeInTheDocument();
  });

  it('keeps DISARM enabled and calls the safe direction when state is unknown', () => {
    mocks.allowMotion = null;
    render(<SafetyStrip />);
    const button = screen.getByRole('button', { name: /DISARM/i });

    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(mocks.setMotionAllowed).toHaveBeenCalledWith(false);
  });

  it('requires a two-second hold to re-arm from confirmed disarmed state', async () => {
    mocks.allowMotion = false;
    render(<SafetyStrip />);
    const button = screen.getByRole('button', { name: /RE-ARM/i });

    fireEvent.pointerDown(button);
    expect(mocks.setMotionAllowed).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1_999);
    });
    expect(mocks.setMotionAllowed).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(mocks.setMotionAllowed).toHaveBeenCalledWith(true);
  });

  it('suppresses the RE-ARM hold while UNCONFIRMED', async () => {
    mocks.allowMotion = false;
    mocks.setMotionAllowed.mockResolvedValue({ ok: false, message: 'bridge refused' });
    render(<SafetyStrip />);
    const button = screen.getByRole('button', { name: /RE-ARM/i });

    // A failed RE-ARM (service refused) leaves the robot state unknown.
    await act(async () => {
      fireEvent.pointerDown(button);
      vi.advanceTimersByTime(2_000);
      fireEvent.pointerUp(button);
    });

    expect(within(motionState()).getByText('UNCONFIRMED')).toBeInTheDocument();

    // While UNCONFIRMED the button must not re-arm: the hold is suppressed.
    mocks.setMotionAllowed.mockClear();
    fireEvent.pointerDown(button);
    await act(async () => {
      vi.advanceTimersByTime(2_500);
    });
    fireEvent.pointerUp(button);
    expect(mocks.setMotionAllowed).not.toHaveBeenCalled();

    // The safe direction stays available: a click retries DISARM.
    await act(async () => {
      fireEvent.click(button);
    });
    expect(mocks.setMotionAllowed).toHaveBeenCalledWith(false);
  });
});

describe('SafetyStrip voltage-only pack banner', () => {
  beforeEach(() => {
    mocks.allowMotion = true;
    mocks.voltage = null;
    mocks.powerSupplyStatus = null;
    mocks.voltageStale = false;
    mocks.voltageHasReceived = true;
  });

  it('shows no banner when voltage is absent', () => {
    mocks.voltageHasReceived = false;
    render(<SafetyStrip />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows no banner at 11.0 V', () => {
    mocks.voltage = 11.0;
    render(<SafetyStrip />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('warns at ≤ 10.8 V from voltage only', () => {
    mocks.voltage = 10.8;
    render(<SafetyStrip />);
    const banner = screen.getByRole('alert');
    expect(banner).toHaveTextContent('LOW PACK — 10.80 V — plan a charge stop');
    expect(banner).not.toHaveTextContent('%');
  });

  it('goes critical at ≤ 10.2 V from voltage only', () => {
    mocks.voltage = 10.2;
    render(<SafetyStrip />);
    const banner = screen.getByRole('alert');
    expect(banner).toHaveTextContent('CRITICAL PACK — 10.20 V — charge now, BMS cutoff near');
    expect(banner).not.toHaveTextContent('%');
  });

  it('suppresses a warn banner while charging', () => {
    mocks.voltage = 10.5;
    mocks.powerSupplyStatus = 1; // CHARGING
    render(<SafetyStrip />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('suppresses a critical banner while full', () => {
    mocks.voltage = 10.0;
    mocks.powerSupplyStatus = 4; // FULL
    render(<SafetyStrip />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('suppresses the banner when the voltage slice is stale', () => {
    mocks.voltage = 10.0;
    mocks.voltageStale = true;
    render(<SafetyStrip />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
