# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0

"""Safety tests for the BEAST-01 cockpit bridge (the rosbridge whitelist).

The twist_mux spine decides whose command wins. It cannot stop a websocket
client from publishing directly onto the mux OUTPUT topic and bypassing
arbitration; only the rosbridge topic whitelist can, and there is no
authentication in front of it. These tests are the merge gate on that
whitelist.

They are static, like test_twist_mux_spine.py: the launch file is parsed with
``ast`` and its module-level glob constants read with ``ast.literal_eval``.
Nothing here imports launch, launch_ros, rclpy or cv2, so it runs on the bare
runner in .github/workflows/spine-tests.yml.

The rosbridge 2.0.7 behaviour behind each assertion is documented at the top of
launch/rosbridge.launch.py. In short: an unset glob is ALLOW-ALL, a
double-quoted entry silently matches nothing, an unbracketed value silently
loses its first and last character, rosapi cannot be denied by configuration,
and every denial is invisible to the client. All of those look like a working
config from the browser, which is why they are asserted here rather than left
to a commissioning check.

Run: ``python3 -m pytest src/ugv_main/ugv_cockpit/test`` from the workspace root.
"""

import ast
import os

import pytest
import yaml

LAUNCH_FILE = 'src/ugv_main/ugv_cockpit/launch/rosbridge.launch.py'
COCKPIT_LAUNCH = 'src/ugv_main/ugv_cockpit/launch/cockpit.launch.py'
TWIST_MUX_CONFIG = 'src/ugv_main/ugv_cockpit/config/twist_mux.yaml'
BRINGUP_LAUNCH = 'src/ugv_main/ugv_bringup/launch/bringup_lidar.launch.py'
BRINGUP_NODE = 'src/ugv_main/beast_base/beast_base/base_node.py'
PACKAGE_XML = 'src/ugv_main/ugv_cockpit/package.xml'
PROTOCOL_WRAPPER = 'src/ugv_main/ugv_cockpit/ugv_cockpit/cockpit_rosbridge.py'
SERVICE_UNIT = 'deploy/systemd/beast-cockpit.service'
COCKPIT_DOC = 'docs/cockpit.md'

# ---------------------------------------------------------------------------
# The contract, restated independently of the launch file. Extracted from the
# shipped cockpit client (Coldaine/RobotOverview src/lib/ros/client.ts): the
# ONLY topics a browser may publish to. /cmd_vel_estop_lock is NOT one of them:
# browser motion authority is the /ugv/set_allow_motion service, not a volatile
# mux lock publish (the lock topic stays for CLI operators over SSH only).
# ---------------------------------------------------------------------------
EXPECTED_PUB_TOPICS = [
    '/cmd_vel_ui',
    '/ugv/led_ctrl',
    '/pt_joint_position_controller/commands',
    '/ugv/pt_steady_ctrl',
]

# The only service a browser may call: the latched motion authority in
# ugv_bringup. The cockpit's DISARM/RE-ARM control is a SetBool to this.
EXPECTED_SERVICES = [
    '/ugv/set_allow_motion',
]

# /imu/raw, not /imu/data: ugv_bringup publishes Imu on "imu/raw" and nothing
# republishes it as imu/data, so /imu/data does not exist on this robot.
EXPECTED_SUB_TOPICS = [
    '/ugv/voltage',
    '/scan',
    '/odom',
    '/imu/raw',
    '/cockpit/overhead_clearance',
    '/cockpit/status',
    '/diagnostics',
    '/ugv/allow_motion',
    '/oak/rgb/image_raw/compressed',
    '/cockpit/depth/compressed',
    '/map',
    '/tf',
]

# Publishing any of these from a browser would bypass twist_mux arbitration or
# impersonate a source that outranks the human standing at the robot.
FORBIDDEN_PUB_TOPICS = [
    '/cmd_vel',
    '/cmd_vel_joy_robot',
    '/cmd_vel_joy_operator',
    '/cmd_vel_nav',
    '/cmd_vel_nav_raw',
    '/cmd_vel_smoothed',
]

ROSBRIDGE_PACKAGE = 'ugv_cockpit'
ROSBRIDGE_EXECUTABLE = 'cockpit_rosbridge'

# Glob parameters that must be set explicitly. rosbridge maps an unset ("")
# value to None and every capability treats None as "no restriction", so an
# omission here is a wide-open bridge, not a stricter one.
REQUIRED_GLOB_PARAMS = (
    'topics_pub_glob',
    'topics_sub_glob',
    'services_glob',
    'actions_glob',
)


