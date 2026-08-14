#!/usr/bin/env python3
"""Sample N /scan frames on BEAST and report per-angle data quality.

Prints, for each 15-degree sector (robot frame, 0=ahead):
  - count of valid returns
  - min/median/max range
  - % inf / % zero / % out-of-range
Also reports global stats and scan metadata so we can compare against the
known room geometry (walls < 3 m in all directions).
"""
import math
import statistics
import sys
import time

import rclpy
from rclpy.node import Node
from rclpy.qos import QoSProfile, ReliabilityPolicy, HistoryPolicy
from sensor_msgs.msg import LaserScan

N_FRAMES = 10
SECTOR = 15  # degrees


class ScanProbe(Node):
    def __init__(self):
        super().__init__("lidar_quality_probe")
        qos = QoSProfile(
            reliability=ReliabilityPolicy.BEST_EFFORT,
            history=HistoryPolicy.KEEP_LAST,
            depth=5,
        )
        self.frames = []
        self.sub = self.create_subscription(LaserScan, "/scan", self.cb, qos)

    def cb(self, msg: LaserScan):
        self.frames.append(msg)


def main():
    rclpy.init()
    node = ScanProbe()
    t0 = time.time()
    while rclpy.ok() and len(node.frames) < N_FRAMES and time.time() - t0 < 10:
        rclpy.spin_once(node, timeout_sec=0.2)
    frames = node.frames
    node.destroy_node()
    rclpy.shutdown()

    if not frames:
        print("NO FRAMES RECEIVED on /scan within 10 s")
        sys.exit(1)

    m = frames[-1]
    print("=== scan metadata (last frame) ===")
    print(f"frame_id      : {m.header.frame_id}")
    print(f"stamp         : {m.header.stamp.sec}.{m.header.stamp.nanosec:09d}")
    print(f"angle_min/max : {math.degrees(m.angle_min):.1f} / {math.degrees(m.angle_max):.1f} deg")
    print(f"angle_incr    : {math.degrees(m.angle_increment):.3f} deg ({len(m.ranges)} pts/scan)")
    print(f"range_min/max : {m.range_min:.3f} / {m.range_max:.3f} m")
    dt = frames[-1].header.stamp.sec + frames[-1].header.stamp.nanosec * 1e-9 - (
        frames[0].header.stamp.sec + frames[0].header.stamp.nanosec * 1e-9
    )
    hz = (len(frames) - 1) / dt if dt > 0 and len(frames) > 1 else float("nan")
    print(f"scan rate     : {hz:.1f} Hz over {len(frames)} frames")
    ints = getattr(m, "intensities", [])
    if ints:
        nz = [i for i in ints if i > 0]
        print(f"intensities   : {len(ints)} values, {len(nz)} nonzero, "
              f"min/max nonzero = {min(nz) if nz else 0:.0f}/{max(nz) if nz else 0:.0f}")
    else:
        print("intensities   : none")

    # Accumulate per-sector stats across all frames
    nsec = int(360 / SECTOR)
    sec_valid = [[] for _ in range(nsec)]
    sec_inf = [0] * nsec
    sec_zero = [0] * nsec
    sec_low = [0] * nsec   # below range_min but nonzero
    sec_nan = [0] * nsec

    all_ranges = []
    for f in frames:
        for i, r in enumerate(f.ranges):
            ang = f.angle_min + i * f.angle_increment  # -pi..pi or 0..2pi
            deg = math.degrees(ang)
            if deg < 0:
                deg += 360.0
            s = int(deg // SECTOR) % nsec
            if math.isnan(r):
                sec_nan[s] += 1
                continue
            if math.isinf(r):
                sec_inf[s] += 1
                continue
            if r == 0.0:
                sec_zero[s] += 1
                continue
            if r < f.range_min:
                sec_low[s] += 1
                continue
            sec_valid[s].append(r)
            all_ranges.append(r)

    print()
    print("=== per-sector table (0 deg = scan angle_min; check frame orientation) ===")
    print(f"{'sector':>13} {'valid':>5} {'inf':>4} {'zero':>4} {'nan':>4} "
          f"{'min':>6} {'med':>6} {'max':>6} {'spread%':>7}")
    for s in range(nsec):
        lo = s * SECTOR
        hi = lo + SECTOR
        v = sec_valid[s]
        if v:
            med = statistics.median(v)
            spread = 100.0 * (max(v) - min(v)) / med if med > 0 else 0.0
            print(f"{lo:5.0f}-{hi:<3.0f} deg {len(v):5d} {sec_inf[s]:4d} {sec_zero[s]:4d} "
                  f"{sec_nan[s]:4d} {min(v):6.2f} {med:6.2f} {max(v):6.2f} {spread:6.1f}%")
        else:
            print(f"{lo:5.0f}-{hi:<3.0f} deg     0 {sec_inf[s]:4d} {sec_zero[s]:4d} "
                  f"{sec_nan[s]:4d}      -      -      -       -")

    print()
    print("=== global ===")
    total_pts = sum(len(f.ranges) for f in frames)
    print(f"total points   : {total_pts}")
    print(f"valid          : {len(all_ranges)} ({100.0*len(all_ranges)/total_pts:.1f}%)")
    print(f"inf            : {sum(sec_inf)} ({100.0*sum(sec_inf)/total_pts:.1f}%)")
    print(f"zero           : {sum(sec_zero)} ({100.0*sum(sec_zero)/total_pts:.1f}%)")
    print(f"nan            : {sum(sec_nan)} ({100.0*sum(sec_nan)/total_pts:.1f}%)")
    print(f"below range_min: {sum(sec_low)}")
    if all_ranges:
        b = [0, 0, 0, 0, 0]
        for r in all_ranges:
            if r < 0.5: b[0] += 1
            elif r < 1.0: b[1] += 1
            elif r < 2.0: b[2] += 1
            elif r < 3.0: b[3] += 1
            else: b[4] += 1
        print(f"hist <0.5/1/2/3/>=3 m: {b}")
        print(f"global min/med/max: {min(all_ranges):.3f} / "
              f"{statistics.median(all_ranges):.3f} / {max(all_ranges):.3f} m")


if __name__ == "__main__":
    main()
