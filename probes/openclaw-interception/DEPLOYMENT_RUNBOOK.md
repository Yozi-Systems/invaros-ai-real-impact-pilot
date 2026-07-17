# Controlled deployment and rollback runbook

**Status:** review-only. Do not perform this runbook without explicit approval for the live `invaros` deployment. Never record gateway credentials in this repository, shell history, process arguments, or evidence logs.

## Fixed scope

- Installed host: OpenClaw 2026.6.10, commit `aa69b12d0086b631b139c1435c9621a5783e3a40`.
- Gateway: `127.0.0.1:18789`, running as `invaros` (UID/GID 1001).
- Probe ID: `invaros-interception-probe`.
- Tool: `invaros_probe_touch`.
- Evidence directory: `/run/user/1001/invaros-openclaw-interception-probe`.
- Evidence files: `hook-log.jsonl` and `sentinel.jsonl`.
- Deterministic invocation: authenticated `POST /tools/invoke`.

The runtime directory is private mode `0700` and remains available across gateway restarts while the `invaros` systemd user manager remains active. Abort if `/run/user/1001` is absent, not a real directory, not owned by UID 1001, not mode `0700`, or the user manager will be stopped during the test.

The probe itself also asserts that its effective UID is exactly 1001 and compares all probe-directory/file ownership directly with UID 1001. Any other effective UID fails plugin registration before evidence files are opened.

## Required authority

An approved operator may act only as `invaros` to pre-create the fixed evidence paths, install the reviewed plugin artifact, edit the minimum probe plugin configuration, restart the `invaros` user gateway, invoke only the probe tool, inspect redacted diagnostics/evidence, and remove those exact additions during rollback. Unrestricted sudo, root, OpenClaw package modification, and changes to InvarOS, FastMCP, or unrelated configuration are out of scope.

## Pre-deployment record

1. Record the installed OpenClaw version, build commit, service command, effective configuration path, and current gateway PID.
2. Record SHA-256 hashes of `index.ts`, `dist/index.js`, the plugin manifest and package metadata, this runbook, README, and CHANGELOG.
3. Back up the effective OpenClaw configuration to an approved private location owned by `invaros`; do not copy secrets into this repository.
4. Record the existing plugin and effective-tool inventories with credentials redacted.
5. Confirm no existing plugin ID, lifecycle ID, hook registration, or tool name collides with the fixed probe identifiers.
6. Confirm the deployment will have exactly one OpenClaw plugin-host process. No second gateway, plugin-tools MCP server, validator process, or development loader may load this plugin.
7. Confirm no other process running as UID 1001 will modify the evidence directory or files. Evidence is not tamper-resistant against that UID or root.
8. Review the exact configuration delta and rollback delta before stopping the gateway.

## Evidence setup

With the gateway stopped but the `invaros` user manager still active, the approved operator must create exactly the fixed directory and two empty files. Use a restrictive umask and operations that fail if a path already exists. Verify with non-following metadata inspection that:

- the parent and probe directory are real directories, not symlinks;
- the probe directory is owned by UID/GID 1001 and mode `0700`;
- both files are regular, non-symlink, empty, owned by UID/GID 1001, mode `0600`, and have link count one;
- the two files have different device/inode identities;
- their canonical parent is the fixed probe directory.

Abort rather than repairing an unexpected pre-existing object in place. Do not use recursive ownership, mode, or deletion commands.

## Installation and startup gates

### Installed 2026.6.10 inspection limitation

There is no single exact live-gateway inspection surface for all registrations:

- `openclaw plugins inspect invaros-interception-probe --runtime --json` loads a separate inspection registry in the CLI process. Its JSON exposes `plugin.id`, `plugin.status`, `typedHooks[]` (`name`, `priority`), `tools[]` (`names`, `optional`), and plugin-scoped `diagnostics[]`. It does **not** query the active gateway and does not expose `runtimeLifecycles`.
- Authenticated live RPC `tools.catalog` reads the active gateway registry and exposes plugin tool ownership as `groups[]` with `source: "plugin"`, `pluginId`, and `tools[].id`/`tools[].pluginId`.
- Authenticated live RPC `tools.effective` exposes whether that owned tool remains visible in the selected session, including its `id`, `source`, and `pluginId`.
- Installed 2026.6.10 exposes no live RPC/CLI field for the active typed-hook or runtime-lifecycle registry and no lifecycle entry in plugin-inspect JSON.

