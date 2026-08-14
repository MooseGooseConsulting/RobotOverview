# Cockpit ROS client vs roslib — convergence review and server-bridge repair

Status: **Decided, unstarted.** Written 2026-08-14 after reading roslib 2.1.0's shipped
source (`node_modules/roslib/dist/RosLib.js`), `src/lib/ros/client.ts`,
`src/server/beast/ros-singleton.ts`, and both test files, plus a live read-only check on
BEAST-01. The review question was "converge the browser client onto roslib, or drop the
dependency". Both framings turned out to be wrong, and the review found a live defect in
the server bridge. That defect, not the convergence question, is the work.

This is a **work order**, not a record of reasoning: it names inputs, what to do, what to
emit, and how to tell when it is done. **Code is truth** — if this document and the code
disagree, the code is right and this document is stale.

## 0. Verdict

1. **Do not migrate `src/lib/ros/client.ts` to roslib.** roslib 2.1.0 cannot decode this
   robot's `/scan` at all (§3.1), silently discards the bridge-refusal frames the cockpit
   attributes faults from (§3.2), reassembles the oversized `/map` dumps the client exists
   to drop (§3.3), and replays queued publishes on reconnect (§3.4). The honesty layer is
   not a wrapper you could keep on top; four of its load-bearing behaviours are things
   roslib actively does the other way.
2. **Do not delete the `roslib` dependency.** It is not dead weight. It is loaded at
   runtime by `src/server/beast/ros-singleton.ts:294` via `await import('roslib')` — a
   dynamic import, which is why a plain grep for `from 'roslib'` finds nothing. Removing
   it breaks the agent's `/scan` liveness, nav2 motion tools, and `stop()` at runtime, and
   **no test would catch it** because `ros-singleton.test.ts` injects a mock `RosLibLike`.
3. **Fix the server bridge instead.** roslib is broken on the live wire *today* for the
   same reason the browser client would break: rosbridge emits bare `NaN`. The fix is
   ~60 lines through roslib's own documented `transportFactory` extension point, reusing
   the browser client's existing repair function. §6 is that work order.

Net dependency change: none. Net new code: one shared frame module, one transport
subclass, three small correctness fixes, and guards so this is not re-litigated.

## 1. Inputs

