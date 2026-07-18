# Controlled deployment and rollback runbook

> IPC artifact note (2026-07-18): the current repository artifact replaces the
> historical `mode`/`fault` decision with the fixed authorization socket and a
> 1,000 ms client deadline. Preserve historical steps below as PILOT-003 evidence.

## IPC qualification addendum

Require a running, hash-recorded `invarosd`, `/run/invarosd` root:invaros 0750,
and `openclaw-authorize.sock` root:invaros 0660. Confirm UID 1001 peer acceptance
and a distinct daemon PID. Plugin config must materialize exactly
`{"socketPath":"/run/invarosd/openclaw-authorize.sock","timeoutMs":1000}`.

After `npm run build` and `npm test`, repeat managed-install identity gates. Run
DENY (daemon `pilot.prohibited_marker`, HTTP 403, unchanged sentinel), ALLOW
(`pilot.allowed_marker`, HTTP 200, one sentinel record), then daemon-unavailable,
malformed, delayed, mismatched-correlation, replay, collision, stale, and parallel
cases. Never expose credentials/raw params. Logs are not cryptographic or
tamper-proof evidence.

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

## Operator command interface

When an operator executes privileged steps through a command relay, every supplied
command must satisfy all of these requirements:

1. Emit the command inside a fenced `bash` block.
2. Use one logical shell line unless multiline shell syntax is explicitly required,
   such as a reviewed heredoc.
3. Never insert a line break inside an executable path, filesystem path, quoted
   string, JSON value, shell expression, or environment-variable assignment.
4. Ensure the command is directly copy/paste safe from the operator interface.
5. Rewrite an impractically long command instead of visually or logically wrapping
   it.
6. Follow every command with its purpose, expected output, and stop conditions.

A command that violates any of these rules is invalid and must be regenerated
before execution. Output from a literally executed malformed rendering is recorded
as a command-formatting artifact, not as OpenClaw or PILOT-003 runtime evidence.

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

1. Install only the hash-verified reviewed source artifact through the installed
   CLI-managed `openclaw plugins install` local-path mechanism. Do not choose or
   manually populate an extension destination: installed 2026.6.10 passes the
   resolved source to `installPluginFromPath()` and records its internally selected
   `result.targetDir` as the persisted `installPath`. For the verified `invaros`
   configuration, the managed root resolves to
   `/home/invaros/.openclaw/extensions`, and the expected target for the fixed ID is
   `/home/invaros/.openclaw/extensions/invaros-interception-probe`.

   The reviewed source artifact originates at
   `/home/yozi/invaros-ai-real-impact-pilot/probes/openclaw-interception`. Because
   the `invaros` deployment uses its approved private staging area, stage only the
   reviewed post-fix artifact at
   `/home/invaros/plugin-staging/openclaw-interception`, then compare its manifest,
   package metadata, built entrypoint, documentation, and hashes with the reviewed
   repository artifact before installation. The copy-install command is:

   ```text
   sudo -u invaros env XDG_RUNTIME_DIR=/run/user/1001 /home/invaros/.npm-global/bin/openclaw plugins install /home/invaros/plugin-staging/openclaw-interception
   ```

   Do not add `--link`, `--force`, `--pin`, an npm/git/ClawHub/marketplace spec, or
   manually create the target. This command remains subject to separate operator
   approval. Stop on any source/hash mismatch, unexpected
   target, overwrite prompt, network resolution, config-policy error, or mutation
   outside the CLI-managed plugin record and target.

   The installed local-directory transaction stages the source below the canonical
   extensions base, validates before publication, rechecks base identity, and
   cleans the stage on failure. Update mode additionally restores its prior target
   from `.openclaw-install-backups` on failure. The dependency-free probe rejects
   source hardlinks and does not run npm. The reviewed source directories are mode
   0775 and files mode 0664; the copy is expected to be owned by UID/GID 1001 and
   preserve those mode bits beneath the private `invaros` configuration tree.
   Post-install inspection must reject symlinks, hardlinks, unexpected entries,
   different ownership/modes, or a target outside the recorded `installPath`.

   Immediate post-install inspection uses the installed record-aware JSON surface:

   ```text
   sudo -u invaros env XDG_RUNTIME_DIR=/run/user/1001 /home/invaros/.npm-global/bin/openclaw plugins inspect invaros-interception-probe --runtime --json
   ```

   In addition to the hook/tool/diagnostic requirements below, require
   `install.source === "path"`,
   `install.sourcePath === "/home/invaros/plugin-staging/openclaw-interception"`, and
   `install.installPath ===
   "/home/invaros/.openclaw/extensions/invaros-interception-probe"`. Stop if the
   install record is absent or any identity/path differs.

   A first install has one recovery limitation: publication precedes the guarded
   configuration/install-record commit, and installed `persistPluginInstall()` has
   no visible compensating removal if that later commit rejects. If installation
   fails after publishing the expected target and `plugins inspect` shows no valid
   registered installation, stop. Do not retry, enable, start the gateway, or
   delete blindly. First verify the canonical expected target, manifest ID,
   complete reviewed file inventory/hashes, UID/GID 1001, reviewed modes and link
   counts; verify plugin inventory/inspect has no valid install record and no other
   source resolves to that target. Use only the separately approved exact-path
   orphan recovery after those predicates pass.

   Normal uninstall cannot remove that orphan because it is record-driven. Only
   after every orphan predicate above is captured may the operator approve removal
   of exactly
   `/home/invaros/.openclaw/extensions/invaros-interception-probe`; recursive or
   wildcard paths and removal of the extensions root are forbidden.

   Installed 2026.6.10 removes a plugin by ID. Before rollback, preview the exact
   managed changes without mutation:

   ```text
   sudo -u invaros env XDG_RUNTIME_DIR=/run/user/1001 /home/invaros/.npm-global/bin/openclaw plugins uninstall --dry-run invaros-interception-probe
   ```

   After the preview names only the fixed probe registration and managed files,
   perform non-interactive CLI-managed removal:

   ```text
   sudo -u invaros env XDG_RUNTIME_DIR=/run/user/1001 /home/invaros/.npm-global/bin/openclaw plugins uninstall --force invaros-interception-probe
   ```

   Do not use `--keep-files` or its deprecated `--keep-config` alias for final
   rollback, and do not manually remove an extension tree. Stop if dry-run output
   is absent, names any other plugin/configuration/files, or differs from the
   subsequently proposed removal.
