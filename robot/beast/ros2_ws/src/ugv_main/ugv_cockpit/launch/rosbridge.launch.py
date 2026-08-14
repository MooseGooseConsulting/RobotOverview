"""rosbridge WebSocket transport for the BEAST-01 cockpit — locked down.

This is the ONLY network surface the browser cockpit talks to, and its topic
whitelist is the only thing that keeps a websocket client off ``/cmd_vel``.

===========================================================================
WHY THE WHITELIST IS LOAD-BEARING
===========================================================================
``twist_mux`` (config/twist_mux.yaml, launch/twist_mux.launch.py) decides WHOSE
command wins. It cannot stop a client from publishing straight onto the mux
OUTPUT topic and bypassing arbitration entirely, because ROS 2 has no notion of
topic ownership. There is no authentication on this socket, so the glob
whitelist plus the loopback bind ARE the boundary — see docs/cockpit.md.

Safety here rests on exactly three things, none of which is an ACL:

  1. ``address: 127.0.0.1`` — the socket is not on the LAN or the tailnet at
     all. rosbridge's own default binds every interface; that default is what
     this file exists to override.
  2. ``topics_pub_glob`` — a closed list of the five topics the shipped cockpit
     advertises. ``/cmd_vel`` and every other mux rung are absent.
  3. ``tailscale serve`` fronts 127.0.0.1:9090 as wss on the tailnet. That is
     the only path in, and it terminates TLS with a real cert so an HTTPS page
     can open the socket without tripping mixed-content rules.

``authenticate: false`` stays, because rosbridge's built-in authentication is a
custom ``/rosbridge/authenticate`` service handshake that the shipped client
does not implement. It is honest to say the socket is unauthenticated and that
reachability is what gates it; it would not be honest to call that an access
control list.

===========================================================================
VERIFIED ROSBRIDGE 2.0.7 BEHAVIOUR (read from source, not the docs)
===========================================================================
``ros-humble-rosbridge-suite`` resolves to rosbridge_suite 2.0.7.

  * ``topics_pub_glob`` is checked in ``advertise`` AND in every individual
    ``publish`` (rosbridge_library/capabilities/publish.py). The per-publish
    check is the load-bearing one: a ``publish`` op will happily create a
    publisher for a topic that was never advertised. ``topics_sub_glob`` gates
    ``subscribe`` the same way.
  * Matching is ``fnmatch.fnmatch(topic, glob)``, fully anchored. With no
    wildcards in our entries only the exact string matches — ``/cmd_vel``
    cannot match ``/cmd_vel_ui``, a missing leading slash fails closed, and
    matching is case-sensitive on Linux.
  * FAIL-OPEN DEFAULT: ``parse_glob_string`` maps an unset ("") parameter to
    ``None``, and every capability reads ``None`` as "no restriction". An unset
    glob is ALLOW-ALL. Every glob below is set explicitly, including the empty
    ones — ``"[]"`` parses to ``[]``, which is NOT ``None`` and therefore
    denies everything.
  * PARAMETER FORMAT TRAP. These parameters are STRING-typed and parsed with
    ``[s.strip().strip("'") for s in value[1:-1].split(",")]``, so:
      - the value MUST be bracketed — ``value[1:-1]`` silently eats the first
        and last character of an unbracketed string, turning ``/cmd_vel_ui``
        into ``cmd_vel_u``;
      - only SINGLE quotes are stripped. A double-quoted entry keeps its quote
        characters and becomes a glob that matches nothing — a silent, total
        lockout that looks like a working config;
      - it must be a Python ``str``, never a list. A list is a parameter type
        mismatch, not a convenience.
  * The legacy ``topics_glob`` merges into BOTH the pub and the sub list
    unconditionally. It is left unset on purpose.
  * DENIALS ARE SILENT TO THE CLIENT. A rejected publish logs a warning
    server-side and returns; the browser sees no error and its button appears
    to work. docs/cockpit.md carries the commissioning check that proves the
    boundary is live — run it after any change to these strings.

rosapi_node is NOT launched, deliberately. The ``cockpit_rosbridge`` wrapper
removes the action capabilities and the service-ADVERTISING capability from
the upstream protocol, leaving CallService as the only service opcode — gated
by the closed ``services_glob`` below, which names exactly
``/ugv/set_allow_motion``. rosbridge 2.0.7 force-appends ``/rosapi/*`` to any
non-``None`` ``services_glob``, so rosapi staying unlaunched is what keeps
that forced append matching nothing real if another launch started it in the
same ROS domain. The shipped cockpit uses advertise / publish / subscribe plus
exactly one service call (the motion authority); everything else is refused.

Every constant below is asserted by test/test_cockpit_bridge.py.
"""
from launch import LaunchDescription
from launch_ros.actions import Node