def workspace_root():
    """Walk up from this file until the directory holding src/ugv_main."""
    path = os.path.abspath(os.path.dirname(__file__))
    while True:
        if os.path.isdir(os.path.join(path, 'src', 'ugv_main')):
            return path
        parent = os.path.dirname(path)
        if parent == path:
            raise RuntimeError('workspace root not found above %s' % __file__)
        path = parent


def read(relative_path):
    with open(os.path.join(workspace_root(), relative_path), encoding='utf-8') as handle:
        return handle.read()


def literal(node):
    """ast.literal_eval that reports "not a literal" instead of raising."""
    try:
        return ast.literal_eval(node)
    except (ValueError, TypeError, SyntaxError):
        return None


@pytest.fixture(scope='module')
def launch_tree():
    return ast.parse(read(LAUNCH_FILE), filename=LAUNCH_FILE)


@pytest.fixture(scope='module')
def launch_constants(launch_tree):
    """Module-level literal assignments in the launch file."""
    constants = {}
    for node in launch_tree.body:
        if not isinstance(node, ast.Assign):
            continue
        for target in node.targets:
            if isinstance(target, ast.Name):
                value = literal(node.value)
                if value is not None:
                    constants[target.id] = value
    return constants


def node_calls(tree):
    """Every ``Node(...)`` call in a launch file, as {keyword: ast node}."""
    calls = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        name = func.id if isinstance(func, ast.Name) else getattr(func, 'attr', None)
        if name != 'Node':
            continue
        calls.append({kw.arg: kw.value for kw in node.keywords if kw.arg})
    return calls


@pytest.fixture(scope='module')
def rosbridge_parameters(launch_tree, launch_constants):
    """The rosbridge node's parameter dict, with constant names resolved.

    Values written as bare NAMEs (``TOPICS_PUB_GLOB``) are looked up in the
    module-level constants, so this reads what the node will actually receive
    rather than the spelling used at the call site.
    """
    for keywords in node_calls(launch_tree):
        package = keywords.get('package')
        if not isinstance(package, ast.Constant) or package.value != ROSBRIDGE_PACKAGE:
            continue

        parameters = keywords.get('parameters')
        assert isinstance(parameters, ast.List) and parameters.elts, (
            '%s: the rosbridge node must carry an explicit parameters list — '
            'every glob it does not set defaults to allow-all' % LAUNCH_FILE
        )
        mapping = parameters.elts[0]
        assert isinstance(mapping, ast.Dict), (
            '%s: expected a parameter dict literal so this test can read it'
            % LAUNCH_FILE
        )

        resolved = {}
        for key_node, value_node in zip(mapping.keys, mapping.values):
            key = literal(key_node)
            if isinstance(value_node, ast.Name):
                assert value_node.id in launch_constants, (
                    '%s: parameter %r is set from %s, which is not a '
                    'module-level literal' % (LAUNCH_FILE, key, value_node.id)
                )
                resolved[key] = launch_constants[value_node.id]
            else:
                resolved[key] = literal(value_node)
        return resolved

    raise AssertionError('%s launches no %s node' % (LAUNCH_FILE, ROSBRIDGE_PACKAGE))


def parse_glob(value):
    """Parse a glob string exactly the way rosbridge 2.0.7 does.

    ``parse_glob_string`` in rosbridge_server/scripts/rosbridge_websocket.py:
    strip the outer characters, split on commas, strip whitespace and SINGLE
    quotes. Reproduced rather than described, so a failure prints the list the
    server would really build.
    """
    return [item.strip().strip("'") for item in value[1:-1].split(',') if item.strip()]


# --------------------------------------------------------------------------
# (a) the publish whitelist — what keeps a browser off the mux output
# --------------------------------------------------------------------------
def test_publish_glob_is_exactly_the_client_contract(rosbridge_parameters):
    entries = parse_glob(rosbridge_parameters['topics_pub_glob'])
    assert entries == EXPECTED_PUB_TOPICS, (
        'the publish whitelist must be exactly the four topics the shipped '
        'cockpit advertises. Adding one is a new control surface on the robot '
        'and needs the same review as a new velocity source.'
    )


