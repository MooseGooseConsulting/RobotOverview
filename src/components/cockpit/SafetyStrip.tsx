'use client';

import { useCockpitVoltage, useCockpitMux, useCockpitOdom, useConnectionState } from '@/lib/ros/client';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { ShieldAlert, HelpCircle } from 'lucide-react';

/** Rendered wherever the robot has told us nothing. Never a default value. */
function Unknown({ reason = 'no publisher' }: { readonly reason?: string }) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-ink-dim/80" title={`UNKNOWN — ${reason}`}>
      <HelpCircle className="h-3 w-3" aria-hidden="true" />
      UNKNOWN
    </span>
  );
}

// ── WHAT THIS STRIP IS NOT, ANY MORE ────────────────────────────────────────
// It used to lead with a DISARM / RE-ARM button and an ARMED/DISARMED readout
// driven by `/ugv/allow_motion` and `/ugv/set_allow_motion`. Neither the topic
// nor the service exists on BEAST-01 — checked against `ros2 topic list`,
// `ros2 service list`, and the bridge allowlist on 2026-09-14 — so the readout
// was permanently UNKNOWN and the button called into nothing. The stack removed
// that latch deliberately (beast-ros `config/twist_mux.yaml`: "There are
// deliberately NO locks"), so it is not replaced with a new interlock here.
//
// The three tiles below are what the robot really publishes while you drive:
// who holds the mux, whether the wheels are actually turning, and pack volts.
export function SafetyStrip() {
  const volts = useCockpitVoltage();
  const mux = useCockpitMux();
  const odom = useCockpitOdom();
  const connection = useConnectionState();

  const connected = connection === 'connected';

  // Voltage track bounds: 9.0 V = 3.0 V/cell, the OCV table's floor for a 3S
  // pack (table-derived, not an observed brownout — the former 8.8 V mark was
  // an unsourced figure, removed 2026-08-07). 12.6 V = 4.2 V/cell full.
  const minVolts = 9.0;
  const maxVolts = 12.6;
  const motionFloorVolts = 10.5;
  // Derived, never hardcoded: a retyped percentage silently lies when a bound
  // changes (the old tick was pinned at 44.7% against an 8.8–12.6 span).
  const motionFloorPct = ((motionFloorVolts - minVolts) / (maxVolts - minVolts)) * 100;
  const voltage = volts.voltage;
  const voltPct =
    voltage === null ? 0 : Math.max(0, Math.min(100, ((voltage - minVolts) / (maxVolts - minVolts)) * 100));
  const isLowVoltage = voltage !== null && voltage < motionFloorVolts;
  const voltStale = volts.stale && volts.hasReceived;
  // VOLTS ONLY. `BatteryState.percentage` from this robot is exactly
  // voltage / 12.6 (measured 2026-09-14: 12.1100 V ↔ 0.96111), so the "96%" it
  // used to render beside the volts was the same number twice, dressed as a
  // charge estimate. Alerts are on volts, suppressed while charging because a
  // pack under charge reads high and a pack under load reads low.
  //   warn:     ≤ 10.8 V
  //   critical: ≤ 10.2 V
  const psStatus = volts.powerSupplyStatus ?? null;
  const isChargingNow = psStatus === 1 || psStatus === 4; // CHARGING | FULL
  const packLevel: 'ok' | 'warn' | 'critical' =
    voltStale || isChargingNow || voltage === null
      ? 'ok'
      : voltage <= 10.2
        ? 'critical'
        : voltage <= 10.8
          ? 'warn'
          : 'ok';
  // Current is pre-gated at ingest: non-null only when the publisher filled
  // power_supply_status (a real measurement, not bringup's dummy 0.0).
  const current = voltStale ? null : (volts.current ?? null);

  // twist_mux's own report. What it publishes is the LOCK priority (0 = no lock
  // engaged) and the age of the command it forwarded — never the winning rung,
  // so this tile reports the lock and does not name a source.
  const muxLive = mux.hasReceived && !mux.stale;
  const locked = mux.lockPriority !== null && mux.lockPriority > 0;

  // Measured motion, from /odom. This is what the robot DID, as against the
  // commanded twist the CommandRail prints — the two are deliberately separate
  // readouts, because commanded yaw is known to under-deliver on this chassis.
  const odomLive = odom.hasReceived && !odom.stale;
  const moving =
    odomLive &&
    odom.linearSpeed !== null &&
    odom.angularSpeed !== null &&
    (Math.abs(odom.linearSpeed) > 0.01 || Math.abs(odom.angularSpeed) > 0.02);

  return (
    <motion.section
      className="panel border-rim bg-panel/85 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 p-4 items-stretch shadow-md relative overflow-hidden"
      aria-label="Safety strip"
    >
      {/* SCANLINE SHEEN EFFECT */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.015)_0_1px,transparent_1px_3px)] opacity-50" />

      {/* ── PACK ALERT BANNER (persistent while low) ── */}
      {packLevel !== 'ok' && (
        <div
          role="alert"
          className={clsx(
            'col-span-full z-10 flex items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-[11px] font-bold tracking-wider uppercase',
            packLevel === 'critical'
              ? 'border-red-500 bg-red-950/70 text-red-300 text-glow-red animate-pulse'
              : 'border-amber-500/60 bg-amber-950/50 text-amber-300 text-glow-amber',
          )}
        >
          <ShieldAlert className="h-4 w-4 shrink-0" />
          {packLevel === 'critical'
            ? `CRITICAL PACK — ${voltage?.toFixed(2)} V — charge now, BMS cutoff near`
            : `LOW PACK — ${voltage?.toFixed(2)} V — plan a charge stop`}
        </div>
      )}

      {/* ── MUX LOCK ────────────────────────────── */}
      <div className="flex flex-col justify-center min-w-0 z-10">
        <span className="hud-label text-[10px]">Mux lock · cmd age</span>
        <span
          className={clsx(
            'font-mono text-lg font-bold tracking-wide mt-0.5 truncate',
            mux.stale ? 'text-ink-dim line-through' : 'text-ink-dim',
          )}
        >
          {!mux.hasReceived ? (
            <Unknown reason="twist_mux has not reported on /diagnostics" />
          ) : locked ? (
            <span className="text-red-400 text-glow-red font-extrabold">
              LOCKED #{mux.lockPriority}
            </span>
          ) : (
            <span className={clsx(muxLive && 'text-cyan text-glow-cyan font-extrabold')}>
              NO LOCK
            </span>
          )}
          <span className="text-sm font-medium ml-1">
            {mux.dataAgeSec !== null ? `· ${mux.dataAgeSec.toFixed(2)}s` : '· —'}
          </span>
        </span>
        <span className="font-mono text-[10px] text-ink-dim truncate mt-1">
          {mux.hasReceived
            ? `${mux.inputs.length} rungs · winning source not published`
            : 'twist_mux: Twist mux status'}
        </span>
        {/* The absence of an arming control is a fact about the robot, so say
            it here rather than leaving an operator hunting for the button. */}
        <span className="font-mono text-[9px] text-ink-dim/70 leading-tight mt-1">
          No software arm latch on this stack — stop authority is the robot&apos;s collision
          monitor, twist_mux&apos;s 0.5 s source timeout, and the zero sent on release.
        </span>
      </div>

      {/* ── MEASURED MOTION (/odom) ─────────────── */}
      <div className="flex flex-col justify-center min-w-0 z-10">
        <span className="hud-label text-[10px]">Measured motion · /odom</span>
        {!odom.hasReceived ? (
          <span className="font-mono text-lg font-bold tracking-wide mt-0.5 flex items-center gap-1.5">
            <Unknown reason="no /odom publisher" />
          </span>
        ) : (
          <span
            className={clsx(
              'font-mono text-lg font-bold tracking-wide mt-0.5 truncate',
              !odomLive
                ? 'text-ink-dim line-through decoration-1'
                : moving
                  ? 'text-emerald-400 text-glow-emerald'
                  : 'text-ink-dim',
            )}
          >
            {odom.linearSpeed === null ? '—' : odom.linearSpeed.toFixed(2)} m/s ·{' '}
            {odom.angularSpeed === null ? '—' : odom.angularSpeed.toFixed(2)} rad/s
          </span>
        )}
        <span className="font-mono text-[10px] text-ink-dim truncate mt-1">
          {!odom.hasReceived
            ? '—'
            : !odomLive
              ? 'STALE — last value shown'
              : moving
                ? 'WHEELS TURNING'
                : 'stationary'}
        </span>
        {/* Achieved, not commanded: the CommandRail prints what left the
            browser, and these two disagreeing is information, not a bug. */}
        <span className="font-mono text-[9px] text-ink-dim/70 leading-tight mt-1">
          What the robot did — compare against the commanded X/Z in the teleop panel.
        </span>
      </div>

      {/* ── VOLTAGE TRACK BAR ───────────────────── */}
      <div className="flex flex-col justify-center z-10 sm:col-span-2 md:col-span-1 min-w-0 col-span-1">
        <div className="flex items-baseline justify-between gap-1.5 flex-wrap">
          <span className="hud-label text-[10px]">Pack bus</span>
          <span
            className={clsx(
              'font-mono text-lg font-black',
              voltage === null || voltStale
                ? 'text-ink-dim line-through decoration-1'
                : packLevel === 'critical'
                  ? 'text-red-400 text-glow-red'
                  : packLevel === 'warn' || isLowVoltage
                    ? 'text-amber-400 text-glow-amber'
                    : 'text-cyan text-glow-cyan',
            )}
          >
            {voltage === null ? '— V' : `${voltage.toFixed(2)} V`}
          </span>
        </div>

        {/* TRACKBAR BAR */}
        <div className="relative h-2.5 rounded-full bg-hull border border-rim/60 overflow-visible mt-2">
          {voltage !== null && (
            <div
              className={clsx(
                'absolute inset-y-0 left-0 rounded-full transition-all duration-300',
                voltStale ? 'bg-zinc-700 opacity-50' : 'opacity-90',
                !voltStale &&
                  (isLowVoltage
                    ? 'bg-gradient-to-r from-red-500 to-amber-500'
                    : 'bg-gradient-to-r from-amber-500 to-emerald-400'),
              )}
              style={{ width: `${voltPct}%` }}
            />
          )}
          {/* Motion floor @ 10.5V — position derived from the track bounds */}
          <div
            className="absolute top-[-3px] bottom-[-3px] w-[1.5px] bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.5)]"
            style={{ left: `${motionFloorPct}%` }}
            title="10.5V Motion Floor"
          >
            <span className="absolute top-[-11px] left-[-4px] font-mono text-[6px] text-amber-500 font-bold scale-[0.8]">10.5</span>
          </div>
        </div>

        <div className="flex justify-between items-center mt-1.5 font-mono text-[8.5px] text-ink-dim leading-none">
          <span>
            {voltage === null
              ? connected
                ? 'no /ugv/voltage publisher'
                : 'offline'
              : voltStale
                ? 'STALE — last value shown'
                : packLevel === 'critical'
                  ? 'CRITICAL — CHARGE NOW'
                  : packLevel === 'warn'
                    ? 'LOW PACK — CHARGE SOON'
                    : isLowVoltage
                      ? 'LOW - CHARGE FIRST'
                      : 'Ok'}
          </span>
          {/* Measured logic-rail current — absent (not 0.0 A) until a publisher
              fills power_supply_status; positive = charging. The INA219 shunt
              sits in the buck/5 V branch only (ros_driver_path_edges.csv
              PWR-E003): motor, servo, and IO loads bypass it, so this is never
              whole-pack draw. */}
          {current !== null && (
            <span
              className={clsx(
                'font-bold',
                isChargingNow ? 'text-emerald-400' : 'text-ink-dim',
              )}
              title={
                isChargingNow
                  ? 'INA219 logic-rail current (excludes motors/servos/IO) — charging'
                  : 'INA219 logic-rail current (excludes motors/servos/IO) — discharging/idle'
              }
            >
              {isChargingNow ? 'CHG ' : ''}
              {(current * 1000).toFixed(0)} mA
            </span>
          )}
        </div>
      </div>
    </motion.section>
  );
}
