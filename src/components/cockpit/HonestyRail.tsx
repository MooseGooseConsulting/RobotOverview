'use client';

import clsx from 'clsx';

// The rail exists to disclose what this cockpit CANNOT currently tell you.
// It is only worth anything if it tracks the real gaps, so it is updated with
// them — stale reassurance is worse than no rail at all.
const CHIPS: Array<{ tone: 'red' | 'amber'; text: string; title: string }> = [
              {
    tone: 'red',
    text: 'NO SOFTWARE E-STOP OR ARM LATCH',
    title:
      'There is no software motion latch on this stack and this cockpit does not pretend to offer one. /ugv/allow_motion and /ugv/set_allow_motion do not exist on BEAST-01 (checked against ros2 topic list, ros2 service list and the bridge allowlist, 2026-09-14), and beast-ros config/twist_mux.yaml removed the mux locks deliberately: stop authority is the robot-side collision monitor, the 0.5 s twist_mux source timeout, and the driver zeroing on shutdown. From the browser, stopping means releasing the key (five zeros go out) or Space; if those zeros do not leave the browser the cockpit says so and re-fires on reconnect. An operator who needs motion to stop regardless of the link stops it at the hardware.',
  },
  {
    tone: 'amber',
    text: 'BATTERY = VOLTS ONLY · NO SOC',
    title:
      'Pack volts are real (driver-board INA219, verified 2026-08-07). Signed current is real but logic-rail only — the INA219 shunt sits in the buck/5 V branch, so motor, servo, and IO loads never cross it (traced connectivity PWR-E003/E013–E020); treat it as the 5 V rail\'s draw, not whole-pack draw. /ugv/voltage.percentage is NOT a charge estimate on this robot: it is exactly voltage / 12.6 (measured 2026-09-14 — 12.1100 V reported alongside percentage 0.96111). It is therefore not displayed at all; the SafetyStrip shows volts and alarms on volts. Volts under load read low and on charge read high, so alerts suppress while CHARGING/FULL. Not a coulomb counter, and no OCV curve is in play.',
  },
  {
    tone: 'amber',
    text: 'IMU = /imu/raw · UNCAL · NOT FUSED',
    title: 'Nothing publishes /imu/data on this robot; the panel reads ugv_bringup /imu/raw.',
  },
  {
    tone: 'amber',
    text: 'NO DEPTH IMAGE IN THE BROWSER',
    title:
      'The depth tile shows nothing because the robot provides nothing it could show. depthai publishes /oak/stereo/image_raw/compressedDepth (a 12-byte header plus a 16-bit PNG depth buffer — not a viewable picture) and the colorized JPEG this cockpit used to read came from the retired legacy ugv_cockpit stack, which cannot run alongside the current one. Depth in the browser needs a colorizer node on the robot first. Live session 2026-07-31 negotiated USB SPEED: HIGH (USB 2.0) on the OAK — cable/path limited. Optics and scan stream live over rosbridge and are not persisted unless a bag/recorder is running.',
  },
  {
    tone: 'amber',
    text: 'LiDAR BLIND SECTOR UNVERIFIED',
    title:
      'The cropped body-frame 128°–232° sector (LIDAR_CROP_SECTOR_DEG) has never been checked against a live /scan. Verify with ros2 topic echo before trusting the wedge. Empty Spatial view usually means unreachable bridge, stale graph, or the LD19 not publishing — not a deliberate lidar-off boot.',
  },
  {
    tone: 'amber',
    text: 'PT JOINT FEEDBACK = COMMANDED, NOT MEASURED',
    title: 'The crosshair shows what we asked for, not where the head actually is.',
  },
  {
    tone: 'red',
    text: 'ESP32 COMMAND LATCH — UNRESOLVED',
    title:
      'The 2026-07-31 heartbeat-stop test found the ESP32 holding the last /cmd_vel for minutes after its publisher died, and this repo has recorded "no robot-side cmd_vel watchdog" since 2026-08-07. beast-ros config/twist_mux.yaml, by contrast, names an "ESP32 firmware command watchdog" as part of its stop story. These two claims contradict each other and neither has been re-tested on the current firmware. Until it is, drive as though the latch is real: the cockpit sends five explicit zeros on every release and re-fires them on reconnect, and twist_mux dropping an expired source does NOT itself publish a zero.',
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
