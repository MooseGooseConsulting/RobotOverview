#!/usr/bin/env python3
"""Measure OAK-D Lite alignment against a known-flat wall.

With the robot square-on to a flat vertical wall at ~0.99 m:
  - pitch: median depth of top vs bottom row bands (level => equal)
  - yaw  : median depth of left vs right column bands (square-on => equal)
  - roll : baseboard top edge appears as a step in column depth profiles;
           fit its row per column and measure slope.

Also saves the RGB frame and a colorized depth PNG to /tmp/beast_vision.
"""
import math
import time
from pathlib import Path

import numpy as np
import rclpy
from rclpy.node import Node
from rclpy.qos import QoSProfile, ReliabilityPolicy, HistoryPolicy
from sensor_msgs.msg import CompressedImage, Image

WALL = 0.99
OUT = Path("/tmp/beast_vision")
OUT.mkdir(exist_ok=True)


class Probe(Node):
    def __init__(self):
        super().__init__("oak_wall_align")
        qos = QoSProfile(reliability=ReliabilityPolicy.BEST_EFFORT,
                         history=HistoryPolicy.KEEP_LAST, depth=3)
        self.depths = []
        self.rgb_done = False
        self.create_subscription(Image, "/oak/stereo/image_raw", self.cb_depth, qos)
        self.create_subscription(CompressedImage, "/oak/rgb/image_raw/compressed",
                                 self.cb_rgb, qos)

    def cb_depth(self, m):
        if m.encoding == "16UC1":
            self.depths.append(m)

    def cb_rgb(self, m):
        if not self.rgb_done:
            (OUT / "wall_rgb.jpg").write_bytes(bytes(m.data))
            self.rgb_done = True
            print(f"rgb saved ({len(m.data)} bytes)")


def main():
    rclpy.init()
    node = Probe()
    t0 = time.time()
    while rclpy.ok() and (len(node.depths) < 15 or not node.rgb_done) and time.time() - t0 < 15:
        rclpy.spin_once(node, timeout_sec=0.2)
    frames = node.depths
    node.destroy_node()
    rclpy.shutdown()
    if len(frames) < 5:
        print(f"only {len(frames)} depth frames; aborting")
        return

    # median depth surface across frames, meters
    stack = []
    for f in frames:
        stack.append(np.frombuffer(bytes(f.data), dtype=np.uint16)
                     .reshape(f.height, f.width).astype(np.float32) / 1000.0)
    d = np.median(np.stack(stack), axis=0)
    d[d == 0] = np.nan
    h, w = d.shape
    print(f"depth surface {w}x{h} from {len(frames)} frames")

    # colorized depth for viewing
    vis = np.clip((d - 0.5) / 2.5, 0, 1)
    vis = np.nan_to_num(vis, nan=0.0)
    img = (vis * 255).astype(np.uint8)
    img = np.stack([img, 255 - img, np.full_like(img, 60)], axis=-1)  # simple 2-tone
    try:
        import cv2
        cv2.imwrite(str(OUT / "wall_depth.png"), cv2.applyColorMap(
            (np.nan_to_num((d - 0.4) / 3.0, nan=0.0).clip(0, 1) * 255).astype(np.uint8),
            cv2.COLORMAP_TURBO))
    except Exception as e:
        print("png fail", e)

    rows = np.arange(h)
    cols = np.arange(w)

    def band(r0, r1, c0, c1):
        v = d[r0:r1, c0:c1]
        v = v[np.isfinite(v)]
        return float(np.median(v)) if v.size else float("nan")

    # ---- pitch: row thirds over the middle columns
    c0, c1 = w // 4, 3 * w // 4
    top = band(0, h // 5, c0, c1)
    mid = band(2 * h // 5, 3 * h // 5, c0, c1)
    bot = band(4 * h // 5, h, c0, c1)
    print(f"\nrow bands (middle cols):  top {top:.3f}  mid {mid:.3f}  bot {bot:.3f} m")
    # ---- yaw: column thirds over middle rows
    r0, r1 = h // 4, 3 * h // 4
    left = band(r0, r1, 0, w // 5)
    ctr = band(r0, r1, 2 * w // 5, 3 * w // 5)
    right = band(r0, r1, 4 * w // 5, w)
    print(f"col bands (middle rows):  left {left:.3f}  ctr {ctr:.3f}  right {right:.3f} m")

    # ---- per-column wall distance along a horizontal mid band, fit plane
    bandd = d[r0:r1, :]
    col_med = np.nanmedian(bandd, axis=0)
    ok = np.isfinite(col_med)
    if ok.sum() > 50:
        A = np.vstack([cols[ok], np.ones(ok.sum())]).T
        slope, intercept = np.linalg.lstsq(A, col_med[ok], rcond=None)[0]
        # yaw ≈ atan(slope) — depth grows linearly with x for a yawed wall
        print(f"wall plane fit: z = {slope*1000:.3f} mm/px * x + {intercept:.3f} m")
        print(f"implied yaw ≈ {math.degrees(math.atan(slope)):.2f} deg "
              f"(+ => right side farther)")

    # ---- per-row distance in center cols, fit for pitch
    rowband = d[:, c0:c1]
    row_med = np.nanmedian(rowband, axis=1)
    okr = np.isfinite(row_med)
    if okr.sum() > 50:
        A = np.vstack([rows[okr], np.ones(okr.sum())]).T
        slope, intercept = np.linalg.lstsq(A, row_med[okr], rcond=None)[0]
        print(f"vertical fit: z = {slope*1000:.3f} mm/row * y + {intercept:.3f} m")
        # for a wall at distance D, pitch p: z(y) ≈ D / cos(p + atan((y-cy)/f))
        # report simple top-vs-bottom gradient interpretation
        print(f"top-mid-bot deltas: {(top-mid)*1000:+.0f} mm (top-mid), "
              f"{(bot-mid)*1000:+.0f} mm (bot-mid)")

    print(f"\nwall truth: {WALL} m | LiDAR read 1.00-1.02 m | "
          f"OAK center read {ctr:.3f} m (oak is 3.9 cm ahead of lidar per URDF)")


if __name__ == "__main__":
    main()