2. Do not write initial probe configuration after installation. The manifest keeps
   `mode` and `fault` required but declares fail-closed JSON Schema defaults
   `{ "mode": "deny", "fault": "none" }`. Installed 2026.6.10 calls
   `validatePluginConfig()` with `applyDefaults: true` before importing/registering
   the plugin, then passes the materialized object to `api.pluginConfig`. Require
   first-install inspection to load successfully with no stored probe config and
   the default DENY/none behavior. Stop if installation still requires a config
   write, materializes any other value, or emits a config diagnostic.

   For every later non-default scenario, use `openclaw config set` with
   `--strict-json --dry-run` first, then repeat the identical command without
   `--dry-run`. Only the reviewed `mode` and `fault` literals may change.
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

1. **Default and invalid startup configuration:** with no stored probe config,
   require successful load and behavior equivalent to `{ "mode": "deny",
   "fault": "none" }`. Separately test extra and invalid values; require plugin
   rejection, absent probe tool/hook, no evidence writes, and healthy gateway.
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
3. Run the documented ID-based uninstall dry-run and require it to name only the
   fixed probe registration and recorded managed target. Then run the documented
   `plugins uninstall --force invaros-interception-probe` command. Do not manually
   remove a normally recorded installation.
4. Preserve or remove the two fixed evidence files according to the approved evidence-retention decision; never use a broad or recursive deletion command.
5. Start the gateway and require `/healthz` and `/readyz` success.
6. Confirm through the live catalog/effective inventory that the probe tool is absent and the pre-deployment inventory is restored. Hook/lifecycle absence is inferred from removal of the only owning plugin plus reviewed registry replacement/cleanup behavior because installed 2026.6.10 has no direct live hook/lifecycle inspection field.
7. Record final diagnostics, configuration hash, gateway PID, and rollback completion.

If rollback health or inventory differs from the pre-deployment record, stop and escalate; do not make unrelated repairs under this runbook.

### Orphan recovery exception

This exception applies only when first-install publication created the expected
target but persistence failed and both `plugins inspect` and plugin inventory prove
there is no valid entry/install record. After capturing all predicates specified in
the installation section, verify the exact target one final time and remove only it:

```text
sudo -u invaros rm -rf -- /home/invaros/.openclaw/extensions/invaros-interception-probe
```

This command requires separate operator approval after reviewing the captured
predicate evidence. It is forbidden for a recorded installation, symlink,
identity/hash/mode mismatch, another active source, or any path other than the
literal target above. Never remove `/home/invaros/.openclaw/extensions` itself.
