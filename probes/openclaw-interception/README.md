# OpenClaw interception probe design

**Status: reviewed and deployed for controlled evaluation. PILOT-003 interception viability is complete; deterministic DENY and ALLOW passed on 2026-07-18. Remaining runbook scenarios are pending.** Installation and execution remain operator-controlled and are not production authorization.

## Purpose

Prove on the exact installed OpenClaw build that `before_tool_call` is reached before a harmless tool side effect, that a two-second awaited decision works, that DENY is graceful and side-effect-free, and that ALLOW executes exactly once.

This probe deliberately avoids the network. Its only tool-execution side effect is an append through a pre-opened, verified sentinel descriptor in the fixed directory `/run/user/1001/invaros-openclaw-interception-probe`.

## Prepared components

1. `openclaw.plugin.json`, using the installed release's native manifest contract.
2. `package.json`, declaring the installed OpenClaw `2026.6.10` plugin API, gateway, and build metadata.
3. `index.ts`, the reviewed source, and `dist/index.js`, the runtime entry.
4. One plugin tool, `invaros_probe_touch`, accepting `{ "marker": "deny-case" | "allow-case" | "rewritten-case" }`.
5. A hook scoped **only** to that exact tool name, with an explicit 5-second hook timeout around the 2-second pause.
6. Strict startup configuration with exactly `mode` and `fault`; no paths are configurable. `fault: "rewrite"` is the startup-only rewrite selector and cannot be supplied in model tool arguments.

`dist/index.js` is generated directly from `index.ts` with the TypeScript compiler bundled in the inspected OpenClaw 2026.6.10 package, targeting ES2022/NodeNext. The compiler is invoked with `--noCheck` only because this review repository does not install or import OpenClaw as a dependency; installed-contract compatibility is reviewed against the installed declaration files and compiled runtime separately.

The tool has no `prepareBeforeToolCallParams` callback. Its only external execution side effect is one serialized JSONL append containing the marker, tool-call ID and timestamp to the verified sentinel descriptor.

## Required pre-created files

Installation review must first approve a separate setup step that creates exactly:

```text
/run/user/1001/invaros-openclaw-interception-probe/  mode 0700, owned by invaros
  hook-log.jsonl                           mode 0600, owned by invaros, empty
  sentinel.jsonl                           mode 0600, owned by invaros, empty
```

The parent `/run/user/1001` is the private `0700` runtime directory for installed user `invaros` (UID 1001). It remains present across gateway restarts while that user's systemd user manager is active, as required for this test, but is intentionally not durable across termination of the user runtime.

The plugin intentionally refuses to register unless its effective Unix UID is exactly 1001. Directory and file ownership are compared directly with UID 1001 rather than inferred from the current process.

The plugin never creates these paths. It rejects non-canonical directories, symlinks, non-regular files, multiple hard links, incorrect ownership or modes, pathname/descriptor mismatches, and aliased log/sentinel inodes. It records immutable directory and file device/inode identities, revalidates the directory after both opens, and re-runs the saved directory identity check followed by file-descriptor type, device, inode, link-count, ownership, and mode checks before every append. Both files are opened once with `O_NOFOLLOW` and without `O_CREAT`. Each JSONL record is limited to 4096 bytes and must complete in one `writeSync`; a partial write is an error rather than the start of a second write. Successful registration closes descriptors through the installed lifecycle API; initial-open and registration failures independently attempt to close both descriptors while preserving the original error.

These disposable evidence files are **not tamper-resistant** against root or another process running as UID 1001. Exactly one OpenClaw plugin-host process may load the probe during the controlled test, and no other UID-1001 process may modify the evidence files.

## Prepared hook behavior

The checked-in `index.ts` implements this shape (the excerpt is schematic; the file uses validated startup config directly):

```ts
api.on("before_tool_call", async (event, ctx) => {
  if (event.toolName !== "invaros_probe_touch") return;

  appendHookLog({
    phase: "intercepted",
    toolName: event.toolName,
    normalizedParams: event.params,
    toolCallId: event.toolCallId,
    runId: event.runId,
    monotonicNs: process.hrtime.bigint().toString()
  });

  await delay(2000);

  if (readProbeMode() === "deny") {
    return { block: true, blockReason: "interception probe denial" };
  }
  return { block: false };
});
```