@pytest.mark.parametrize('topic', FORBIDDEN_PUB_TOPICS)
def test_mux_ladder_topics_are_not_publishable(topic, rosbridge_parameters):
    entries = parse_glob(rosbridge_parameters['topics_pub_glob'])
    assert topic not in entries, (
        '%s is in the rosbridge publish whitelist. A websocket client could '
        'then bypass twist_mux arbitration entirely (or impersonate a source '
        'that outranks the operator), which is what the whitelist exists to '
        'prevent.' % topic
    )


def test_every_twist_mux_rung_is_covered_by_the_forbidden_list():
    """A rung added to twist_mux.yaml must not slip past the test above."""
    params = yaml.safe_load(read(TWIST_MUX_CONFIG))['twist_mux']['ros__parameters']
    rungs = {'/' + entry['topic'].lstrip('/') for entry in params['topics'].values()}
    lock = '/' + params['locks']['estop']['topic'].lstrip('/')

    assert lock not in EXPECTED_PUB_TOPICS, (
        'the e-stop mux lock must NOT be publishable from the browser. A '
        'one-shot publish into a VOLATILE lock subscription can lose the '
        'discovery race (the stop silently does nothing) and lock state does '
        'not survive a mux restart. Browser disarm goes through the latched '
        '/ugv/set_allow_motion service; the lock topic is for CLI operators.'
    )
    # The UI rung is the one drive input a browser is allowed to reach.
    unguarded = rungs - set(FORBIDDEN_PUB_TOPICS) - {'/cmd_vel_ui'}
    assert not unguarded, (
        'twist_mux declares rungs that FORBIDDEN_PUB_TOPICS does not name, so '
        'nothing checks whether a browser can publish to them: %s'
        % sorted(unguarded)
    )


# --------------------------------------------------------------------------
# (b) the subscribe whitelist
# --------------------------------------------------------------------------
def test_subscribe_glob_is_exactly_the_client_contract(rosbridge_parameters):
    entries = parse_glob(rosbridge_parameters['topics_sub_glob'])
    assert entries == EXPECTED_SUB_TOPICS


def test_subscribe_glob_names_an_imu_topic_the_robot_actually_publishes():
    """/imu/data does not exist on BEAST-01; whitelisting it would be dead config."""
    source = read(BRINGUP_NODE)
    assert 'create_publisher(Imu, "imu/raw"' in source, (
        '%s no longer publishes imu/raw — update the cockpit subscribe glob to '
        'whatever it publishes now' % BRINGUP_NODE
    )
    assert '/imu/raw' in EXPECTED_SUB_TOPICS
    assert '/imu/data' not in EXPECTED_SUB_TOPICS


# --------------------------------------------------------------------------
# (c) the silent-failure traps in rosbridge's glob parameter format
# --------------------------------------------------------------------------
@pytest.mark.parametrize('name', REQUIRED_GLOB_PARAMS)
def test_every_glob_is_set_explicitly(name, rosbridge_parameters):
    """An unset glob is ALLOW-ALL, not deny-all. Fail-open by default."""
    assert name in rosbridge_parameters, (
        '%s is unset. rosbridge maps an empty glob to None and every '
        'capability treats None as "no restriction", so omitting it opens the '
        'bridge instead of closing it.' % name
    )


@pytest.mark.parametrize('name', REQUIRED_GLOB_PARAMS)
def test_globs_are_strings_not_lists(name, rosbridge_parameters):
    """The parameter is STRING-typed; a list is a type mismatch, not a shortcut."""
    assert isinstance(rosbridge_parameters[name], str), (
        '%s must be a bracketed STRING. A Python/YAML list is a parameter type '
        'mismatch and rosbridge will not apply it.' % name
    )


@pytest.mark.parametrize('name', REQUIRED_GLOB_PARAMS)
def test_globs_are_bracketed(name, rosbridge_parameters):
    """rosbridge slices ``value[1:-1]`` before splitting — unbracketed loses chars."""
    value = rosbridge_parameters[name]
    assert value.startswith('[') and value.endswith(']'), (
        '%s must be bracketed. rosbridge strips the first and last character '
        'unconditionally, so an unbracketed value silently becomes a set of '
        'truncated, never-matching globs: %r' % (name, value)
    )


@pytest.mark.parametrize('name', REQUIRED_GLOB_PARAMS)
def test_globs_contain_no_double_quotes(name, rosbridge_parameters):
    """Only single quotes are stripped; a double-quoted entry matches nothing."""
    value = rosbridge_parameters[name]
    assert '"' not in value, (
        '%s contains a double quote. rosbridge strips single quotes only, so '
        'the quote survives into the glob and it matches no topic at all — a '
        'total, silent lockout that looks like a working config: %r'
        % (name, value)
    )


