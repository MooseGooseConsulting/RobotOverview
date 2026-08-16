#!/usr/bin/env python3
"""Run rosbridge with only the operations the cockpit uses, and only for
origins the operator has named.

Two monkeypatches, applied in :func:`main` BEFORE the upstream server is
executed. Both are the whole security control, not hardening on top of one:

1. ``RosbridgeProtocol.rosbridge_capabilities`` is narrowed to the four topic
   opcodes plus CallService. Upstream registers 13; the ones still removed here
   are AdvertiseService, AdvertiseAction and SendActionGoal — closing
   ``advertise_action`` matters because upstream does not glob-check it at all.
   CallService stays because the cockpit's DISARM/RE-ARM control is a
   ``std_srvs/SetBool`` call to ``/ugv/set_allow_motion``, and it is gated by
   the closed ``services_glob`` in launch/rosbridge.launch.py, which names
   exactly that one service. rosbridge force-adds ``/rosapi/*`` to any
   non-``None`` ``services_glob``; rosapi is not launched anywhere in this
   workspace, so the forced append matches no live service.

2. ``RosbridgeWebSocket.check_origin`` is replaced. Upstream is
   ``return True`` (humble branch, websocket_handler.py), and WebSocket
   handshakes are exempt from the same-origin policy, so "it is only reachable
   over the tailnet" does NOT gate a browser: any page in any tab on a
   tailnet-joined machine could open wss:// and publish. See
   :func:`cockpit_contract.origin_is_allowed` for the policy and for the two
   judgement calls in it (absent Origin is allowed; an empty allowlist denies
   every browser).

DELETING EITHER PATCH LINE IS A SILENT, TOTAL LOSS OF THE CONTROL. The process
still starts, the cockpit still works, and the bridge degrades to stock
rosbridge. ``test_cockpit_bridge.py`` therefore asserts that each assignment is
present, is inside ``main()``, and precedes the upstream invocation — not just
that the values it assigns are spelled correctly.

WHY runpy AND NOT AN IMPORT
---------------------------
There is no importable entry point to call. Verified against
RobotWebTools/rosbridge_suite ``humble``: ``rosbridge_server`` is an
``ament_cmake`` package whose Python side is installed with
``ament_python_install_package``; the importable package contains only
``__init__.py``, ``client_manager.py`` and ``websocket_handler.py``. The server
is a standalone script installed via ``install(PROGRAMS scripts/...)`` into
``lib/rosbridge_server/``. There is no ``setup.py``, no ``console_scripts``
entry point, and no ``rosbridge_server.rosbridge_websocket`` module to import a
``main`` from. Executing the installed script is the only option; the patches
still apply because they mutate class attributes the script's own imports
resolve to.
"""
import os
import runpy
import sys

from ament_index_python.packages import get_package_prefix
from rosbridge_library.capabilities.advertise import Advertise
from rosbridge_library.capabilities.call_service import CallService
from rosbridge_library.capabilities.defragmentation import Defragment
from rosbridge_library.capabilities.publish import Publish
from rosbridge_library.capabilities.subscribe import Subscribe
from rosbridge_library.capabilities.send_action_goal import SendActionGoal
from rosbridge_library.capabilities.cancel_action_goal import CancelActionGoal
from rosbridge_library.rosbridge_protocol import RosbridgeProtocol

from rosbridge_server import RosbridgeWebSocket

from ugv_cockpit.cockpit_contract import (
    ALLOWED_ORIGINS_ENV,
    origin_is_allowed,
    parse_allowed_origins,
)

COCKPIT_CAPABILITIES = (Advertise, Publish, Subscribe, Defragment, CallService, SendActionGoal, CancelActionGoal)


def _check_origin(self, origin):
    """Bound onto RosbridgeWebSocket in place of upstream's ``return True``.

    The allowlist is read per handshake rather than cached at startup so an
    operator can correct a typo with a service restart and no rebuild.
    """
    return origin_is_allowed(origin, parse_allowed_origins(
        os.environ.get(ALLOWED_ORIGINS_ENV, '')
    ))


def _announce(allowlist):
    """Print what is ACTUALLY in force, after the patches.

    ``rosbridge_protocol`` prints its capability list from the class body, i.e.
    at import time, which is necessarily before any patch of ours can run. That
    stale banner — all 13 upstream opcodes — lands in the exact
    ``journalctl -u beast-cockpit.service`` output docs/cockpit.md tells the
    operator to read during the commissioning check. Leaving it as the only
    capability line in the log would have the commissioning check appear to
    disprove the lockdown it is meant to confirm.
    """
    print('cockpit_rosbridge: EFFECTIVE capabilities (upstream banner above is '
          'the pre-patch default and is not what is registered):')
    for capability in RosbridgeProtocol.rosbridge_capabilities:
        print(' -', capability.__name__)
    if allowlist:
        print('cockpit_rosbridge: browser origins restricted to: %s'
              % ', '.join(allowlist))
    else:
        print('cockpit_rosbridge: %s unset — accepting ALL browser origins. '
              'The tailnet is the perimeter (tailscale serve is the only path '
              'in); set %s to restrict to specific origins.'
              % (ALLOWED_ORIGINS_ENV, ALLOWED_ORIGINS_ENV))


def upstream_executable():
    """Absolute path to the installed rosbridge_websocket script."""
    path = os.path.join(
        get_package_prefix('rosbridge_server'),
        'lib',
        'rosbridge_server',
        'rosbridge_websocket',
    )
    if not os.path.isfile(path):
        raise SystemExit(
            'cockpit_rosbridge: %s not found. Is ros-humble-rosbridge-suite '
            'installed and the workspace sourced? Refusing to start rather '
            'than falling back to an unpatched bridge.' % path
        )
    return path


def main():
    """Patch the upstream protocol and transport, then run its server."""
    RosbridgeProtocol.rosbridge_capabilities = COCKPIT_CAPABILITIES
    RosbridgeWebSocket.check_origin = _check_origin

    _announce(parse_allowed_origins(os.environ.get(ALLOWED_ORIGINS_ENV, '')))

    executable = upstream_executable()
    sys.argv[0] = executable
    runpy.run_path(executable, run_name='__main__')


if __name__ == '__main__':
    main()
