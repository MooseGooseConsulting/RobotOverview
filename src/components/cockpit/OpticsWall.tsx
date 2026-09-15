'use client';

import { useEffect, useRef, useState } from 'react';
import { rosClient } from '@/lib/ros/client';
import { Eye, Video } from 'lucide-react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

/** Above this the picture is old enough to mislead an operator who is driving. */
const LATENCY_ALARM_MS = 500;

type FeedState = { fps: number; active: boolean; latencyMs: number | null };
const IDLE_FEED: FeedState = { fps: 0, active: false, latencyMs: null };

export function OpticsWall() {
  const rgbRef = useRef<HTMLImageElement | null>(null);

  // Frame counts live in refs so inbound frames never re-render React (the
  // image bytes go straight to <img>.src). Only the once-a-second FPS tick
  // touches state.
  const rgbFrameCount = useRef(0);
  const rgbLatency = useRef<number | null>(null);
  const [rgb, setRgb] = useState<FeedState>(IDLE_FEED);

  // Sample the frame counters once per second for FPS + liveness.
  useEffect(() => {
    const timer = setInterval(() => {
      const r = rgbFrameCount.current;
      setRgb({ fps: r, active: r > 0, latencyMs: rgbLatency.current });
      rgbFrameCount.current = 0;
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ── ONE LIVE FEED ─────────────────────────────────────────────────────────
  // The depth subscription (/cockpit/depth/compressed) was removed 2026-09-14:
  // its only producer was the colorizer in the retired legacy ugv_cockpit
  // package, and the bridge allowlist refuses the topic by name. The overhead
  // clearance chip went with it (/cockpit/overhead_clearance has no publisher
  // anywhere in the stack). Both rendered as permanent "AWAITING…" panels.
  useEffect(() => {
    const unsubRgb = rosClient.registerImageCallback('/oak/rgb/image_raw/compressed', (frame) => {
      if (rgbRef.current) rgbRef.current.src = frame.src;
      rgbFrameCount.current += 1;
      rgbLatency.current = frame.latencyMs;
    });
    return unsubRgb;
  }, []);

  const laggy = (f: FeedState) => f.active && f.latencyMs !== null && f.latencyMs > LATENCY_ALARM_MS;

  const latencyChip = (f: FeedState) => {
    if (!f.active) return <span className="text-ink-dim">0.0 FPS</span>;
    return (
      <span className={clsx('font-bold', laggy(f) ? 'text-rose-400' : 'text-emerald-400')}>
        {f.fps.toFixed(1)} FPS
        {f.latencyMs !== null && <span className="ml-1 font-normal">· {f.latencyMs.toFixed(0)} ms</span>}
      </span>
    );
  };

  return (
    <section className="panel border-rim bg-panel/85 flex flex-col p-4 shadow-md">
      <div className="flex items-center justify-between gap-1.5 mb-3">
        <h2 className="font-display text-[11px] font-bold tracking-[0.16em] text-cyan uppercase flex items-center gap-1.5 leading-none">
          <Eye className="h-3.5 w-3.5" /> Optics{' '}
          <span className="text-ink-dim/70 font-normal font-mono text-[9.5px]">/compressed transports over bridge</span>
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3 flex-1">
        {/* ── OAK RGB FEED (WIDE) ────────────────── */}
        <div
          className={clsx(
            'relative rounded-lg overflow-hidden border bg-hull aspect-[21/9] col-span-2 flex items-center justify-center group transition-transform hover:scale-[1.005]',
            laggy(rgb) ? 'border-rose-500/70' : 'border-rim/70',
          )}
        >
          {/* Scanline sheen */}
          <div className="pointer-events-none absolute inset-0 z-20 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.15)_0_1px,transparent_1px_3px)] opacity-30" />

          {/* Fallback pattern */}
          <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_68%_78%,rgba(245,158,11,0.14),transparent_34%),radial-gradient(circle_at_30%_60%,rgba(122,242,242,0.08),transparent_45%),linear-gradient(180deg,#1c2130_0%,#090d16_100%)] opacity-80" />

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={rgbRef}
            alt="RGB Video Feed"
            className={clsx(
              'absolute inset-0 w-full h-full object-cover z-10',
              !rgb.active && 'hidden',
              // A late frame is not a live view. Wash it out rather than let it
              // read as the robot's current surroundings.
              laggy(rgb) && 'opacity-30 grayscale',
            )}
          />
          
          {rgb.active && (
            <motion.svg
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 pointer-events-none z-20 text-emerald-500/50 mix-blend-screen"
              viewBox="0 0 100 100"
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <path d="M 30 20 L 20 20 L 20 30 M 70 20 L 80 20 L 80 30 M 20 70 L 20 80 L 30 80 M 80 70 L 80 80 L 70 80 M 50 40 L 50 60 M 40 50 L 60 50" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </motion.svg>
          )}

          {laggy(rgb) && (
            <div className="absolute inset-0 z-20 flex items-center justify-center">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-rose-300 bg-hull/70 px-2 py-1 rounded">
                Feed lagging {rgb.latencyMs?.toFixed(0)} ms — do not drive on this
              </span>
            </div>
          )}

          {/* OAK RGB Tags */}
          <span className="absolute left-3 top-3 z-30 chip border-rim/70 bg-hull/80 text-ink-dim py-0.5 px-2 rounded-full font-mono text-[9px] tracking-wider uppercase flex items-center gap-1">
            <span className={clsx('h-1 w-1 rounded-full', rgb.active ? 'bg-emerald-500 shadow-[0_0_4px_#34d399]' : 'bg-zinc-600')} /> OAK RGB
          </span>

          <span className="absolute right-3 top-3 z-30 chip border-rim/70 bg-hull/80 py-0.5 px-2 rounded-full font-mono text-[9px] tracking-wider uppercase flex items-center gap-1">
            {latencyChip(rgb)}
          </span>

          {!rgb.active && (
            <div className="z-10 flex flex-col items-center gap-1 text-center font-mono opacity-60">
              <Video className="h-6 w-6 text-ink-dim/40 animate-pulse" />
              <span className="text-[10px] text-ink-dim tracking-wider">AWAITING CAMERA STREAM</span>
            </div>
          )}

          <div className="absolute left-3 right-3 bottom-2 z-30 flex justify-between items-center font-mono text-[8px] text-ink-dim/85 uppercase leading-none bg-hull/30 backdrop-blur-[1px] py-1 px-1.5 rounded">
            {/* Resolution/encoding are robot-side pipeline config we cannot read
                from here — measured rate above is the honest claim. */}
            <span>compressed · queue 1</span>
            <span>USB2 · HIGH — USB3 CABLE PENDING</span>
          </div>
        </div>

        {/* ── OAK DEPTH (NOT PROVIDED) ───────────────
            Not "awaiting" — this robot has no browser-renderable depth feed at
            all, and saying so is the whole point of this tile. depthai publishes
            /oak/stereo/image_raw/compressedDepth, which the bridge does allow us
            to read, but `compressedDepth` is a 12-byte header plus a 16-bit PNG:
            it is a depth buffer, not a picture, and an <img> cannot show it. The
            colorized JPEG this panel used to read came from the legacy
            ugv_cockpit stack, which cannot run alongside the current one. */}
        <div className="relative rounded-lg overflow-hidden border border-rim/70 bg-hull aspect-[4/3] flex items-center justify-center">
          <div className="pointer-events-none absolute inset-0 z-20 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.15)_0_1px,transparent_1px_3px)] opacity-30" />

          <span className="absolute left-3 top-3 z-30 chip border-rim/70 bg-hull/80 text-ink-dim py-0.5 px-2 rounded-full font-mono text-[9px] tracking-wider uppercase flex items-center gap-1">
            <span className="h-1 w-1 rounded-full bg-zinc-600" /> OAK DEPTH
          </span>

          <span className="absolute right-3 top-3 z-30 chip border-rim/70 bg-hull/80 text-amber-500 py-0.5 px-2 rounded-full font-mono text-[9px] tracking-wider uppercase">
            NOT PROVIDED
          </span>

          <div className="z-10 flex flex-col items-center gap-1.5 px-3 text-center font-mono text-zinc-500 select-none">
            <Video className="h-6 w-6 text-ink-dim/40" />
            <span className="text-[9px] leading-snug text-zinc-400">
              The robot publishes no colorized depth image. Needs a robot-side colorizer node.
            </span>
          </div>

          <div className="absolute left-3 right-3 bottom-2 z-30 flex justify-between items-center font-mono text-[8px] text-ink-dim/85 uppercase leading-none bg-hull/30 backdrop-blur-[1px] py-1 px-1.5 rounded">
            <span>compressedDepth ≠ an image</span>
            <span>not subscribed</span>
          </div>
        </div>

        {/* ── PT CAMERA FEED (STANDBY) ───────────── */}
        <div className="relative rounded-lg overflow-hidden border border-rim/70 bg-hull aspect-[4/3] flex items-center justify-center">
          <div className="pointer-events-none absolute inset-0 z-20 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.15)_0_1px,transparent_1px_3px)] opacity-30" />

          <span className="absolute left-3 top-3 z-30 chip border-rim/70 bg-hull/80 text-ink-dim py-0.5 px-2 rounded-full font-mono text-[9px] tracking-wider uppercase flex items-center gap-1">
            <span className="h-1 w-1 rounded-full bg-amber-500 shadow-[0_0_4px_#f59e0b]" /> PT CAM 5MP
          </span>

          <span className="absolute right-3 top-3 z-30 chip border-rim/70 bg-hull/80 text-amber-500 py-0.5 px-2 rounded-full font-mono text-[9px] tracking-wider uppercase">
            STANDBY
          </span>

          <div className="z-10 flex flex-col items-center gap-1.5 text-center font-mono text-zinc-500 select-none">
            <span className="text-[10px] tracking-[0.3em] font-black uppercase text-zinc-600">STANDBY</span>
            <span className="text-[8px] text-zinc-400">Not subscribed — no cockpit topic</span>
          </div>

          <div className="absolute left-3 right-3 bottom-2 z-30 flex justify-between items-center font-mono text-[8px] text-ink-dim/85 uppercase leading-none bg-hull/30 backdrop-blur-[1px] py-1 px-1.5 rounded">
            <span>/dev/video0 · verified 2026-07-31</span>
            <span>no live feed</span>
          </div>
        </div>
      </div>
    </section>
  );
}