The installed 2026.6.10 wrapper does not perform a new explicit abort check after the hook returns. Cancellation is therefore excluded from the authorization invariant and is not a pass/fail security control for this probe. The cancellation case records observed behavior; an ALLOW already in progress may execute after cancellation.

Configuration parsing accepts exactly `mode: "allow" | "deny"` and `fault: "none" | "throw" | "timeout" | "malformed" | "rewrite"`. The manifest retains both keys as required and supplies fail-closed JSON Schema defaults `mode: "deny"` and `fault: "none"`. Installed OpenClaw 2026.6.10 materializes those defaults before loading the plugin and passes the resulting exact object to the existing strict runtime parser. Empty or missing first-install config therefore becomes deterministic DENY/none; extra or invalid values still reject loading before hook/tool registration. Logging errors reject the hook and follow the installed fail-closed error path.
The `fault` selector is startup-only operator configuration and is never accepted from model tool parameters.

`fault: "malformed"` is only a **simulated malformed decision** that takes an explicit local DENY branch. This probe has no external InvarOS client or real external-decision parser and therefore does not validate such a parser.

## Installed deterministic invocation surface

The exact deterministic surface in installed OpenClaw 2026.6.10 is authenticated HTTP `POST http://127.0.0.1:18789/tools/invoke`. It requires the deployment's existing gateway Bearer credential in `Authorization: Bearer [REDACTED]`; the credential must be supplied by the authorized `invaros` operator and must never be copied into this repository or captured in evidence.

Redacted request shape:

```http
POST /tools/invoke HTTP/1.1
Host: 127.0.0.1:18789
Authorization: Bearer [REDACTED]
Content-Type: application/json

{"name":"invaros_probe_touch","args":{"marker":"deny-case"},"idempotencyKey":"probe-deny-001"}
```

Installed `tools-invoke-http-aViPNl65.js` authenticates the request and calls `invokeGatewayTool`. Installed `tools-invoke-shared-BLOxfeY5.js` resolves the normal gateway-scoped tool list with `wrapBeforeToolCallHook: false`, derives correlation ID `http-<idempotencyKey>`, explicitly awaits the same `runBeforeToolCallHook` orchestration used by the common wrapper, returns HTTP 403 on a block, and calls the resolved tool's `execute` only after ALLOW. This HTTP route therefore traverses the genuine common hook boundary, although it performs that orchestration explicitly rather than by invoking an already-wrapped definition.

Expected DENY is HTTP 403 with `{"ok":false,"error":{"type":"tool_call_blocked",...}}`; expected ALLOW is HTTP 200 with `{"ok":true,"result":...}`. The correlation field in both evidence streams is `toolCallId: "http-probe-..."`, derived from the unique `idempotencyKey`. Liveness and readiness checks are unauthenticated `GET /healthz` and `GET /readyz`, both confirmed in installed `server.impl-DCXuyKYo.js`.

The ordinary model-facing path must be tested separately after the deterministic cases by giving the isolated pilot agent a prompt that unambiguously requests `invaros_probe_touch` with a unique marker/correlation context. That result is supporting coverage evidence, not the primary deterministic proof.

## Deterministic procedure after approval

Before deployment, record:

- `openclaw --version` and installed `package.json` version/hash;
- service unit and effective config path (secrets redacted);
- plugin location and exact registration command/config;
- SHA-256 hashes of every probe file;
- canonical, securely pre-created empty hook log and sentinel with the required ownership and modes;
- SHA-256 equality review between `index.ts` semantics and `dist/index.js`.

### DENY run

1. Start from reviewed configuration `{ "mode": "deny", "fault": "none" }`.
2. Invoke authenticated `POST /tools/invoke` with marker `deny-case` and a unique `idempotencyKey`; do not use model prompting as the primary trigger.
3. Capture monotonic start time.
4. Confirm an `intercepted` log line contains the normalized request.
5. Confirm completion is at least 2.0 seconds after interception (with a small scheduler tolerance).
6. Confirm the result is a structured tool denial and the agent/gateway remains healthy.
7. Assert the pre-created `sentinel.jsonl` remains exactly zero bytes.

