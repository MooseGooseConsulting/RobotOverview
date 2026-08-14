# BEAST-01 ROS workspace in the RobotOverview monorepo

This directory is the **robot brain** for Patrick's Waveshare UGV Beast (BEAST-01)
on a Jetson Orin Nano. It shares a Git repository with the Hangar web app, but the two
surfaces are built and deployed independently.

## Locations

| Role | Path | GitHub |
| --- | --- | --- |
| Monorepo | `D:\_projects\RobotOverview` | [Coldaine/RobotOverview](https://github.com/Coldaine/RobotOverview) |
| ROS workspace | `robot/beast/ros2_ws` | same repository |
| Feature worktrees | `D:\_projects\.worktrees\RobotOverview-*` | same remote |
| On the robot | `~/beast/RobotOverview/robot/beast/ros2_ws` | sparse monorepo checkout |

Open `D:\_projects\RobotOverview` and edit the ROS packages in
`robot/beast/ros2_ws`. Every change uses the normal RobotOverview branch and PR flow.

List worktrees: `git -C D:\_projects\RobotOverview worktree list`.

## Who owns what

| Concern | Owner |
| --- | --- |
| Drivers, twist_mux, lidar, Nav2 behaviors, systemd, rosbridge | `robot/beast/ros2_ws` |
| `/cockpit`, `/agent`, inventory, Datacore | repository root |
| Dated live HEAD / voltage / boot args | [`docs/beast-ops.md`](../../../../docs/beast-ops.md) Quick connect |

The Hangar app never deploys to the Jetson. Sync is: merge a RobotOverview PR → sparse
`git pull` on the Jetson → build this directory → restart units → stamp beast-ops.

## Making changes

```powershell
cd D:\_projects\RobotOverview
git switch -c beast/<change>
# edit robot/beast/ros2_ws/...
git commit
git push -u origin beast/<change>
```

After review and merge, BEAST-01 updates itself: the merge advances
`refs/deploy/beast-01` (test-gated, via `deploy-pin.yml`), and the robot's
hourly `beast-pull.timer` fetches, rebuilds what changed, restarts, verifies,
and rolls back on failure — see `deploy/README.md`. (Until the supervised
rollout unmasks that timer, or for a forced deploy without waiting for the
tick, run `deploy/deploy-to-beast.sh` from any checkout.) Never hand-run
`git pull` + `colcon build` on the robot: an unverified half-deploy that
looks fine is exactly the failure mode the agent exists to prevent.

## Upstream

The workspace descends from
[waveshareteam/ugv_ws](https://github.com/waveshareteam/ugv_ws). No permanent fork is
kept. Fetch vendor changes directly and integrate them on a review branch:

```bash
git remote add waveshare-ugv https://github.com/waveshareteam/ugv_ws.git
git fetch waveshare-ugv
git subtree pull --prefix=robot/beast/ros2_ws waveshare-ugv ros2-humble-develop-251125
```

Remove the temporary remote after the update if desired. The workspace root README is
still largely Waveshare's Pi/VM guide; prefer this file and
[`docs/beast-ops.md`](../../../../docs/beast-ops.md) for BEAST-01 operating truth.
