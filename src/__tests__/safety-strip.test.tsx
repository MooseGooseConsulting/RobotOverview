import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SafetyStrip } from '@/components/cockpit/SafetyStrip';

type MuxInput = {
  name: string;
  topic: string | null;
  priority: number | null;
  timeoutSec: number | null;
};

const mocks = vi.hoisted(() => ({
  voltage: null as number | null,
  powerSupplyStatus: null as number | null,
  voltageStale: false,
  voltageHasReceived: false,
  muxLockPriority: null as number | null,
  muxDataAgeSec: null as number | null,
  muxInputs: [] as Array<{
    name: string;
    topic: string | null;
    priority: number | null;
    timeoutSec: number | null;
  }>,
  muxHasReceived: false,
  muxStale: false,
  odomLinear: null as number | null,
  odomAngular: null as number | null,
  odomHasReceived: false,
  odomStale: false,
}));

vi.mock('@/lib/ros/client', () => ({
  useConnectionState: () => 'connected',
  useCockpitVoltage: () => ({
    voltage: mocks.voltage,
    current: null,
    powerSupplyStatus: mocks.powerSupplyStatus,
    present: null,
    stale: mocks.voltageStale,
    hasReceived: mocks.voltageHasReceived,
    receivedAt: 1_000,
  }),
  useCockpitMux: () => ({
    lockPriority: mocks.muxLockPriority,
    dataAgeSec: mocks.muxDataAgeSec,
    inputs: mocks.muxInputs,
    hasReceived: mocks.muxHasReceived,
    stale: mocks.muxStale,
    receivedAt: 1_000,
  }),
  useCockpitOdom: () => ({
    x: null,
    y: null,
    yaw: null,
    linearSpeed: mocks.odomLinear,
    angularSpeed: mocks.odomAngular,
    hasReceived: mocks.odomHasReceived,
    stale: mocks.odomStale,
    receivedAt: 1_000,
  }),
}));

const LADDER: MuxInput[] = [
  { name: 'joy_robot', topic: 'cmd_vel_joy_robot', priority: 150, timeoutSec: 0.5 },
  { name: 'ui', topic: 'cmd_vel_ui', priority: 50, timeoutSec: 0.5 },
  { name: 'nav', topic: 'cmd_vel_nav', priority: 10, timeoutSec: 0.5 },
];

function reset() {
  mocks.voltage = null;
  mocks.powerSupplyStatus = null;
  mocks.voltageStale = false;
  mocks.voltageHasReceived = false;
  mocks.muxLockPriority = null;
  mocks.muxDataAgeSec = null;
  mocks.muxInputs = [];
  mocks.muxHasReceived = false;
  mocks.muxStale = false;
  mocks.odomLinear = null;
  mocks.odomAngular = null;
  mocks.odomHasReceived = false;
  mocks.odomStale = false;
}

function muxLock() {
  return screen.getByText('Mux lock · cmd age').parentElement!;
}

function measuredMotion() {
  return screen.getByText('Measured motion · /odom').parentElement!;
}

// ── THE REGRESSION THIS FILE EXISTS FOR ─────────────────────────────────────
// The strip used to lead with DISARM / RE-ARM, driven by /ugv/allow_motion and
// /ugv/set_allow_motion — neither of which exists on BEAST-01. The control did
// nothing, and the gate behind it stopped the cockpit driving at all. Nothing
// here may put an arming control back without deleting a test.
describe('SafetyStrip has no motion-arming control', () => {
  beforeEach(reset);

  it('renders no DISARM or RE-ARM button', () => {
    render(<SafetyStrip />);
    expect(screen.queryByRole('button', { name: /DISARM/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /RE-ARM/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders no ARMED / DISARMED motion-state readout', () => {
    render(<SafetyStrip />);
    expect(screen.queryByText('Motion state')).not.toBeInTheDocument();
    expect(screen.queryByText('ARMED')).not.toBeInTheDocument();
    expect(screen.queryByText('DISARMED')).not.toBeInTheDocument();
  });

  it('says plainly that there is no software arm latch', () => {
    render(<SafetyStrip />);
    expect(screen.getByText(/No software arm latch/i)).toBeInTheDocument();
  });
});

describe('SafetyStrip active source', () => {
  beforeEach(reset);

  it('renders UNKNOWN before twist_mux has reported', () => {
    render(<SafetyStrip />);
    expect(within(muxLock()).getByText('UNKNOWN')).toBeInTheDocument();
  });

  it('reads NO LOCK — not UNKNOWN — when twist_mux reports lock priority 0', () => {
    mocks.muxHasReceived = true;
    mocks.muxLockPriority = 0;
    mocks.muxDataAgeSec = 0;
    mocks.muxInputs = LADDER;

    render(<SafetyStrip />);

    // "no lock is engaged" is an answer; "we have not heard" is not.
    expect(within(muxLock()).getByText('NO LOCK')).toBeInTheDocument();
    expect(within(muxLock()).queryByText('UNKNOWN')).not.toBeInTheDocument();
  });

  it('never names a rung as the winner — twist_mux does not publish one', () => {
    mocks.muxHasReceived = true;
    // 50 is the `ui` rung's priority. `current priority` is the LOCK priority,
    // so matching it against a rung would have named cmd_vel_ui as the winner
    // on nothing but a coincidence of numbers.
    mocks.muxLockPriority = 50;
    mocks.muxDataAgeSec = 0.04;
    mocks.muxInputs = LADDER;

    render(<SafetyStrip />);

    expect(within(muxLock()).queryByText('cmd_vel_ui')).not.toBeInTheDocument();
    expect(within(muxLock()).getByText('LOCKED #50')).toBeInTheDocument();
    expect(muxLock()).toHaveTextContent('0.04s');
  });
});

describe('SafetyStrip measured motion', () => {
  beforeEach(reset);

  it('renders UNKNOWN when /odom has never published', () => {
    render(<SafetyStrip />);
    expect(within(measuredMotion()).getByText('UNKNOWN')).toBeInTheDocument();
  });

  it('reads stationary at rest', () => {
    mocks.odomHasReceived = true;
    mocks.odomLinear = 0.0;
    mocks.odomAngular = 0.0;

    render(<SafetyStrip />);

    expect(within(measuredMotion()).getByText('stationary')).toBeInTheDocument();
  });

  it('reads wheels turning while the robot moves', () => {
    mocks.odomHasReceived = true;
    mocks.odomLinear = 0.12;
    mocks.odomAngular = 0.0;

    render(<SafetyStrip />);

    expect(within(measuredMotion()).getByText('WHEELS TURNING')).toBeInTheDocument();
    expect(measuredMotion()).toHaveTextContent('0.12 m/s');
  });

  it('marks the reading stale rather than dropping it', () => {
    mocks.odomHasReceived = true;
    mocks.odomStale = true;
    mocks.odomLinear = 0.12;
    mocks.odomAngular = 0.0;

    render(<SafetyStrip />);

    expect(within(measuredMotion()).getByText('STALE — last value shown')).toBeInTheDocument();
  });
});

describe('SafetyStrip voltage-only pack banner', () => {
  beforeEach(() => {
    reset();
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

  // The robot's BatteryState.percentage is voltage / 12.6, so any percent sign
  // next to the volts would be the same number twice, dressed as a charge level.
  it('never renders a state-of-charge percentage beside the volts', () => {
    mocks.voltage = 12.11;
    render(<SafetyStrip />);
    expect(screen.getByText('12.11 V')).toBeInTheDocument();
    expect(screen.queryByText(/96\s*%/)).not.toBeInTheDocument();
  });
});
