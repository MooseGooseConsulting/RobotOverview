#!/usr/bin/env python3
"""Per-beam temporal noise + flicker + near-hit analysis for /scan."""
import math
import statistics
import sys
import time
from collections import defaultdict

import rclpy
from rclpy.node import Node
from rclpy.qos import QoSProfile, ReliabilityPolicy, HistoryPolicy
from sensor_msgs.msg import LaserScan

N_FRAMES = 20


class Probe(Node):
    def __init__(self):
        super().__init__("lidar_noise_probe")
        qos = QoSProfile(reliability=ReliabilityPolicy.BEST_EFFORT,
                         history=HistoryPolicy.KEEP_LAST, depth=5)
        self.frames = []
        self.create_subscription(LaserScan, "/scan", lambda m: self.frames.append(m), qos)


def main():
    rclpy.init()
    node = Probe()
    t0 = time.time()
    while rclpy.ok() and len(node.frames) < N_FRAMES and time.time() - t0 < 15:
        rclpy.spin_once(node, timeout_sec=0.2)
    frames = node.frames
    node.destroy_node()
    rclpy.shutdown()
    if len(frames) < 5:
        print(f"only {len(frames)} frames; aborting")
        sys.exit(1)

    m = frames[0]
    n = len(m.ranges)
    print(f"frames={len(frames)} pts/scan={n}")

    # per-beam series
    series = defaultdict(list)   # beam idx -> list of valid ranges
    valid_count = [0] * n
    for f in frames:
        for i, r in enumerate(f.ranges):
            if r is not None and not math.isnan(r) and not math.isinf(r) and r > 0:
                series[i].append(r)
                valid_count[i] += 1

    # flicker: beams valid in 20-80% of frames
    flick = [(i, valid_count[i]) for i in range(n) if 0 < valid_count[i] < 0.8 * len(frames)]

    # noise: stddev for beams valid in >=80% frames
    noisy = []
    quiet_std = []
    for i, vals in series.items():
        if len(vals) >= 0.8 * len(frames):
            sd = statistics.pstdev(vals)
            quiet_std.append(sd)
            if sd > 0.03:  # > 3 cm temporal jitter
                noisy.append((i, sd, statistics.median(vals)))

    def deg(i):
        d = math.degrees(m.angle_min + i * m.angle_increment)
        return d if d >= 0 else d + 360

    quiet_std.sort()
    print(f"\nbeams with >=80% valid: {len(quiet_std)}/{n}")
    if quiet_std:
        print(f"temporal stddev p50/p90/p99/max: "
              f"{quiet_std[len(quiet_std)//2]*1000:.1f} / "
              f"{quiet_std[int(len(quiet_std)*0.9)]*1000:.1f} / "
              f"{quiet_std[int(len(quiet_std)*0.99)]*1000:.1f} / "
              f"{quiet_std[-1]*1000:.1f} mm")

    print(f"\nflickering beams (valid 1-{int(0.8*len(frames))} of {len(frames)} frames): {len(flick)}")
    # group flicker into contiguous arcs
    flick_idx = sorted(i for i, _ in flick)
    arcs = []
    if flick_idx:
        start = prev = flick_idx[0]
        for i in flick_idx[1:]:
            if i - prev > 3:
                arcs.append((start, prev))
                start = i
            prev = i
        arcs.append((start, prev))
    for a, b in arcs[:15]:
        print(f"  arc {deg(a):6.1f} - {deg(b):6.1f} deg  ({b-a+1} beams)")

    print(f"\nnoisy beams (stddev > 30 mm): {len(noisy)}")
    for i, sd, med in sorted(noisy, key=lambda x: -x[1])[:15]:
        print(f"  {deg(i):6.1f} deg  stddev {sd*1000:6.1f} mm  median {med:.3f} m")

    # near hits < 0.4 m: where and how persistent
    near = defaultdict(int)
    near_rng = defaultdict(list)
    for f in frames:
        for i, r in enumerate(f.ranges):
            if r and not math.isnan(r) and not math.isinf(r) and 0 < r < 0.4:
                near[i] += 1
                near_rng[i].append(r)
    print(f"\nnear hits <0.4 m: {len(near)} distinct beams")
    for i in sorted(near, key=lambda x: -near[x])[:15]:
        vals = near_rng[i]
        print(f"  {deg(i):6.1f} deg  {near[i]:2d}/{len(frames)} frames  "
              f"med {statistics.median(vals):.3f} m")


if __name__ == "__main__":
    main()
