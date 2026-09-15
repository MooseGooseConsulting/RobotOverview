"use client";

import { useEffect, useRef } from "react";
import {
  useCockpitVoltage,
  useCockpitImu,
  useCockpitDiagnostics,
} from "@/lib/ros/client";
import clsx from "clsx";

const HISTORY = 50;

function formatStamp(ms: number | null): string {
  if (ms === null) return "--:--";
  return new Date(ms).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TelemetryRow() {
  const volts = useCockpitVoltage();
  const imu = useCockpitImu();
  const diags = useCockpitDiagnostics();

  const voltCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imuCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const voltHistoryRef = useRef<number[]>([]);
  const lastVoltSampleAtRef = useRef<number | null>(null);
  const imuHistoryRef = useRef<{ x: number; y: number; z: number }[]>([]);

  const voltage = volts.voltage;
  const voltLive = volts.hasReceived && !volts.stale;
  const imuLive = imu.hasReceived && !imu.stale;

  // ── VOLTAGE SPARKLINE ─────────────────────────────────────────────────────
  // Real samples only. There is no demo trace: an empty chart is the honest
  // rendering of "the robot has not sent a voltage", and a sine wave drawn at
  // ~10.45 V is indistinguishable from a real pack reading to anyone glancing
  // at the panel.
  useEffect(() => {
    if (
      voltage !== null &&
      volts.receivedAt !== null &&
      volts.receivedAt !== lastVoltSampleAtRef.current
    ) {
      const arr = voltHistoryRef.current;
      arr.push(voltage);
      if (arr.length > HISTORY) arr.shift();
      lastVoltSampleAtRef.current = volts.receivedAt;
    }

    const canvas = voltCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(54,224,224,0.03)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += 15) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    const getValY = (v: number) => {
      // 9.0 V = 3.0 V/cell OCV-table floor (table-derived; the former 8.8 V
      // bound was an unsourced brownout figure, removed 2026-08-07).
      const minV = 9.0;
      const maxV = 12.6;
      return H - ((v - minV) / (maxV - minV)) * H;
    };

    const floorY = getValY(10.5);
    ctx.strokeStyle = "rgba(245,158,11,0.25)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, floorY);
    ctx.lineTo(W, floorY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(245,158,11,0.45)";
    ctx.font = "8px monospace";
    ctx.fillText("10.5V FLOOR", 5, floorY - 3);

    const voltHistory = voltHistoryRef.current;
    if (voltHistory.length > 1) {
      ctx.strokeStyle = voltLive ? "#ffb020" : "rgba(127,142,167,0.4)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const step = W / (HISTORY - 1);
      ctx.moveTo(0, getValY(voltHistory[0]));
      for (let i = 1; i < voltHistory.length; i++) {
        ctx.lineTo(i * step, getValY(voltHistory[i]));
      }
      ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(127,142,167,0.45)";
      ctx.font = "9px monospace";
      ctx.fillText("NO VOLTAGE DATA", 8, H / 2);
    }
  }, [voltage, voltLive, volts.receivedAt]);

  // ── IMU SPARKLINE ─────────────────────────────────────────────────────────
  // Same rule as voltage: no invented "quiet stationary waves". A stationary
  // robot produces a flat real trace; a fabricated one produces motion that
  // never happened.
  useEffect(() => {
    if (
      imu.hasReceived &&
      imu.gx !== null &&
      imu.gy !== null &&
      imu.gz !== null
    ) {
      const arr = imuHistoryRef.current;
      arr.push({ x: imu.gx, y: imu.gy, z: imu.gz });
      if (arr.length > HISTORY) arr.shift();
    }

    const canvas = imuCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(54,224,224,0.03)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += 15) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(127,142,167,0.15)";
    ctx.beginPath();
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2);
    ctx.stroke();

    const getImuY = (val: number) => H / 2 - val * (H / 4.0);

    const imuHistory = imuHistoryRef.current;
    if (imuHistory.length > 1) {
      const step = W / (HISTORY - 1);
      const axes: Array<[keyof (typeof imuHistory)[number], string]> = [
        ["x", "#36e0e0"],
        ["y", "#ffb020"],
        ["z", "#10b981"],
      ];
      axes.forEach(([axis, color]) => {
        ctx.strokeStyle = imuLive ? color : "rgba(127,142,167,0.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, getImuY(imuHistory[0][axis]));
        for (let i = 1; i < imuHistory.length; i++) {
          ctx.lineTo(i * step, getImuY(imuHistory[i][axis]));
        }
        ctx.stroke();
      });
    } else {
      ctx.fillStyle = "rgba(127,142,167,0.45)";
      ctx.font = "9px monospace";
      ctx.fillText("NO IMU DATA", 8, H / 2 - 6);
    }
  }, [imu, imuLive]);

  const hasDiagnostics = diags.items.length > 0;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {/* ── VOLTAGE SPARKLINE ─────────────────────── */}
      <section className="panel border-rim bg-panel/85 p-4 shadow-md flex flex-col">
        <h2 className="font-display text-[11px] font-bold tracking-[0.16em] text-cyan uppercase leading-none mb-3 flex items-center justify-between">
          <span>
            Pack voltage{" "}
            <span className="text-ink-dim/70 font-normal font-mono text-[9.5px]">
              /ugv/voltage · real volts only
            </span>
          </span>
          {volts.hasReceived && volts.stale && (
            <span className="chip border-amber-500/25 bg-amber-500/10 text-amber-500 rounded-full px-2 py-0.5 text-[8.5px] scale-[0.85] font-bold">
              stale
            </span>
          )}
        </h2>
        <div className="relative border border-rim/50 bg-hull/65 rounded-lg overflow-hidden flex-1 h-20">
          <canvas
            ref={voltCanvasRef}
            width="400"
            height="80"
            className="w-full h-full"
          />
        </div>
      </section>

      {/* ── IMU SPARKLINE ─────────────────────────── */}
      <section className="panel border-rim bg-panel/85 p-4 shadow-md flex flex-col">
        <h2 className="font-display text-[11px] font-bold tracking-[0.16em] text-cyan uppercase flex items-center justify-between leading-none mb-3">
          {/* Relabelled: nothing publishes /imu/data on this robot. */}
          <span>
            IMU{" "}
            <span className="text-ink-dim/70 font-normal font-mono text-[9.5px]">
              /imu/raw
            </span>
          </span>
          <span className="chip border-amber-500/25 bg-amber-500/10 text-amber-500 rounded-full px-2 py-0.5 text-[8.5px] scale-[0.85] font-bold">
            uncal · not fused
          </span>
        </h2>
        <div className="relative border border-rim/50 bg-hull/65 rounded-lg overflow-hidden flex-1 h-20">
          <canvas
            ref={imuCanvasRef}
            width="400"
            height="80"
            className="w-full h-full"
          />
        </div>
      </section>

      {/* ── OPS LOG / DIAGNOSTICS TICKER ─────────── */}
      <section className="panel border-rim bg-panel/85 p-4 shadow-md flex flex-col tickerwrap">
        <h2 className="font-display text-[11px] font-bold tracking-[0.16em] text-cyan uppercase leading-none mb-3">
          Ops log{" "}
          <span className="text-ink-dim/70 font-normal font-mono text-[9.5px]">
            /diagnostics
          </span>
        </h2>

        {/* Event List — real diagnostics only. The previous placeholder entries
            (bag closed, OAK first light, pack at floor, beast-ros-base active)
            were invented and read exactly like live robot events. */}
        <div className="ticker flex flex-col gap-1.5 flex-1 select-none font-mono text-[10.5px]">
          {hasDiagnostics ? (
            diags.items.slice(0, 4).map((d, index) => (
              <div
                key={`${d.name}-${index}`}
                className={clsx(
                  "ev flex items-baseline gap-2.5",
                  diags.stale && "opacity-50",
                  d.level === 2
                    ? "text-rose-400"
                    : d.level === 1
                      ? "text-amber-500"
                      : "text-emerald-400",
                )}
              >
                {/* Robot's own header stamp, not the moment this rendered. */}
                <span className="text-ink-dim font-medium shrink-0">
                  {formatStamp(d.stampMs)}
                </span>
                <span className="truncate leading-none">
                  <b className="font-bold mr-1.5 uppercase">
                    {d.name.split("/").pop() || d.name}
                  </b>
                  — {d.message}
                </span>
              </div>
            ))
          ) : (
            <div className="flex flex-1 items-center justify-center text-center">
              <span className="font-mono text-[10px] text-ink-dim/70 leading-relaxed">
                No /diagnostics received.
                <br />
                Nothing to show.
              </span>
            </div>
          )}
        </div>

        {/* Recording buttons */}
        <div className="flex items-center justify-between gap-2.5 border-t border-rim/50 pt-2.5 mt-3 leading-none">
          {/* M5: no recording service exists robot-side. A button that toggles a
              local boolean and calls it "BAG RECORDING ON" is a lie. */}
          <button
            disabled
            title="No recording service exists on the robot"
            className="btn rounded-md border border-rim/40 bg-panel-2/20 font-mono px-3 py-1.5 text-[9.5px] uppercase tracking-wider select-none flex flex-col items-start gap-0.5 text-zinc-600 cursor-not-allowed"
          >
            <span className="flex items-center gap-2 font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-700" /> REC
              MISSION BAG
            </span>
            <span className="text-[8px] tracking-normal normal-case text-zinc-600">
              not wired
            </span>
          </button>

          {/* The Wi-Fi RSSI / Jetson temperature / disk-free chips that sat here
              all read /cockpit/status, a topic this stack never publishes, so
              all three rendered a permanent em-dash. Removed 2026-09-14; the
              honest statement of the gap is cheaper than three dead gauges. */}
          <span
            className="hud-label font-mono text-[9px] scale-90 text-ink-dim/70"
            title="Wi-Fi RSSI, Jetson CPU/GPU temperature and disk free came from /cockpit/status, which no node on this stack publishes."
          >
            host metrics · no publisher
          </span>
        </div>
      </section>
    </div>
  );
}