def test_legacy_topics_glob_is_never_set(rosbridge_parameters):
    """``topics_glob`` merges into BOTH directions and must stay unset."""
    assert 'topics_glob' not in rosbridge_parameters, (
        'topics_glob is merged into the pub AND the sub list unconditionally, '
        'so setting it widens the publish whitelist as a side effect of any '
        'subscribe change. Set topics_pub_glob and topics_sub_glob separately.'
    )


def test_services_glob_is_exactly_the_motion_authority(rosbridge_parameters):
    """One callable service, by exact name — everything else is refused."""
    assert parse_glob(rosbridge_parameters['services_glob']) == EXPECTED_SERVICES, (
        'services_glob must name exactly /ugv/set_allow_motion. Any wider and '
        'the browser gains a new control surface; empty and the DISARM control '
        'silently dies (denials are invisible to the client).'
    )


def test_actions_are_denied(rosbridge_parameters):
    assert parse_glob(rosbridge_parameters['actions_glob']) == []


# --------------------------------------------------------------------------
# (d) no rosapi — the mitigation for rosbridge's forced '/rosapi/*' append
# --------------------------------------------------------------------------
def test_no_rosapi_node_is_launched(launch_tree):
    """Not launching rosapi is what keeps the forced append matching nothing.

    rosbridge force-appends '/rosapi/*' to any non-None services_glob — and
    ours is non-None now, naming /ugv/set_allow_motion. If a rosapi node ran
    in this ROS domain, the browser would gain its introspection AND
    /rosapi/set_param, which configuration cannot deny. Not launching the node
    is the only real refusal.
    """
    packages = {
        literal(kwargs['package']) for kwargs in node_calls(launch_tree)
        if 'package' in kwargs
    }
    executables = {
        literal(kwargs['executable']) for kwargs in node_calls(launch_tree)
        if 'executable' in kwargs
    }
    assert packages == {ROSBRIDGE_PACKAGE}, (
        '%s must launch the websocket and nothing else, found: %s'
        % (LAUNCH_FILE, sorted(p for p in packages if p))
    )
    offenders = {name for name in executables if name and 'rosapi' in name}
    assert not offenders, (
        '%s launches %s. rosapi services are force-appended to services_glob '
        'and cannot be denied by configuration — the only way to refuse them '
        'is not to start the node.' % (LAUNCH_FILE, sorted(offenders))
    )


FORBIDDEN_CAPABILITIES = (
    'AdvertiseService',
    'SendActionGoal',
    'AdvertiseAction',
)

# The call in the wrapper that hands control to stock rosbridge. Every patch
# has to be upstream of this line or it patches nothing.
UPSTREAM_INVOCATION = 'run_path'


@pytest.fixture(scope='module')
def wrapper_tree():
    return ast.parse(read(PROTOCOL_WRAPPER), filename=PROTOCOL_WRAPPER)


def wrapper_main(wrapper_tree):
    for node in wrapper_tree.body:
        if isinstance(node, ast.FunctionDef) and node.name == 'main':
            return node
    raise AssertionError('%s defines no main()' % PROTOCOL_WRAPPER)


def upstream_invocation_line(main_node):
    for node in ast.walk(main_node):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        if isinstance(func, ast.Attribute) and func.attr == UPSTREAM_INVOCATION:
            return node.lineno
    raise AssertionError(
        '%s: main() no longer calls %s(). This test locates the hand-off to '
        'stock rosbridge in order to prove the patches precede it — if the '
        'hand-off mechanism changed, update UPSTREAM_INVOCATION here in the '
        'same commit.' % (PROTOCOL_WRAPPER, UPSTREAM_INVOCATION)
    )


def patch_assignment_line(main_node, receiver, attribute, expected_value):
    """Line of ``receiver.attribute = expected_value`` inside main(), or None.

    An ast.Assign, not a substring: the point is that the statement EXECUTES.
    """
    for node in ast.walk(main_node):
        if not isinstance(node, ast.Assign):
            continue
        for target in node.targets:
            if not isinstance(target, ast.Attribute) or target.attr != attribute:
                continue
            if not (isinstance(target.value, ast.Name)
                    and target.value.id == receiver):
                continue
            value = node.value
            if isinstance(value, ast.Name) and value.id == expected_value:
                return node.lineno
    return None


