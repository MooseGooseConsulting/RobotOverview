# beast_power

Standalone driver-board INA219 power telemetry for BEAST-01 (PR-2a). The sensor is the
ROS driver board's battery monitor at `0x41` on `i2c-7` (verified live 2026-08-07) —
an earlier framing of it as a separate "UPS Module 3S" sensor was a guess.

This package vendors and adapts LeoRover’s INA219 `charging_monitor` ([LeoRover/leo_robot-ros2](https://github.com/LeoRover/leo_robot-ros2)) into an ament_python package that publishes:

| Topic | Type | Meaning |
| --- | --- | --- |
| `/ugv/voltage` | `sensor_msgs/BatteryState` | Pack bus V, signed current (A), OCV SOC in `percentage`, status |
| `/ugv/charging_active` | `std_msgs/Bool` | `true` when current ≥ charging threshold (positive = charging) |

## Ownership (cut over 2026-08-07)

**`beast_power` is the sole owner of `/ugv/voltage`.** `ugv_bringup` no longer
publishes BatteryState — its old `percentage` was a fake `V/12.6` and its
current/status fields were dummy zeros. Bringup keeps reading the ESP32 `v`
field only for its low-battery voice warning.

- `bringup_lidar.launch.py` starts this node under the `use_power` argument
  (default `true`).
- The service user needs the `i2c` group (`/dev/i2c-7` is `root:i2c`) — see
  `deploy/systemd/beast-ros-base.service` — and `smbus2` must be importable by
  that user (`pip3 install --user smbus2`, done on beast-01 2026-08-07).
- `/ugv/charging_active` has no consumer since `ugv_safety_monitor` was removed
  (2026-08-07) — it's published for observability only. The charging threshold
  is **provisional** until set from logged charge data
  (`beast_power_logger` → `/data/beast/power/power-log.csv`).
- Deploy: `robot/beast/ros2_ws/deploy/deploy-to-beast.sh` is **the** path —
  it fast-forwards the robot checkout, rebuilds, reinstalls the service unit,
  restarts, and verifies the live graph (see `deploy/README.md`).

## Parameters

See `config/beast_power.yaml`. Defaults: `i2c_bus_nr:=7`, `sensor_address:=0x41`,
`data_publish_rate:=1.0`. Hardware must confirm bus/address with `i2cdetect`
after wiring the driver-board I²C header to the Jetson (GND/SCL/SDA only; do not
back-feed 5 V or 3V3).

## Tests (no hardware)

Pure-logic + fake-bus tests (no rclpy required):

```bash
python -m pytest src/ugv_main/beast_power/test -q
```

On the robot after `colcon build --packages-select beast_power`:

```bash
colcon test --packages-select beast_power
```

## Wave 2+ hardware prerequisites

1. Wire the driver-board I²C header → Jetson 40-pin (GND/SCL/SDA only). **Done 2026-08-07.**
2. Verify 3.3 V levels; `i2cdetect` → record bus + address in `docs/beast-ops.md`.
3. Confirm shunt sign (`current_sign`) so positive amps = charging.
4. **Endpoints done 2026-08-14.** `voltage_to_soc` publishes usable-range OCV
   (8.332 V hard cutoff → 0 %, 12.364 V clean-log full-charge high → 100 %).
   Mid-curve rest-step samples and a pack-side shunt (3.0 Ah capacity) are
   still open. `charge_mah` now resumes from the last CSV row across logger
   restarts; it remains logic-rail truth, not pack capacity.
5. Keep `/ugv/charging_active` as observability only until a separately approved
   charging-policy design exists; it is not a motion interlock.
