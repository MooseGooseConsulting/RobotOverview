'use client';

import { useEffect, useRef, useState } from 'react';
import {
  rosClient,
  useCockpitVoltage,
  useCockpitStatus,
  useConnectionState,
} from '@/lib/ros/client';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { ShieldAlert, ShieldCheck, HelpCircle } from 'lucide-react';

/** Rendered wherever the robot has told us nothing. Never a default value. */
function Unknown({ reason = 'no publisher' }: { readonly reason?: string }) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-ink-dim/80" title={`UNKNOWN — ${reason}`}>
      <HelpCircle className="h-3 w-3" aria-hidden="true" />
      UNKNOWN
    </span>
  );
}

/** RE-ARM requires the operator to hold the button this long. DISARM does not. */
const REARM_HOLD_MS = 2000;
/** How long after a successful service call we wait for the topic echo before
 * rendering UNCONFIRMED. The status slices re-render this component on every
 * aggregator tick, so the grace check re-evaluates without a timer. */
const ECHO_GRACE_MS = 4000;

export function SafetyStrip() {
  const volts = useCockpitVoltage();
  const status = useCockpitStatus();
  const connection = useConnectionState();

  const connected = connection === 'connected';

  // The last service call we made: its TARGET allow_motion and when. Rendered
  // state is derived, never synced by an effect. "Now" comes from the status
  // slice's own receivedAt — pure store state that advances on every aggregator
  // tick, so a silent bridge reads as UNCONFIRMED, not as "still waiting".
  //   target unmet + inside grace → "awaiting robot echo"
  //   target unmet + past grace   → UNCONFIRMED (the robot never echoed)
  //   target met                  → confirmed; the request is history
  const [request, setRequest] = useState<{ target: boolean; at: number } | null>(null);
  const [armFault, setArmFault] = useState<string | null>(null);
  const [holding, setHolding] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const targetMet = request !== null && status.allowMotion === request.target;
  const now = status.receivedAt ?? request?.at ?? 0;
  const awaitingEcho =
    request !== null && !targetMet && now - request.at < ECHO_GRACE_MS;
  const echoTimedOut =
    request !== null && !targetMet && !awaitingEcho;

  useEffect(() => () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
  }, []);

  const requestMotion = async (allow: boolean) => {
    setArmFault(null);
    setRequest({ target: allow, at: Date.now() });
    const result = await rosClient.setMotionAllowed(allow);
    if (!result.ok) {
      setRequest(null);
      setArmFault(
        `${allow ? 'RE-ARM' : 'DISARM'} UNCONFIRMED — ${result.message ?? 'service call failed'}. Robot state unknown; check /ugv/allow_motion.`,
      );
    }
  };

  const startRearmHold = () => {
    if (holdTimer.current || awaitingEcho) return;
    setHolding(true);
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      setHolding(false);
      void requestMotion(true);
    }, REARM_HOLD_MS);
  };

  const cancelRearmHold = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    setHolding(false);
  };

  const disarmed = status.allowMotion === false;
  const unconfirmed = !awaitingEcho && (armFault !== null || echoTimedOut);

  const armLabel = !connected
    ? 'OFFLINE'
    : awaitingEcho
      ? request?.target === false
        ? 'DISARMING…'
        : 'RE-ARMING…'
      : unconfirmed || status.allowMotion !== false
        ? 'DISARM'
        : holding
          ? 'KEEP HOLDING…'
          : 'RE-ARM · HOLD 2S';
  const armCaption = !connected
    ? 'offline'
    : unconfirmed
      ? 'UNCONFIRMED — click to disarm'
      : awaitingEcho
        ? 'awaiting robot echo'
        : status.allowMotion === null
          ? 'state unknown — disarm to be safe'
          : status.allowMotion
            ? 'one click — stops all motion'
            : 'hold to re-enable motion';
  // UNCONFIRMED never disables the button: the handlers force clicks to DISARM
  // and suppress the RE-ARM hold while unconfirmed, so the safe direction can
  // be retried; RE-ARM still requires the existing two-second hold.
  const armDisabled = !connected || awaitingEcho;
  const armBtnCls = !connected
    ? 'border-zinc-600 bg-zinc-900/40 text-zinc-500 cursor-not-allowed'
    : unconfirmed
      ? 'border-red-500 bg-red-950/60 text-red-300 shadow-hud-red text-glow-red'
      : disarmed
          ? 'border-emerald-500/50 bg-panel-2/40 text-emerald-400 hover:bg-emerald-950/30'
          : 'border-red-500/50 bg-panel-2/40 text-red-400 hover:bg-red-950/30';
  const armCaptionCls =
    !connected ? 'text-zinc-500' : unconfirmed ? 'text-red-300' : 'text-ink-dim';

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
  // SOC-aware pack alert: the pack died twice on 2026-08-10 with nothing
  // reaching the operator. OCV SOC reads low under load and high while
  // charging, so alerts are SUPPRESSED while charging (recovery is underway)
  // and use whichever signal reads worse. Absent only when BOTH voltage and
  // SOC are missing — a lone SOC still alarms.
  //   warn:     ≤ 10.8 V or SOC ≤ 25%
  //   critical: ≤ 10.2 V or SOC ≤ 8%
  const soc = volts.percentage ?? null;
  const psStatus = volts.powerSupplyStatus ?? null;
  const isChargingNow = psStatus === 1 || psStatus === 4; // CHARGING | FULL
  const packLevel: 'ok' | 'warn' | 'critical' =
    voltStale || isChargingNow || (voltage === null && soc === null)
      ? 'ok'
      : (voltage !== null && voltage <= 10.2) || (soc !== null && soc <= 0.08)
        ? 'critical'
        : (voltage !== null && voltage <= 10.8) || (soc !== null && soc <= 0.25)
          ? 'warn'
          : 'ok';
  // Current is pre-gated at ingest: non-null only when the publisher filled
  // power_supply_status (a real measurement, not bringup's dummy 0.0).
  const current = voltStale ? null : (volts.current ?? null);

  return (
    <motion.section
      className="panel border-rim bg-panel/85 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4 p-4 items-stretch shadow-md relative overflow-hidden"
      aria-label="Safety strip"
      animate={disarmed ? { borderColor: ["#404040", "#f59e0b", "#404040"] } : {}}
      transition={disarmed ? { repeat: Infinity, duration: 1.5 } : {}}
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
            ? `CRITICAL PACK — ${voltage?.toFixed(2)} V${soc !== null ? ` · ${(soc * 100).toFixed(0)}%` : ''} — charge now, BMS cutoff near`
            : `LOW PACK — ${voltage?.toFixed(2)} V${soc !== null ? ` · ${(soc * 100).toFixed(0)}%` : ''} — plan a charge stop`}
        </div>
      )}

      {/* ── MOTION AUTHORITY (DISARM / RE-ARM) ──── */}
      <button
        onClick={() => {
          if (unconfirmed || status.allowMotion !== false) void requestMotion(false);
        }}
        onPointerDown={() => {
          if (!unconfirmed && status.allowMotion === false) startRearmHold();
        }}
        onPointerUp={cancelRearmHold}
        onPointerLeave={cancelRearmHold}
        onPointerCancel={cancelRearmHold}
        disabled={armDisabled}
        className={clsx(
          'relative z-10 flex flex-col items-center justify-center gap-1.5 rounded-lg border px-4 py-3 font-display font-black tracking-widest text-sm transition-all shadow-inner select-none overflow-hidden',
          armBtnCls,
        )}
      >
        {/* Hold-to-confirm progress fill behind the RE-ARM label */}
        {holding && (
          <motion.div
            className="absolute inset-y-0 left-0 bg-emerald-500/25"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: REARM_HOLD_MS / 1000, ease: 'linear' }}
          />
        )}
        <span className="relative">{armLabel}</span>
        <small className={clsx('relative font-mono text-[9px] uppercase tracking-wider font-bold', armCaptionCls)}>
          {armCaption}
        </small>
      </button>

      {/* ── MOTION STATE ────────────────────────── */}
      <div className="flex flex-col justify-center min-w-0 z-10">
        <span className="hud-label text-[10px]">Motion state</span>
        {unconfirmed ? (
          <span className="font-mono text-lg font-bold tracking-wide mt-0.5 flex items-center gap-1.5 text-red-300 text-glow-red">
            <ShieldAlert className="h-4 w-4" /> UNCONFIRMED
          </span>
        ) : status.allowMotion === null ? (
          <span className="font-mono text-lg font-bold tracking-wide mt-0.5 flex items-center gap-1.5">
            <Unknown reason="no allow_motion publisher" />
          </span>
        ) : status.allowMotion ? (
          <span
            className={clsx(
              'font-mono text-lg font-bold tracking-wide flex items-center gap-1.5 mt-0.5',
              status.stale ? 'text-ink-dim line-through' : 'text-emerald-400 text-glow-emerald',
            )}
          >
            <ShieldCheck className="h-4 w-4" /> ARMED
          </span>
        ) : (
          <span
            className={clsx(
              'font-mono text-lg font-bold tracking-wide flex items-center gap-1.5 mt-0.5',
              status.stale ? 'text-ink-dim line-through' : 'text-amber-400 text-glow-amber',
            )}
          >
            <ShieldAlert className="h-4 w-4 animate-pulse" /> DISARMED
          </span>
        )}
        <span className="font-mono text-[10px] text-ink-dim truncate mt-1">
          {status.allowMotion === null
            ? '/ugv/allow_motion silent'
            : status.allowMotion
              ? 'motion permitted — ugv_bringup gate open'
              : 'disarmed via /ugv/set_allow_motion'}
        </span>
        {armFault && (
          <span className="font-mono text-[9.5px] text-red-400 leading-tight mt-1">{armFault}</span>
        )}
        {echoTimedOut && !armFault && (
          <span className="font-mono text-[9.5px] text-red-400 leading-tight mt-1">
            {request?.target === false ? 'DISARM' : 'RE-ARM'} UNCONFIRMED — service answered
            but no /ugv/allow_motion echo within {ECHO_GRACE_MS / 1000}s.
          </span>
        )}
      </div>

      {/* ── ACTIVE SOURCE ───────────────────────── */}
      <div className="flex flex-col justify-center min-w-0 z-10">
        <span className="hud-label text-[10px]">Active source · age</span>
        <span
          className={clsx(
            'font-mono text-lg font-bold tracking-wide mt-0.5 truncate',
            status.stale ? 'text-ink-dim line-through' : 'text-ink-dim',
          )}
        >
          {status.muxSource === null ? (
            <Unknown reason="/cockpit/status has no publisher" />
          ) : (
            <span className={clsx(!status.stale && 'text-cyan text-glow-cyan font-extrabold')}>
              {status.muxSource}
            </span>
          )}
          <span className="text-sm font-medium ml-1">
            {status.cmdAge !== null && status.cmdAge >= 0 ? `· ${status.cmdAge.toFixed(2)}s` : '· —'}
          </span>
        </span>
        <span className="font-mono text-[10px] text-ink-dim truncate mt-1">
          /cmd_vel publishers: {status.pubCount ?? '—'}
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
            {soc !== null && voltage !== null && (
              <span className="ml-1.5 text-xs font-bold text-ink-dim">
                {(soc * 100).toFixed(0)}%
              </span>
            )}
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
              ? 'no /ugv/voltage publisher'
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
