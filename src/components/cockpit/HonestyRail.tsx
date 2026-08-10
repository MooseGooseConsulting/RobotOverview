'use client';

import clsx from 'clsx';

// The rail exists to disclose what this cockpit CANNOT currently tell you.
// It is only worth anything if it tracks the real gaps, so it is updated with
// them — stale reassurance is worse than no rail at all.
const CHIPS: Array<{ tone: 'red' | 'amber'; text: string; title: string }> = [
              {
    tone: 'amber',
    text: 'E-STOP = DIRECT MANUAL LATCH',
    title:
      'Software E-STOP provides direct latching for teleop sessions.',
  },
  {
    tone: 'amber',
    text: 'BATTERY % = NOT SHOWN, BY DESIGN',
    title:
      'Pack volts are real (driver-board INA219, verified 2026-08-07). Signed current is real but logic-rail only — the INA219 shunt sits in the buck/5 V branch, so motor, servo, and IO loads never cross it (traced connectivity PWR-E003/E013–E020); treat it as the 5 V rail\'s draw, not whole-pack draw. No honest state-of-charge exists yet — the OCV table is a generic 3S curve awaiting calibration from logged data, and the old "percentage" was a fake V/12.6. A % appears here only once it is earned.',
  },
  {
    tone: 'amber',
    text: 'IMU = /imu/raw · UNCAL · NOT FUSED',
    title: 'Nothing publishes /imu/data on this robot; the panel reads ugv_bringup /imu/raw.',
  },
  {
    tone: 'amber',
    text: 'OAK DEPTH = PASSIVE STEREO · USB2',
    title:
      'Depth is Luxonis stereo → TURBO JPEG for the browser, not a cleaned point cloud. Textureless/dark scenes look like noise. Live session 2026-07-31 negotiated USB SPEED: HIGH (USB 2.0) — cable/path limited; SUPER needs a known-USB3 path. Not a recorded archive: optics/scan stream live over rosbridge and are not persisted unless a bag/recorder is running.',
  },
  {
    tone: 'amber',
    text: 'LiDAR BLIND SECTOR UNVERIFIED',
    title:
      'The cropped 45°–134.5° sector has never been checked against a live /scan. Verify with ros2 topic echo before trusting the wedge. Boot stack is use_lidar:=true on beast-ros-base; empty Spatial view usually means unreachable bridge, stale graph, or the LD19 not publishing — not a deliberate lidar-off boot.',
  },
  {
    tone: 'amber',
    text: 'PT JOINT FEEDBACK = COMMANDED, NOT MEASURED',
    title: 'The crosshair shows what we asked for, not where the head actually is.',
  },
  {
    tone: 'red',
    text: 'ESP32: NO HEARTBEAT',
    title:
      'The ESP32 has no firmware heartbeat and latches the last /cmd_vel; motion is stopped by the allow_motion gate and the unconditional boot stop.',
  },
];

export function HonestyRail() {
  return (
    <footer className="panel border-rim bg-panel/85 flex flex-wrap items-center gap-3 p-3 shadow-sm relative overflow-hidden">
      {/* Scanline sheen */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.015)_0_1px,transparent_1px_3px)] opacity-50" />

      <span className="hud-label font-bold text-[10px] uppercase tracking-[0.14em] text-ink-dim/95 mr-1.5 z-10 select-none">
        Honesty rail
      </span>

      <div className="flex flex-wrap items-center gap-1.5 z-10 font-mono text-[9px] uppercase tracking-widest leading-none">
        {CHIPS.map((chip) => (
          <span
            key={chip.text}
            title={chip.title}
            className={clsx(
              'chip py-1.5 px-3 rounded-full flex items-center gap-2 cursor-help',
              chip.tone === 'red'
                ? 'border-red-500/35 bg-red-950/20 text-red-500'
                : 'border-amber-500/35 bg-amber-950/20 text-amber-500',
            )}
          >
            <span
              className={clsx(
                'h-1 w-1 rounded-full',
                chip.tone === 'red' ? 'bg-red-500 shadow-[0_0_4px_#ef4444]' : 'bg-amber-500 shadow-[0_0_4px_#f59e0b]',
              )}
            />
            {chip.text}
          </span>
        ))}
      </div>
    </footer>
  );
}
