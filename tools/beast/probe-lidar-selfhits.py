#!/usr/bin/env python3
"""Probe /scan for persistent near-range self-hits and print base_link→laser TF."""
from __future__ import annotations

import collections
import math
import subprocess
import time

import rclpy
from rclpy.node import Node
from sensor_msgs.msg import LaserScan
from tf2_ros import Buffer, TransformListener


def main() -> int:
    rclpy.init()
    node = Node('scan_selfhit_probe')
    buf = Buffer()
    TransformListener(buf, node)
    got: dict = {'scan': None}

    def cb(msg: LaserScan) -> None:
        got['scan'] = msg

    node.create_subscription(LaserScan, '/scan', cb, 10)
    deadline = time.time() + 15
    while got['scan'] is None and time.time() < deadline:
        rclpy.spin_once(node, timeout_sec=0.2)
    if got['scan'] is None:
        print('FAIL no /scan within 15s')
        return 1

    msg = got['scan']
    n = len(msg.ranges)
    valid = sum(1 for r in msg.ranges if msg.range_min < r < msg.range_max)
    print(f'frame={msg.header.frame_id} bins={n} valid={valid}/{n}')
    print(
        f'angle_min_deg={math.degrees(msg.angle_min):.1f} '
        f'angle_max_deg={math.degrees(msg.angle_max):.1f} '
        f'inc={math.degrees(msg.angle_increment):.3f}'
    )
    print(f'range_min={msg.range_min} range_max={msg.range_max}')

    near = []
    for i, r in enumerate(msg.ranges):
        if msg.range_min < r < 0.25:
            ang = (math.degrees(msg.angle_min + i * msg.angle_increment)) % 360
            near.append((ang, r, i))
    print(f'near_lt_0.25m={len(near)}')
    hist = collections.Counter(int(a // 5) * 5 for a, _, _ in near)
    print('near_hist_5deg count>=2:')
    for k in sorted(hist):
        if hist[k] >= 2:
            print(f'  {k:3d}-{k + 5:3d}: {hist[k]}')

    vnear = [(a, r) for a, r, _ in near if r < 0.12]
    print(f'very_near_lt_0.12m={len(vnear)}')
    if vnear:
        print(
            'very_near_angles:',
            ', '.join(f'{a:.1f}@{r:.3f}' for a, r in sorted(vnear)[:50]),
        )

    frames = []
    got['scan'] = None
    t0 = time.time()
    while len(frames) < 10 and time.time() - t0 < 12:
        rclpy.spin_once(node, timeout_sec=0.2)
        if got['scan'] is not None:
            frames.append(got['scan'])
            got['scan'] = None

    if frames:
        always = None
        for fr in frames:
            idxs = {
                i
                for i, r in enumerate(fr.ranges)
                if fr.range_min < r < 0.20
            }
            always = idxs if always is None else (always & idxs)
        print(f'frames={len(frames)} bins_always_lt_0.20m={len(always or [])}')
        if always:
            angs = sorted(
                (
                    (math.degrees(frames[0].angle_min + i * frames[0].angle_increment))
                    % 360,
                    i,
                )
                for i in always
            )
            print(
                'persistent_selfhit_angles:',
                ', '.join(f'{a:.1f}' for a, _ in angs[:80]),
            )
            degs = [a for a, _ in angs]
            print(f'persistent_min_max_deg={min(degs):.1f}..{max(degs):.1f}')

    t0 = time.time()
    while time.time() - t0 < 5:
        try:
            tf = buf.lookup_transform('base_link', msg.header.frame_id, rclpy.time.Time())
            t = tf.transform.translation
            q = tf.transform.rotation
            siny = 2 * (q.w * q.z + q.x * q.y)
            cosy = 1 - 2 * (q.y * q.y + q.z * q.z)
            yaw = math.degrees(math.atan2(siny, cosy))
            print(
                f'TF base_link->{msg.header.frame_id}: '
                f'xyz=({t.x:.4f},{t.y:.4f},{t.z:.4f}) yaw_deg={yaw:.2f}'
            )
            print('URDF expects xyz=(0.03170,-0.00102,0.0973) yaw~90')
            break
        except Exception:
            rclpy.spin_once(node, timeout_sec=0.2)
    else:
        print('TF lookup failed')

    try:
        out = subprocess.check_output(
            'ros2 param get /LDLiDAR_LD19 enable_angle_crop_func; '
            'ros2 param get /LDLiDAR_LD19 angle_crop_min; '
            'ros2 param get /LDLiDAR_LD19 angle_crop_max',
            shell=True,
            text=True,
        )
        print(out)
    except subprocess.CalledProcessError as exc:
        print('param get failed:', exc)

    node.destroy_node()
    rclpy.shutdown()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