| Thing | Where |
|---|---|
| Browser client under review | `src/lib/ros/client.ts` (1,389 lines) |
| Its contract tests | `src/__tests__/ros-client.test.ts` |
| Server bridge (the actual roslib consumer) | `src/server/beast/ros-singleton.ts` (491 lines) |
| Its tests (mock-injected, never load roslib) | `src/__tests__/ros-singleton.test.ts` |
| Dependency declaration | `package.json:30` — `"roslib": "^2.1.0"` |
| roslib source read | `node_modules/roslib/dist/RosLib.js` + `dist/src/**/*.d.ts` |
| Dep provenance | `git log -S'"roslib"' -- package.json` → `cb0ea75` (#162), added *for the agent surface*, not the cockpit |

Re-derive the roslib facts (the dist is unminified ESM; read it, do not trust the README):

```bash
node -e "const s=require('fs').readFileSync('node_modules/roslib/dist/RosLib.js','utf8');
         const i=s.indexOf('Deserializes a JSON string'); console.log(s.slice(i,i+400))"
head -5 node_modules/roslib/dist/RosLib.js      # static imports: bson, cbor2, fast-png, uuid
```

Live robot facts used below (read-only, 2026-08-14, `ssh beast-01-ts`; no publish, no motion):

- `ros-humble-rosbridge-server 2.0.7-1jammy` running; `/rosbridge_websocket` in `ros2 node list`.
- One live `/scan` frame carries **149 `nan` range values** (`ros2 topic echo /scan --once
  --field ranges | tr , '\n' | grep -ic nan`).
- `/opt/ros/humble/local/lib/python3.10/dist-packages/rosbridge_library/protocol.py:352` —
  `return json.dumps(msg)`, no `allow_nan=False`. On the robot's own interpreter:
  `python3 -c 'import json;print(json.dumps({"ranges":[float("nan"),1.0]}))'` →
  `{"ranges": [NaN, 1.0]}`.

**Every `/scan` frame this bridge sends is invalid JSON.** That single fact decides the
whole review.

## 2. Correction to the premise

The task that opened this review recorded "roslib … is NEVER imported anywhere in `src/`".
That is false, and the plan exists partly to stop the next agent re-deriving it:

```
src/server/beast/ros-singleton.ts:294   const mod = (await import('roslib')) as unknown as RosLibLike;
src/server/beast/ros-singleton.ts:315   const ros = new this.roslib.Ros();
src/server/beast/ros-singleton.ts:355   new this.roslib.Topic({...})       // /ugv/allow_motion, /ugv/voltage, /scan
src/server/beast/ros-singleton.ts:379   new this.roslib.Action({...})      // nav2 DriveOnHeading / Spin / BackUp
```

`envBridgeUrl()` (`ros-singleton.ts:78`) returns `resolveBeastCockpitWsUrl()`, which
**always** yields a URL (`BEAST_COCKPIT_WS_URL_DEFAULT`, the tailnet host). The singleton
is therefore never "unconfigured" in production — it always connects, and §5 is always
active whenever the bridge is reachable.

So the repo runs **two** rosbridge clients: a hardened hand-written one in the browser and
roslib on the server. That split is defensible (the server needs the ROS 2 *action*
protocol, which the browser client does not implement and should not grow). It is only
undocumented, and one half of it is broken.

## 3. What roslib 2.1.0 gives, and what it does not

roslib 2.x is a real rewrite — TypeScript, `eventemitter3`, a pluggable
`ITransportFactory`, ROS 2 `Action` support, BSON/CBOR/PNG decode, fragment reassembly. It
is not the 2019 library. It still does not fit the cockpit:

| Cockpit behaviour | roslib 2.1.0 | Evidence |
|---|---|---|
| Bare `NaN`/`Infinity` repair | **Absent, fatal.** `handleJsonMessage` is a bare `JSON.parse`; on throw `handleRawMessage` catches and emits `'error'` — the frame is gone. | `dist/RosLib.js` `handleJsonMessage`; §1 live facts |
| Repair only *outside* string literals | N/A — no repair at all | `repairNonFiniteTokens`, `client.ts:681` |
| Fault attribution per op id | **Partial and unusable.** Ids exist (`subscribe:<topic>:<uuid>`), but `handleMessage` routes a status frame to the namespaced event `status:${id}`; eventemitter3 has no wildcard, so a frame with an id nobody listens for is dropped. Publish ids are generated per call and never exposed, so a refused **publish** is unobservable. | `Ros.handleMessage`; `Topic.publish` |
| Drop `/map` on `op:"fragment"` | **Opposite.** `AbstractTransport.handleRosbridgeFragmentMessage` buffers every fragment in a `Map` and `JSON.parse`s the joined string — i.e. it reassembles the 80 MB dump the client refuses. | `handleRosbridgeFragmentMessage` |
| `publish()` returns false when the socket is down | **Opposite, and safety-relevant.** `Topic.publish` → `Ros.callOnConnection` → `this.once('connection', …)` when disconnected. Held-stick Twists queue during a dropout and **replay on reconnect**, unbounded. | `callOnConnection`; `client.ts:983` returns `false` |
| Local service-call timeout, fail-on-close | **Absent.** `Service.callService` registers `ros.once(id, …)` and passes `timeout` to the bridge; nothing fires on socket close or on silence. | `Service.callService` vs `client.ts:1000`, `failPendingServiceCalls` |
| Reconnect with backoff | **Absent at the `Ros` level** (`Topic.reconnect_on_close` only re-subscribes). Custom either way. | `Ros.d.ts`, `grep reconnect` |
| Per-slice staleness / `hasReceived` / `useSyncExternalStore` | Out of scope for roslib — would survive a migration unchanged | `client.ts:170-553` |
| Bundle cost in the browser | `dist/RosLib.js` lines 1–5 statically import `bson`, `cbor2`, `fast-png`, `uuid`, `eventemitter3`. Reachable from `handleRawMessage`, so not tree-shakeable. On disk: bson 2.2 MB, fast-png 314 KB, cbor2 197 KB, uuid 179 KB — paid for compression modes the cockpit never negotiates. | `head -5 dist/RosLib.js` |

Two of these are decisive on their own. **§3.1**: migrating the browser client to roslib
deletes the LiDAR feed on a robot that is provably emitting 149 bare `nan`s per scan.
**§3.4**: it converts a dropped Wi-Fi link from "commands stop" into "commands queue and
fire later", on the one topic that moves a robot that latches its last velocity
(2026-08-07 live proof, strip-down plan §2.1).

Rejected alternative: *migrate and subclass `AbstractTransport` in the browser too.* That
is not "adopting a library" — the transport is the layer you were adopting, and you would
still own the parse, still lose fault attribution and the fragment drop, and still pay the
bundle. The remaining win (Topic/Service bookkeeping, ~80 lines) does not buy the risk.

## 4. What the browser client keeps

No change to `src/lib/ros/client.ts` behaviour. One mechanical move, in §6 Step 1: the two
frame functions come out into a shared module so the server can use them. Everything else
— `SliceMeta`/`FRESHNESS_MS`/`tickStaleness`/`markAllStale`, `opId`/`deadTopics`, the
fragment and `MAP_MAX_CELLS` guards, object-URL image decode, `DIRECT_TOPIC_AUTHORITY_MS`,
the module-scope subscriber identities — stays exactly as it is.

## 5. The defect this review actually found

The server bridge subscribes `/scan` (`ros-singleton.ts:69`). Every such frame is invalid
JSON (§1). Chain:

1. roslib `JSON.parse` throws → `handleRawMessage` catches → `emit('error', …)` →
   `Ros` re-emits `'error'` → `ros-singleton.ts:134 onError` sets **`this.state = 'error'`**
   while the socket is open and healthy. At scan rate this is continuous.
2. `lastScanAt` is never set, so `getStatus().scanAlive` (`:202`) is **permanently `null`**
   — the agent is told LiDAR liveness is unknown, forever.
3. `stop()` (`:261`) guards on `this.state !== 'connected'` and returns
   `bridge_unavailable`, *"Cancel not sent."* **The agent's stop refuses to cancel nav2
   goals because a LiDAR frame failed to parse.** `runAction` (`:432`) has the same guard.
4. `getStatus()` calls `start()`, which resets `state` to `'connected'` when
   `ros.isConnected` (`:169`) — so the state flaps, and whether `stop()` works depends on
   how recently a status read happened. Nondeterministic, in the stop path.

Two smaller roslib-contract bugs found alongside:

- `ros-singleton.ts:321` — `ros.connect(url)` is `async` in roslib 2.x. The surrounding
  `try/catch` cannot catch its rejection; a bad URL becomes an unhandled rejection (fatal
  under Node's default). `RosHandle.connect` is typed `void` at `:16`, which hid this.
- `ros-singleton.ts:452` — `action.sendGoal(goal)` with no result callback. roslib calls
  `resultCallback(values)` unconditionally on `STATUS_SUCCEEDED`; `undefined` is not a
  function, so a **successful** nav2 action throws inside the emitter and is laundered into
  another `'error'` event.

None of this is visible to CI: `ros-singleton.test.ts` injects `RosLibLike` mocks that
never parse a wire frame.

## 6. Work order

One PR. No dependency changes. Web test suite must stay green.

### Step 1 — extract the frame parser (mechanical, no behaviour change)

New `src/lib/ros/frame.ts`, exporting `repairNonFiniteTokens` and `parseRosbridgeFrame`
**verbatim** from `client.ts:658-716`, comments included (the string-literal reasoning is
the point of the function). `client.ts` imports them and deletes its local copies; the
`NON_FINITE_TOKEN` sticky regex moves with them.

**Do not forget:** `ros-client.test.ts:396` (`'uses no lookbehind assertions anywhere in
the client'`) reads `src/lib/ros/client.ts` as text. After the move that assertion is
vacuous. Change it to scan **both** files, or the iOS-Safari guard silently stops guarding.

### Step 2 — NaN-tolerant transport for the server

New `src/server/beast/nan-tolerant-transport.ts`:

```ts
import { AbstractTransport } from 'roslib';
import { repairNonFiniteTokens } from '@/lib/ros/frame';

class NanTolerantWsTransport extends AbstractTransport {
  constructor(private socket: WebSocket) { super(); this.registerEventListeners(); }
  send(m: unknown) { this.socket.send(JSON.stringify(m)); }
  close() { this.socket.close(); }
  isConnecting() { return this.socket.readyState === WebSocket.CONNECTING; }
  isOpen()       { return this.socket.readyState === WebSocket.OPEN; }
  isClosing()    { return this.socket.readyState === WebSocket.CLOSING; }
  isClosed()     { return this.socket.readyState === WebSocket.CLOSED; }

  // roslib's handleRawMessage swallows the parse failure into an 'error' event, so we
  // cannot detect it after the fact — probe first, repair only on failure. Strings only;
  // ArrayBuffer/Blob (CBOR/BSON) pass straight through to the base implementation.
  protected handleRawMessage(data: unknown) {
    if (typeof data === 'string') {
      try { JSON.parse(data); }
      catch { super.handleRawMessage(repairNonFiniteTokens(data)); return; }
    }
    super.handleRawMessage(data);
  }

  private registerEventListeners() {
    this.socket.onopen    = (e) => this.emit('open', e);
    this.socket.onclose   = (e) => this.emit('close', e);
    this.socket.onerror   = (e) => this.emit('error', e);
    this.socket.onmessage = (e) => this.handleRawMessage(e.data);
  }
}

export const nanTolerantTransportFactory = async (url: string) => {
  const socket = new WebSocket(url);       // Node ≥22 global; server route, not edge
  socket.binaryType = 'arraybuffer';
  return new NanTolerantWsTransport(socket);
};
```

This mirrors roslib's own `NativeWebSocketTransport` (which is **not** exported from the
package root — check before assuming you can subclass it) and keeps fragment / CBOR / BSON
/ PNG handling by delegating to `super`. Cost: one extra `JSON.parse` per string frame on
three low-rate topics. **Do not port this double-parse into the browser client**, which
already parses once and repairs only on throw.

Wire it in `ros-singleton.ts`: widen `RosLibLike['Ros']` to
`new (opts?: { url?: string; transportFactory?: unknown }) => RosHandle`, and construct
`new this.roslib.Ros({ transportFactory: nanTolerantTransportFactory })` at `:315`.

### Step 3 — stop conflating a decode error with a dead link

`ros-singleton.ts:134`:

```ts
private onError = (err: unknown) => {
  this.lastError = err instanceof Error ? err.message : String(err ?? 'rosbridge error');
  // roslib routes frame-decode failures to the same 'error' event as transport
  // failures. A dropped frame must never make stop() refuse to send a cancel.
  if (!this.ros?.isConnected) this.state = 'error';
};
```

### Step 4 — the two contract bugs

- `:320-325` — `void ros.connect(this.url).catch((err) => { this.onError(err); this.scheduleReconnect(); })`,
  and retype `RosHandle.connect` (`:16`) as `connect(url: string): Promise<void> | void`.
- `:452` — `action.sendGoal(goal, () => {}, undefined, (e: string) => { this.lastError = e; })`.

### Step 5 — guards, so this is not re-litigated

- Comment at the top of `ros-singleton.ts`: roslib is server-only, loaded dynamically,
  kept for the ROS 2 **Action** protocol; the browser client deliberately does not use it;
  it needs the NaN-tolerant transport because rosbridge 2.0.7 emits bare `NaN`.
- Comment at the top of `client.ts` next to the message-type contract: why this file is
  hand-written and not roslib — one line per §3 row, pointing here.

## 7. Tests

**Add:**

1. `frame.test.ts` (or keep in `ros-client.test.ts`): the two existing raw-payload cases
   move/extend to the extracted functions — bare `NaN` repaired, `NaN` inside a quoted
   string untouched, escaped quote not treated as a terminator.
2. `ros-singleton.test.ts`: feed a raw `/scan` frame containing bare `NaN` through the
   transport and assert (a) `scanAlive` becomes `true`, (b) `getConnectionState()` stays
   `'connected'`. This is the regression that ships today.
3. `ros-singleton.test.ts`: an `'error'` event while `ros.isConnected` is true must leave
   `stop()` able to dispatch a cancel.
4. Source guard: no file under `src/lib/` or `src/components/` may reference `roslib`
   (static or dynamic). Cheap, and it is the thing that keeps the verdict.
5. Extend the message-type contract test to cover `STATUS_TOPICS` in `ros-singleton.ts` —
   it is a second, currently **unpinned** copy of the same DDS type strings
   (`/ugv/allow_motion`, `/ugv/voltage`, `/scan`). A wrong string there is silently dead
   in exactly the way `ros-client.test.ts:206` was written to prevent.

**What would have broken had we migrated the browser client** — recorded so the next agent
does not re-cost it. In `src/__tests__/ros-client.test.ts`, these fail against roslib:

- `'puts those exact types on the wire, with attributable ids'` — roslib ids are
  `subscribe:/scan:<uuid>`, not `sub:/scan`; the `id` assertions fail for all 12 subs and
  4 advertises.
- `'unsubscribes /map when the bridge starts fragmenting an oversized dump'` — roslib
  buffers the fragment; no `unsubscribe`, no fault.
- both `'non-finite defence'` scan/voltage cases and both `/diagnostics` string cases —
  the frames never arrive.
- `'attributes an error frame to the topic whose op was refused'` and
  `'records a warning without declaring the control dead'` — `status:<id>` has no listener.
- all three service-call failure cases (`timeout`, `socket closes`, `socket not open`) —
  no local timeout, no fail-on-close, and `id` is `call_service:…` not `call_…`.
- `'re-subscribes instead of early-returning on an already-open socket'` — `Ros.connect`
  early-returns while the transport is not closed.
- Survives unchanged: the staleness suite, snapshot identity, LiDAR crop/rotation, map
  ingest arithmetic, reconnect backoff (still ours), and the no-lookbehind source scan.

## 8. Done when

- `roslib` still declared at `^2.1.0`; no dependency added or removed.
- `src/lib/ros/frame.ts` exists; `client.ts` imports it; **no behavioural diff** in
  `client.ts` (`git diff` shows deletions + one import, nothing else).
- The server bridge constructs `Ros` with `nanTolerantTransportFactory`.
- A raw `NaN`-bearing `/scan` frame through the server transport yields `scanAlive: true`
  and leaves the state `'connected'`.
- `connect()` rejection is handled; `sendGoal` has a result callback.
- The no-lookbehind test scans both files; the source guard and the `STATUS_TOPICS` type
  pin are in place.
- Web test suite green. No robot deploy — this is web-side only, so no
  `docs/beast-ops.md` Quick connect update is owed.
- **Delete this plan.** Executed plans are not archived; git is the archive. Land the
  durable half as an `append_insight` first (see §9).

## 9. Risk, rollback, and what to land in the Datacore

**Risk of this plan (low).** The browser client is untouched behaviourally. The server
changes are additive and currently-broken paths can only get better — the worst realistic
failure is the custom transport mishandling a binary frame, which the server never
negotiates (no `compression` is ever requested). Rollback is reverting one PR; the server
bridge returns to today's behaviour, which is degraded but not new.

**Risk of the rejected migration (high, and asymmetric).** It would have to re-prove, on
hardware: LiDAR renders at all; a refused advertise still marks a control dead; an
oversized `/map` still gets dropped instead of reassembled; a mid-drive Wi-Fi dropout does
not replay queued Twists at reconnect; disarm still fails closed within 3 s when the
service is silent. Four of those five are behaviours roslib implements the opposite way,
so each needs a subclass or a wrapper — i.e. the code we already have, with a dependency
underneath it.

**Land as an insight** (`POST /api/hangar/ingest`, `append_insight`, `units: ["beast"]`)
before deleting this file — this is the fact that keeps getting re-derived:

> `ins-rosbridge-bare-nan-breaks-roslib` — rosbridge 2.0.7 serialises with
> `json.dumps` (`protocol.py:352`, no `allow_nan=False`), so float `NaN`/`Infinity` go on
> the wire as bare tokens that are **not valid JSON**. Measured 2026-08-14: one live
> BEAST-01 `/scan` frame carries 149 bare `nan`s. Any client that calls plain `JSON.parse`
> — including roslib 2.1.0's `handleJsonMessage` — loses the entire frame. The Hangar
> browser client repairs these outside string literals (`src/lib/ros/frame.ts`); anything
> else talking to this bridge must do the same.