def test_bridge_registers_the_cockpit_capability_set(wrapper_tree):
    """The tuple's CONTENTS. test_the_capability_patch_is_executed does the rest."""
    assignment = next(
        node for node in wrapper_tree.body
        if isinstance(node, ast.Assign)
        and any(isinstance(target, ast.Name) and target.id == 'COCKPIT_CAPABILITIES'
                for target in node.targets)
    )
    names = [elt.id for elt in assignment.value.elts]
    assert names == ['Advertise', 'Publish', 'Subscribe', 'Defragment', 'CallService']

    # Identifiers, not raw text: the module's prose names the opcodes it
    # removes, and explaining a security control must not break the test for it.
    referenced = {
        node.id for node in ast.walk(wrapper_tree) if isinstance(node, ast.Name)
    }
    for node in ast.walk(wrapper_tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            referenced.update(alias.asname or alias.name for alias in node.names)
    offenders = sorted(set(FORBIDDEN_CAPABILITIES) & referenced)
    assert not offenders, (
        '%s references %s as code. The wrapper exists to make those opcodes '
        'unreachable; importing or naming one is how they come back.'
        % (PROTOCOL_WRAPPER, offenders)
    )


def test_the_capability_patch_is_executed_before_upstream_runs(wrapper_tree):
    """A correct COCKPIT_CAPABILITIES that is never assigned is decoration.

    Deleting the single line
    ``RosbridgeProtocol.rosbridge_capabilities = COCKPIT_CAPABILITIES``
    leaves the tuple, the imports and every other assertion in this file intact
    and green, while the bridge silently degrades to stock rosbridge with all 13
    upstream capabilities — AdvertiseService, SendActionGoal and
    AdvertiseAction included. That is the entire service/action boundary gone,
    with nothing to see in a diff review but one absent line.
    """
    main_node = wrapper_main(wrapper_tree)
    line = patch_assignment_line(
        main_node, 'RosbridgeProtocol', 'rosbridge_capabilities',
        'COCKPIT_CAPABILITIES',
    )
    assert line is not None, (
        '%s: main() must contain the statement RosbridgeProtocol.'
        'rosbridge_capabilities = COCKPIT_CAPABILITIES. Without it the '
        'narrowed protocol is never installed and the bridge runs stock, '
        'with the service-advertising and action opcodes registered.' % PROTOCOL_WRAPPER
    )
    assert line < upstream_invocation_line(main_node), (
        '%s: the capability patch must run BEFORE control passes to upstream. '
        'Patching afterwards patches nothing — the server is already serving.'
        % PROTOCOL_WRAPPER
    )


def test_the_origin_patch_is_executed_before_upstream_runs(wrapper_tree):
    """Tailnet reachability does not gate a browser; check_origin has to.

    Upstream's ``RosbridgeWebSocket.check_origin`` returns True unconditionally
    (rosbridge_suite humble, websocket_handler.py), and WebSocket handshakes are
    exempt from the same-origin policy, so without this patch any page open in
    any tab on a tailnet-joined machine can connect and publish.
    """
    main_node = wrapper_main(wrapper_tree)
    line = patch_assignment_line(
        main_node, 'RosbridgeWebSocket', 'check_origin', '_check_origin',
    )
    assert line is not None, (
        '%s: main() must install the origin check with '
        'RosbridgeWebSocket.check_origin = _check_origin. Upstream accepts '
        'every origin, so removing this line reopens the bridge to any web '
        'page loaded on a machine that can reach the tailnet.' % PROTOCOL_WRAPPER
    )
    assert line < upstream_invocation_line(main_node), (
        '%s: the origin patch must run BEFORE upstream starts serving.'
        % PROTOCOL_WRAPPER
    )


def test_origin_policy_is_delegated_to_the_ros_free_contract(wrapper_tree):
    """The decision itself must live where a bare-pytest runner can execute it.

    A security rule that only exists inside a module importing rosbridge is a
    rule CI cannot run. cockpit_contract has no ROS imports, so
    test_cockpit_status_contract.py exercises the real function.
    """
    imported = set()
    for node in ast.walk(wrapper_tree):
        if isinstance(node, ast.ImportFrom) and node.module:
            if 'cockpit_contract' in node.module:
                imported.update(alias.name for alias in node.names)
    assert {'origin_is_allowed', 'parse_allowed_origins'} <= imported, (
        '%s must take the origin decision from cockpit_contract, which imports '
        'nothing from ROS and is therefore testable in CI. Inlining the policy '
        'here makes it unexecutable on the runner.' % PROTOCOL_WRAPPER
    )


def test_launch_uses_the_topic_only_wrapper(launch_tree):
    nodes = node_calls(launch_tree)
    assert len(nodes) == 1
    assert literal(nodes[0]['package']) == ROSBRIDGE_PACKAGE
    assert literal(nodes[0]['executable']) == ROSBRIDGE_EXECUTABLE


def test_package_manifest_does_not_depend_on_rosapi():
    """A leftover exec_depend invites someone to add the node back."""
    assert '<exec_depend>rosapi</exec_depend>' not in read(PACKAGE_XML)


def test_whole_cockpit_launch_starts_no_rosapi():
    """The bridge is included from cockpit.launch.py; check that layer too."""
    source = read(COCKPIT_LAUNCH)
    assert 'rosapi' not in source, (
        '%s references rosapi. See test_no_rosapi_node_is_launched.'
        % COCKPIT_LAUNCH
    )


# --------------------------------------------------------------------------
# (e) the socket itself
# --------------------------------------------------------------------------
def test_rosbridge_binds_loopback_only(rosbridge_parameters):
    """rosbridge's own default binds every interface. Never ship that."""
    assert rosbridge_parameters.get('address') == '127.0.0.1', (
        'the bridge must bind 127.0.0.1. rosbridge defaults to binding all '
        'interfaces, which would put an UNAUTHENTICATED control socket on the '
        'LAN and the tailnet; tailscale serve is the only thing allowed to '
        'front it.'
    )
    assert rosbridge_parameters.get('port') == 9090, (
        'port 9090 is what the documented tailscale serve command fronts'
    )


def test_port_is_an_int_not_a_substitution(rosbridge_parameters):
    """rosbridge declares `port` as an integer; a LaunchConfiguration is a str."""
    assert isinstance(rosbridge_parameters.get('port'), int)


def test_bind_address_is_not_a_launch_argument(launch_tree):
    """An operator must not be able to widen the bind address from the CLI."""
    declared = set()
    for node in ast.walk(launch_tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        name = func.id if isinstance(func, ast.Name) else getattr(func, 'attr', None)
        if name != 'DeclareLaunchArgument' or not node.args:
            continue
        value = literal(node.args[0])
        if value is not None:
            declared.add(value)
    for forbidden in ('address', 'port'):
        assert forbidden not in declared, (
            '%s exposes %r as a launch argument. address:=0.0.0.0 is one typo '
            'away from an open, unauthenticated control socket; changing the '
            'bind is a code change that goes through review.'
            % (LAUNCH_FILE, forbidden)
        )


# --------------------------------------------------------------------------
# (f) the bridge is opt-in, at both the launch and the systemd layer
# --------------------------------------------------------------------------
def test_bringup_does_not_start_the_cockpit_bridge():
    """The spine comes up with the robot. The network port does not."""
    source = read(BRINGUP_LAUNCH)
    for launch_file in ('cockpit.launch.py', 'rosbridge.launch.py'):
        assert launch_file not in source, (
            '%s includes %s. Opening a control socket must stay an explicit '
            'operator action (systemctl start beast-cockpit.service), separate '
            'from bringing the robot up.' % (BRINGUP_LAUNCH, launch_file)
        )


def test_systemd_unit_is_installable_but_not_self_enabling():
    unit = read(SERVICE_UNIT)
    assert 'cockpit.launch.py' in unit
    assert '[Install]' in unit, (
        'without an [Install] section `systemctl enable` cannot work and the '
        'unit becomes undeployable rather than opt-in'
    )
    # A unit that pulls itself in from a target that is always active would be
    # enabled in practice no matter what the docs say.
    assert 'WantedBy=multi-user.target' in unit


def test_docs_carry_the_silent_denial_commissioning_check():
    """Denials are invisible to the client, so the check has to be written down."""
    doc = read(COCKPIT_DOC).lower()
    for expected in ('tailscale serve', 'commissioning', 'silent'):
        assert expected in doc, (
            '%s must document %r — the whitelist rejects publishes without '
            'telling the browser, so nothing else surfaces a misconfiguration'
            % (COCKPIT_DOC, expected)
        )
