#!/usr/bin/env python3
"""Grab OAK RGB + stereo depth, save viewable renders + stats to /tmp/beast_vision."""
import time
from pathlib import Path

import numpy as np
import rclpy
from rclpy.node import Node
from rclpy.qos import QoSProfile, ReliabilityPolicy, HistoryPolicy
from sensor_msgs.msg import CompressedImage, Image

OUT = Path("/tmp/beast_vision")
OUT.mkdir(exist_ok=True)


class Grab(Node):
    def __init__(self):
        super().__init__("oak_framegrab")
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
            (OUT / "now_rgb.jpg").write_bytes(bytes(m.data))
            self.rgb_done = True
            print(f"rgb {len(m.data)} bytes, stamp {m.header.stamp.sec}")


def main():
    rclpy.init()
    node = Grab()
    t0 = time.time()
    while rclpy.ok() and (len(node.depths) < 20 or not node.rgb_done) and time.time() - t0 < 15:
        rclpy.spin_once(node, timeout_sec=0.2)
    frames = node.depths
    node.destroy_node()
    rclpy.shutdown()
    if not frames:
        print("no depth frames")
        return

    stack = []
    for f in frames:
        stack.append(np.frombuffer(bytes(f.data), dtype=np.uint16)
                     .reshape(f.height, f.width).astype(np.float32) / 1000.0)
    d = np.median(np.stack(stack), axis=0)  # temporal median kills sparkle noise
    h, w = d.shape
    valid = d[d > 0]
    print(f"depth {w}x{h}, {len(frames)} frames, valid {100.0*valid.size/d.size:.0f}%")
    if valid.size:
        print(f"range: min {valid.min():.2f}  p25 {np.percentile(valid,25):.2f}  "
              f"med {np.percentile(valid,50):.2f}  p75 {np.percentile(valid,75):.2f}  "
              f"max {valid.max():.2f} m")

    import cv2
    # full-range colormap (0.3-4 m) for structure reading
    v = np.clip((d - 0.3) / 3.7, 0, 1)
    v[d <= 0] = np.nan
    vis = np.nan_to_num(v, nan=1.0)  # invalid -> far color
    cv2.imwrite(str(OUT / "now_depth.png"),
                cv2.applyColorMap((vis * 255).astype(np.uint8), cv2.COLORMAP_TURBO))

    # near-band render (0.3-1.5 m) to make the wall/baseboard region readable
    v2 = np.clip((d - 0.3) / 1.2, 0, 1)
    v2[d <= 0] = np.nan
    vis2 = np.nan_to_num(v2, nan=1.0)
    cv2.imwrite(str(OUT / "now_depth_near.png"),
                cv2.applyColorMap((vis2 * 255).astype(np.uint8), cv2.COLORMAP_TURBO))

    # distance histogram across 0.25 m buckets
    edges = np.arange(0.25, 4.25, 0.25)
    hist, _ = np.histogram(valid, bins=edges)
    total = max(hist.sum(), 1)
    print("\ndistance histogram (share of valid px):")
    for e, c in zip(edges, hist):
        if c:
            print(f"  {e-0.25:4.2f}-{e:4.2f} m: {'#' * int(40 * c / total)} {100.0*c/total:.1f}%")


if __name__ == "__main__":
    main()