Therefore hook and lifecycle presence cannot both be proven from a pre-invocation live introspection response. The strongest reproducible compensation is: inspect the separate runtime registry while the gateway is stopped; require exact hook/tool fields and zero diagnostics; let that CLI process exit; verify no inspection process remains; start exactly one gateway; verify live tool ownership/visibility; and make the harmless DENY case the first invocation. Its correlated hook record, HTTP 403, and unchanged sentinel are the live hook proof. Lifecycle registration is supported by reviewed source ordering—lifecycle registration precedes the exposed hook/tool registrations—and zero inspection diagnostics, then is behaviorally checked during controlled gateway shutdown. This is an explicit evidence limitation, not a claim of direct live lifecycle introspection.

1. Install only the hash-verified reviewed plugin artifact in the approved plugin location.
2. Apply only the reviewed probe entry with initial configuration `{ "mode": "deny", "fault": "none" }`.
3. While the gateway is stopped and no other plugin host exists, run `openclaw plugins inspect invaros-interception-probe --runtime --json` as UID 1001. Require `plugin.id === "invaros-interception-probe"`, `plugin.status === "loaded"`, exactly one `typedHooks` entry with `name === "before_tool_call"` and `priority === 100`, exactly one tool name `invaros_probe_touch`, and an empty `diagnostics` array.
4. Let the inspection CLI exit and verify that no inspection/plugin-host process remains. Do not run runtime inspection concurrently with the gateway.
5. Start the single gateway and wait for both `GET http://127.0.0.1:18789/healthz` and `/readyz` to succeed.
6. Through the authenticated gateway client, run `openclaw gateway call tools.catalog --params '{"includePlugins":true}' --json`. Require exactly one plugin group with `pluginId === "invaros-interception-probe"` and exactly one `invaros_probe_touch` tool whose `source === "plugin"` and `pluginId` matches.
7. Run `openclaw gateway call tools.effective --params '{"sessionKey":"main"}' --json`. Require exactly one entry under `groups[].tools[]` with `id === "invaros_probe_touch"`, `source === "plugin"`, and `pluginId === "invaros-interception-probe"` for the isolated test session.
8. Before the first invocation, require all directly observable gates below:

   - the stopped-gateway inspection loaded only the requested plugin ID `invaros-interception-probe` successfully;
   - the live catalog/effective responses contain exactly one tool named `invaros_probe_touch`, owned by that plugin;
   - the stopped-gateway runtime inspection reported the exact `before_tool_call` hook and priority;
   - reviewed source registers lifecycle `invaros-interception-probe-files` before the hook/tool, with no inspection diagnostic; direct live lifecycle introspection is unavailable;
   - no collision, load, schema, hook, tool, lifecycle, or registration diagnostic exists;
   - exactly one plugin-host process has loaded the probe;
   - both evidence files still satisfy the required identities and invariants.

If any directly observable gate fails, do not invoke any tool. Stop and perform rollback. Because live hook presence is not introspectable, the first and only permissible behavioral gate is the harmless DENY scenario; abort before every later scenario unless it produces the exact correlated hook record, HTTP 403, zero-byte sentinel, and healthy gateway.

## Authentication and request handling

Use the deployment's existing authorized gateway Bearer credential without displaying or persisting it. The approved client sends it in the `Authorization` header to loopback. A request has this redacted shape:

```json
{
  "name": "invaros_probe_touch",
  "args": { "marker": "deny-case" },
  "idempotencyKey": "probe-deny-001"
}
```

