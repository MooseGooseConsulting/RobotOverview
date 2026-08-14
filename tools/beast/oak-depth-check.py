#!/usr/bin/env python3
"""Compare OAK stereo depth at frame center against the known 0.99 m wall."""
import sys
import time

import numpy as np
import rclpy
from rclpy.node import Node
from rclpy.qos import QoSProfile, ReliabilityPolicy, HistoryPolicy
from sensor_msgs.msg import Image

N = 15


class Probe(Node):
    def __init__(self):
        super().__init__("oak_depth_check")
        qos = QoSProfile(reliability=ReliabilityPolicy.BEST_EFFORT,
                         history=HistoryPolicy.KEEP_LAST, depth=3)
        self.frames = []
        # depth aligned to RGB is the useful one for cross-sensor comparison
        for topic in ("/oak/stereo/image_raw",):
            self.create_subscription(Image, topic, self.cb, qos)

    def cb(self, m):
        if m.encoding in ("16UC1", "mono16"):
            self.frames.append(m)


def main():
    rclpy.init()
    node = Probe()
    t0 = time.time()
    while rclpy.ok() and len(node.frames) < N and time.time() - t0 < 12:
        rclpy.spin_once(node, timeout_sec=0.2)
    frames = node.frames
    node.destroy_node()
    rclpy.shutdown()
    if not frames:
        print("no depth frames")
        sys.exit(1)

    m = frames[-1]
    print(f"depth: {m.width}x{m.height} enc={m.encoding} frame={m.header.frame_id}")
    meds = []
    for f in frames:
        a = np.frombuffer(bytes(f.data), dtype=np.uint16).reshape(f.height, f.width)
        h, w = a.shape
        roi = a[h // 2 - 40:h // 2 + 40, w // 2 - 60:w // 2 + 60]
        v = roi[roi > 0]
        if v.size:
            meds.append(np.median(v) / 1000.0)
    if meds:
        meds = np.array(meds)
        print(f"center-ROI depth over {len(meds)} frames: "
              f"median {np.median(meds):.3f} m, min {meds.min():.3f}, max {meds.max():.3f}")
        print(f"LiDAR ground truth wall: 0.99 m (39 in, owner-measured)")
        print(f"scan read the wall at:   1.00-1.02 m @ scan 255-285 deg")


if __name__ == "__main__":
    main()