# Bind address and port are NOT launch arguments. `address:=0.0.0.0` is one
# typo away from an unauthenticated control socket on the LAN, and the
# documented `tailscale serve` command targets this exact port. Changing either
# is a code change that goes through review.
ROSBRIDGE_ADDRESS = '127.0.0.1'
ROSBRIDGE_PORT = 9090

# Client -> robot. Exhaustively the four topics the shipped cockpit advertises
# (Coldaine/RobotOverview src/lib/ros/client.ts). Each is either the mux's
# priority-50 UI rung or a non-velocity actuator. The mux OUTPUT /cmd_vel and
# the higher rungs cmd_vel_joy_robot / cmd_vel_joy_operator / cmd_vel_nav are
# absent, so a browser can neither bypass arbitration nor outrank the human at
# the robot. /cmd_vel_estop_lock is deliberately absent too: the cockpit's
# motion authority is the /ugv/set_allow_motion SERVICE (below), whose latched
# flag lives in ugv_bringup and gates the serial write itself — a stronger and
# restart-surviving stop than a volatile mux lock publish. The mux lock topic
# stays configured for CLI operators over SSH, never for the browser.
TOPICS_PUB_GLOB = (
    '[/cmd_vel_ui, /ugv/led_ctrl, /pt_joint_position_controller/commands, '
    '/ugv/pt_steady_ctrl]'
)

# Robot -> client. Telemetry only; nothing here can move anything. The list
# stays closed anyway so a client cannot enumerate and read whatever a later PR
# adds to the graph.
#
# /imu/raw: beast_base publishes Imu on "imu/data" (canonical, EKF / rf2o /
# odom_publisher) and "imu/raw" (same-payload alias for acceptance scripts
# that still echo it). The web client subscribes /imu/raw.
#
# CROSS-REPO: keep this exhaustive list in lockstep with ROS_SUBSCRIPTIONS
# in src/lib/ros/client.ts. Denying a safety subscription would force the UI
# onto the slower aggregator and surface a bridge fault. /map + /tf are
# telemetry only (occupancy under the scan); they cannot move the robot.
TOPICS_SUB_GLOB = (
    '[/ugv/voltage, /scan, /odom, /imu/raw, /cockpit/overhead_clearance, '
    '/cockpit/status, /diagnostics, /ugv/allow_motion, '
    '/oak/rgb/image_raw/compressed, /cockpit/depth/compressed, '
    '/map, /tf]'
)

# Exactly one service: the motion authority in ugv_bringup. The cockpit's
# DISARM/RE-ARM control calls it; nothing else is callable from the socket.
# Bracketed, single-entry, never "" — an empty STRING parses to None, which
# rosbridge reads as allow-all.
SERVICES_GLOB = '[/ugv/set_allow_motion]'
ACTIONS_GLOB = '[]'


def generate_launch_description():
    """Stand up the cockpit's rosbridge websocket, and nothing else."""
    rosbridge = Node(
        package='ugv_cockpit',
        executable='cockpit_rosbridge',
        name='rosbridge_websocket',
        output='screen',
        parameters=[{
            # Loopback only — tailscale serve is the sole way in.
            'address': ROSBRIDGE_ADDRESS,
            # Int, not a LaunchConfiguration: a substitution resolves to a
            # string and rosbridge declares this parameter as an integer.
            'port': ROSBRIDGE_PORT,
            # No usable handshake in the shipped client; see the docstring.
            # The boundary is the bind address + the globs below.
            'authenticate': False,
            'use_compression': True,
            # Cap image fan-out so a slow client can't stall the loop.
            'max_message_size': 10_000_000,
            'unregister_timeout': 10.0,
            # Bracketed strings, single quotes or none, never a list. All three
            # constraints fail SILENTLY when violated — see the docstring.
            'topics_pub_glob': TOPICS_PUB_GLOB,
            'topics_sub_glob': TOPICS_SUB_GLOB,
            'services_glob': SERVICES_GLOB,
            'actions_glob': ACTIONS_GLOB,
            # NOTE: `topics_glob` is deliberately NOT set. It merges into both
            # the pub and the sub list, so setting it would widen the publish
            # whitelist as a side effect of any subscribe change.
        }],
    )

    return LaunchDescription([rosbridge])