Use a new, recorded `idempotencyKey` for every attempt. Installed OpenClaw derives evidence correlation ID `http-<idempotencyKey>`. Expected DENY is HTTP 403 with error type `tool_call_blocked`; expected ALLOW is HTTP 200 with `ok: true`. Do not use `confirm: true` for this probe.

## Scenario sequence

Each configuration change requires the approved gateway restart mechanism, successful health/readiness checks, and repetition of every startup gate. Capture file metadata and size before and after every case.

1. **Malformed/missing startup configuration:** test missing, extra, and invalid keys. Require plugin rejection, absent probe tool/hook, no evidence writes, and healthy gateway.
2. **Hook exception:** `{ "mode": "allow", "fault": "throw" }`, request `allow-case`. Require fail-closed error and unchanged sentinel.
3. **Authored hook timeout:** `{ "mode": "allow", "fault": "timeout" }`, request `allow-case`. Require failure after the five-second host budget and unchanged sentinel.
4. **Simulated malformed decision:** `{ "mode": "allow", "fault": "malformed" }`, request `allow-case`. Require explicit block and unchanged sentinel. This is not a test of an external parser; none exists.
5. **DENY:** `{ "mode": "deny", "fault": "none" }`, request `deny-case`. Require one correlated hook record after the two-second wait, HTTP 403, and unchanged sentinel.
6. **ALLOW:** `{ "mode": "allow", "fault": "none" }`, request `allow-case`. Require one correlated hook record, HTTP 200, and exactly one later sentinel record containing `allow-case`.
7. **Parameter rewrite (separate):** `{ "mode": "allow", "fault": "rewrite" }`, request `allow-case`. Require the hook record to contain `allow-case` and the sole correlated sentinel record to contain `rewritten-case`. A direct `rewritten-case` request must be blocked.
8. **Parallel calls:** under `{ "mode": "allow", "fault": "rewrite" }`, concurrently submit `allow-case` and direct `rewritten-case` with distinct IDs. Require hook records for both attempts; require `allow-case` to be rewritten to `rewritten-case` and executed; require direct `rewritten-case` to be blocked; and require exactly one complete, correlated sentinel record.
9. **Retry:** induce only the reviewed, harmless retry condition. Require every attempt to have a unique ID and traverse the hook; do not infer retry behavior from duplicate model output.
10. **Cancellation observation:** cancel during the two-second wait and record behavior. Do not require cancellation to prevent an already-allowed execution and do not treat it as an authorization control.
11. **Ordinary model-facing path:** in the isolated pilot session, request this exact tool and correlate its hook/execute records. Keep this separate from the deterministic HTTP proof.

After every scenario, require `/healthz` and `/readyz` success and inspect gateway diagnostics. Stop immediately on an unexpected sentinel change, malformed evidence, collision, second plugin host, or gateway instability.

## Evidence handling

Copy only redacted probe records, hashes, sizes, timestamps, device/inode metadata, HTTP status/result shapes, and health results into an approved repository evidence location. Never copy credentials, private endpoint values, unrelated configuration, or unrelated gateway logs. These artifacts demonstrate probe behavior but are not cryptographic receipts or tamper-resistant audit records.

## Rollback

1. Stop the gateway using only the approved `invaros` user-service operation.
2. Remove only the exact probe plugin entry and restore the reviewed prior configuration state.
3. Remove only the exact installed probe artifact after confirming its path and hash.
4. Preserve or remove the two fixed evidence files according to the approved evidence-retention decision; never use a broad or recursive deletion command.
5. Start the gateway and require `/healthz` and `/readyz` success.
6. Confirm through the live catalog/effective inventory that the probe tool is absent and the pre-deployment inventory is restored. Hook/lifecycle absence is inferred from removal of the only owning plugin plus reviewed registry replacement/cleanup behavior because installed 2026.6.10 has no direct live hook/lifecycle inspection field.
7. Record final diagnostics, configuration hash, gateway PID, and rollback completion.

If rollback health or inventory differs from the pre-deployment record, stop and escalate; do not make unrelated repairs under this runbook.
