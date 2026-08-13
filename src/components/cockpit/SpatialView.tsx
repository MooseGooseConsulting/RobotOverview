'use client';

import { useEffect, useRef, useState } from 'react';
import {
  useCockpitScan,
  useCockpitOdom,
  LIDAR_CROP_SECTOR_DEG,
  rosBearingToCanvasOffset,
} from '@/lib/ros/client';
import { Target, Zap } from 'lucide-react';
import clsx from 'clsx';

const num = (v: number | null, digits: number) => (v === null ? '—' : v.toFixed(digits));

export function SpatialView() {
  const scan = useCockpitScan();
  const odom = useCockpitOdom();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [scale, setScale] = useState(40); // Pixels per meter

  // Live-ness is a property of the feed, not of the point count: a scan of
  // legitimately zero returns is not "offline", and a frozen last-good scan is
  // not "live". Both questions are answered by the slice's own freshness.
  const scanLive = scan.hasReceived && !scan.stale;
  const scanHz = scan.intervalMs && scan.intervalMs > 0 ? 1000 / scan.intervalMs : null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const Cx = W / 2;
    const Cy = H / 2;

    // Clear background
    ctx.clearRect(0, 0, W, H);

    // ── DRAW RANGE RINGS ─────────────────────────
    ctx.strokeStyle = 'rgba(54,224,224,0.08)';
    ctx.fillStyle = 'rgba(127,142,167,0.6)';
    ctx.font = '9px monospace';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);

    const rings = [1, 2, 3, 4, 5, 6];
    rings.forEach((m) => {
      ctx.beginPath();
      ctx.arc(Cx, Cy, m * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillText(`${m} m`, Cx + m * scale + 4, Cy - 4);
    });

    // Angle crosshairs
    ctx.strokeStyle = 'rgba(54,224,224,0.03)';
    ctx.beginPath();
    ctx.moveTo(0, Cy);
    ctx.lineTo(W, Cy);
    ctx.moveTo(Cx, 0);
    ctx.lineTo(Cx, H);
    ctx.stroke();

    // ── DRAW THE CROPPED BLIND SECTOR ─────────────
    // Built by sampling the SAME bearings the parser deletes and passing them
    // through the SAME ROS→canvas mapping the scan points use, so the wedge
    // cannot drift from the deletion. (It previously did — by 90°.) The wedge
    // is therefore a picture of the code, not an independent guess at it.
    const wedgeR = 6.5 * scale;
    const { startDeg, endDeg } = LIDAR_CROP_SECTOR_DEG;
    const STEPS = 48;
    ctx.fillStyle = 'rgba(239,68,68,0.05)';
    ctx.beginPath();
    ctx.moveTo(Cx, Cy);
    for (let i = 0; i <= STEPS; i++) {
      const deg = startDeg + ((endDeg - startDeg) * i) / STEPS;
      const { dx, dy } = rosBearingToCanvasOffset((deg * Math.PI) / 180);
      ctx.lineTo(Cx + dx * wedgeR, Cy + dy * wedgeR);
    }
    ctx.closePath();
    ctx.fill();

    // Label sits on the sector's own bisector, again through the same mapping.
    const midDeg = (startDeg + endDeg) / 2;
    const mid = rosBearingToCanvasOffset((midDeg * Math.PI) / 180);
    ctx.fillStyle = 'rgba(239,68,68,0.5)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      `BLIND SECTOR ${startDeg}°–${endDeg}° ROS`,
      Cx + mid.dx * wedgeR * 0.72,
      Cy + mid.dy * wedgeR * 0.72,
    );
    ctx.fillStyle = 'rgba(239,68,68,0.35)';
    ctx.fillText(
      'REAR MAST · VERIFIED 2026-08-10',
      Cx + mid.dx * wedgeR * 0.72,
      Cy + mid.dy * wedgeR * 0.72 + 11,
    );
    ctx.textAlign = 'start';

    // ── DRAW ROBOT GLYPH ──────────────────────────
    ctx.strokeStyle = '#36e0e0';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = '#0a0e17';

    const rw = 22; // width
    const rh = 34; // height
    ctx.beginPath();
    ctx.rect(Cx - rw / 2, Cy - rh / 2, rw, rh);
    ctx.fill();
    ctx.stroke();

    // Small wheels / tracks on the sides
    ctx.fillStyle = 'rgba(54, 224, 224, 0.2)';
    ctx.strokeStyle = 'rgba(54, 224, 224, 0.7)';
    ctx.lineWidth = 1;
    ctx.fillRect(Cx - rw / 2 - 5, Cy - rh / 2 + 2, 4, rh - 4);
    ctx.strokeRect(Cx - rw / 2 - 5, Cy - rh / 2 + 2, 4, rh - 4);
    ctx.fillRect(Cx + rw / 2 + 1, Cy - rh / 2 + 2, 4, rh - 4);
    ctx.strokeRect(Cx + rw / 2 + 1, Cy - rh / 2 + 2, 4, rh - 4);

    // Forward direction chevron / arrowhead pointing "up"
    ctx.strokeStyle = '#36e0e0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(Cx - 4, Cy - rh / 2 - 5);
    ctx.lineTo(Cx, Cy - rh / 2 - 10);
    ctx.lineTo(Cx + 4, Cy - rh / 2 - 5);
    ctx.stroke();

    // ── DRAW SCAN POINTS ──────────────────────────
    // A stale scan is drawn washed out, never in confident live cyan.
    if (scan.points.length > 0) {
      ctx.fillStyle = scanLive ? '#36e0e0' : 'rgba(127,142,167,0.35)';
      scan.points.forEach((pt) => {
        // ROS x forward / y left → canvas up / left, matching the wedge above.
        const px = Cx - pt.y * scale;
        const py = Cy - pt.x * scale;
        if (px >= 0 && px <= W && py >= 0 && py <= H) {
          ctx.fillRect(px - 1, py - 1, 2, 2);
        }
      });
    }
  }, [scan, scale, scanLive]);

  const zoomIn = () => setScale((s) => Math.min(100, s + 5));
  const zoomOut = () => setScale((s) => Math.max(15, s - 5));

  const chipCls = (live: boolean) =>
    clsx('chip border-rim rounded-full py-0.5 px-2.5', live ? 'text-emerald-400 border-emerald-500/20' : 'text-ink-dim');

  return (
    <section className="panel border-rim bg-panel/85 flex flex-col p-4 shadow-md">
      <div className="flex items-center justify-between gap-1.5 mb-3">
        <h2 className="font-display text-[11px] font-bold tracking-[0.16em] text-cyan uppercase flex items-center gap-1.5 leading-none">
          <Target className="h-3.5 w-3.5" /> Spatial{' '}
          <span className="text-ink-dim/70 font-normal font-mono text-[9.5px]">/scan · odom</span>
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={zoomOut}
            className="border border-rim bg-panel-2/45 hover:border-cyan/40 hover:text-cyan text-ink-dim font-mono text-[9px] px-1.5 py-0.5 rounded transition-all select-none"
            title="Zoom Out"
          >
            -
          </button>
          <span className="font-mono text-[9.5px] text-ink-dim min-w-8 text-center">{scale}px/m</span>
          <button
            onClick={zoomIn}
            className="border border-rim bg-panel-2/45 hover:border-cyan/40 hover:text-cyan text-ink-dim font-mono text-[9px] px-1.5 py-0.5 rounded transition-all select-none"
            title="Zoom In"
          >
            +
          </button>
        </div>
      </div>

      <div className="relative flex-1 min-h-[300px] border border-rim/60 rounded-lg overflow-hidden bg-hull/60 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width="500"
          height="450"
          className="w-full h-auto aspect-[10/9]"
          role="img"
          aria-label="LiDAR scan ring with robot glyph"
        />

        {/* The overlay tracks STALENESS, not emptiness: a scan that stopped
            arriving must say so even though the last points are still drawn. */}
        {!scanLive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-hull/40 backdrop-blur-[1px] gap-2 p-4 text-center">
            <Zap className="h-8 w-8 text-amber-500 animate-bounce" />
            <span className="font-mono text-xs text-glow-amber text-amber-400 font-bold uppercase tracking-wider">
              {scan.hasReceived ? 'Scan stale' : 'Telemetry offline'}
            </span>
            <span className="font-mono text-[10px] text-ink-dim max-w-[220px]">
              {scan.hasReceived
                ? 'No /scan message inside the freshness window — points shown are the last received.'
                : '/scan has published nothing since connect. Check beast-ros-base (use_lidar:=true), LD19 USB, and rosbridge topic allowlist.'}
            </span>
          </div>
        )}
      </div>

      {/* KEYROW */}
      <div className="flex gap-2 flex-wrap items-center mt-3 font-mono text-[9px] tracking-wider uppercase text-ink-dim">
        {/* Measured from arrival times — not a nominal rate typed into the UI. */}
        <span className={chipCls(scanLive)}>
          /scan {scanHz !== null && scanLive ? `${scanHz.toFixed(1)} Hz` : '—'}
        </span>
        <span
          className={clsx('chip border-rim rounded-full py-0.5 px-2.5', odom.hasReceived && !odom.stale ? 'text-cyan/90' : 'text-ink-dim')}
          title="EKF-fused odometry pose + speed"
        >
          {odom.hasReceived
            ? `EKF ${num(odom.x, 2)},${num(odom.y, 2)}m · ${num(odom.linearSpeed, 2)} m/s`
            : 'EKF — no /odom publisher'}
        </span>
        <span className="chip border-rim rounded-full py-0.5 px-2.5">map — Phase E</span>
      </div>
    </section>
  );
}