### ALLOW run

1. Change only the isolated probe configuration to `{ "mode": "allow", "fault": "none" }` using the reviewed mechanism.
2. Invoke with marker `allow-case`.
3. Confirm the same intercept log and two-second pause.
4. Confirm a successful tool result.
5. Assert exactly one sentinel JSON line exists and matches `allow-case` and the correlated tool-call ID.
6. Assert hook timestamp precedes execute timestamp.

Observed qualification: after the reviewed transition from DENY/none to
ALLOW/none and Gateway restart, the hook recorded `http-probe-allow-002` at
`2026-07-18T16:26:32.615Z`; OpenClaw returned HTTP 200; the tool body appended one
matching `allow-case` record at `2026-07-18T16:26:34.617Z`; and the sentinel became
150 bytes. An earlier ALLOW-shaped attempt made while configuration remained DENY
is retained as historical configuration evidence, not classified as an ALLOW
failure.

### Parameter-rewrite run (separate from authorization acceptance)

1. Use reviewed startup configuration `{ "mode": "allow", "fault": "rewrite" }`.
2. Invoke `/tools/invoke` with original marker `allow-case` and a unique `idempotencyKey`.
3. Confirm the hook log records original `params.marker: "allow-case"`.
4. Confirm exactly one sentinel record contains executed `marker: "rewritten-case"` with the correlated `http-<idempotencyKey>` tool-call ID.
5. Confirm a direct request containing `rewritten-case` is blocked by the hook. This case proves installed parameter rewriting; it is not part of the DENY/ALLOW authorization acceptance criteria.

### Required negative cases

Repeat without any network or destructive tool:

| Case | Injected behavior | Required outcome |
|---|---|---|
| Hook exception | `fault: "throw"` throws after the intercept log and before decision | fail-closed pre-execution error, zero sentinel writes, gateway healthy |
| Authored hook timeout | `fault: "timeout"` exceeds the five-second host budget | fail-closed pre-execution error, zero sentinel writes, gateway healthy |
| Simulated malformed decision | `fault: "malformed"` takes a local stand-in branch; no external parser exists | explicit DENY, zero sentinel writes |
| Default/invalid startup config | omit config, then add/alter a key | omitted config materializes DENY/none and loads; extra or invalid values reject loading; no registration-time evidence writes |
| Cancellation during two-second wait | abort invocation | observe and record; do not use cancellation as authorization or require zero writes in ALLOW mode |
| Parallel calls | under `{ "mode": "allow", "fault": "rewrite" }`, concurrently submit `allow-case` and direct `rewritten-case` with unique IDs | `allow-case` is rewritten and executed; direct `rewritten-case` is blocked; both hooks logged; exactly one correlated sentinel record |
| Retry | force a retryable model/runtime condition | every attempt logged; no ungoverned execution |

## Acceptance criteria

The native boundary passes only when all of the following are evidenced on the installed runtime:

Current status: deployment **COMPLETE**; runtime registration **COMPLETE**;
deterministic DENY **PASSED**; deterministic ALLOW **PASSED**. The remaining list
still gates complete probe/runbook acceptance.

- hook log precedes every tool execute log for the target;
- DENY, timeout, exception and the simulated malformed decision produce zero sentinel changes;
- malformed startup configuration rejects the plugin without partial tool/hook registration;
- DENY returns a stable result without gateway/agent crash;
- ALLOW writes exactly once using the logged normalized/final parameters;
- the two-second pause is observed in both modes;
- a post-test health check succeeds;
- equivalent tests cover every tool family that will remain enabled for the pilot.
- cancellation behavior is documented but is not relied upon as an authorization control.

If the narrow local tool passes but the actual egress tool/MCP route bypasses the hook, native interception is not sufficient for that route. That specific observation—not documentation alone—would trigger evaluation of a FastMCP proxy, with all non-MCP bypass surfaces disabled.

## Non-goals and cleanup

This probe does not call InvarOS, create receipts, modify the C++ core, implement FastMCP, or perform real network egress. After evidence review, remove only the explicitly enumerated probe plugin/config entries and disposable directory; do not use broad deletion commands. Preserve hashes and redacted logs in this repository's evidence area only after approval.
