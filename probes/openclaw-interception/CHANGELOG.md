# Changelog

## Deterministic ALLOW qualification — 2026-07-18

- Recorded the reviewed configuration transition from DENY/none to ALLOW/none and
  successful Gateway restart.
- The valid ALLOW invocation returned HTTP 200, with hook record and sentinel
  execution record correlated by `http-probe-allow-002`.
- The hook timestamp/monotonic time preceded the execution record by approximately
  two seconds; the sentinel contained one `allow-case` record and measured 150 bytes.
- Preserved the earlier ALLOW-shaped attempt made while the probe remained in DENY
  mode as historical configuration evidence, not an ALLOW-branch failure.
- Deployment, runtime registration, deterministic DENY, and deterministic ALLOW
  are complete/passed. Throw, timeout, simulated malformed decision, rewrite,
  parallel, retry, model-facing, `invarosd`, C++/intent, receipt, containment, and
  production-governance validation remain.

## PILOT-003 deterministic DENY qualification — 2026-07-18

- Recorded the first live deterministic behavioral proof through authenticated
  OpenClaw `POST /tools/invoke`.
- Request `probe-deny-001` produced correlation ID `http-probe-deny-001`, exactly
  one intercepted hook record, and HTTP 403 `tool_call_blocked` without approval.
- The protected sentinel remained exactly zero bytes, proving the probe tool body
  did not execute.
- PILOT-003 interception viability is complete. Deterministic ALLOW, fault modes,
  evidence packaging, and acceptance review remain; no `invarosd`, IPC, C++ core,
  intent evaluation, cryptographic receipt, egress containment, or end-to-end
  production-enforcement claim is made.

## PILOT-003 first-install compatibility

- Added manifest JSON Schema defaults `mode: "deny"` and `fault: "none"` while
  retaining both properties in `required`. Installed OpenClaw 2026.6.10 validates
  discovered plugin configuration with default materialization before loading the
  plugin and passes the materialized value to `api.pluginConfig`. This permits a
  clean CLI-managed first installation to load fail-closed without weakening enum,
  required-property, or additional-property validation.
- Revised deployment ordering: install, verify the materialized default DENY
  configuration through runtime inspection, then start the gateway. Explicit
  scenario configuration changes still use strict-JSON dry-run before writing.

## Security review revision — 2026-07-17

- Replaced configurable evidence paths with a fixed directory and fixed filenames.
- Required the directory and both evidence files to be pre-created, gateway-owned,
  canonical, non-symlink, correctly permissioned, regular, singly linked, and distinct.
- Removed `O_CREAT`; DENY cannot create the sentinel through either evidence path.
- Opened evidence files once with `O_NOFOLLOW`, retained verified descriptors, and
  registered lifecycle cleanup.
- Serialized each JSONL record as a synchronous append on its retained descriptor.
- Made configuration exact and fail-closed with only `mode` and `fault` keys.
- Added deterministic `throw`, `timeout`, and simulated-malformed negative-test
  scenarios; the simulated malformed decision maps to an explicit DENY.
- Kept hook matching restricted to the exact `invaros_probe_touch` tool name.
- Added a five-second host hook budget; the timeout scenario exceeds that budget
  and is expected to produce a fail-closed pre-execution error.
- Added installed OpenClaw 2026.6.10 compatibility/build metadata and removed the
  peer dependency as a false compatibility control.
- Added a built JavaScript runtime entry and retained TypeScript as reviewed source.
- Revised security claims and the test plan for pre-hook preparation, timeout,
  malformed configuration, and cancellation limitations.
- Replaced the shared `/tmp` location with the private runtime path
  `/run/user/1001/invaros-openclaw-interception-probe`, which persists across
  gateway restarts while the `invaros` user manager remains active.
- Added registration-error descriptor cleanup while retaining lifecycle cleanup
  after successful registration.
- Recorded and revalidated directory/file identities and file invariants, bounded
  evidence records to 4096 bytes, and rejected partial writes.
- Qualified evidence as non-tamper-resistant against root or UID 1001 and required
  exactly one plugin-host process.
- Renamed the malformed case to a simulated malformed decision and stated that no
  external InvarOS decision parser exists in this probe.
- Added startup-only `fault: "rewrite"`, rewriting `allow-case` to the third fixed
  marker `rewritten-case`, plus separate rewrite acceptance steps.
- Documented authenticated HTTP `POST /tools/invoke`, correlation IDs, expected
  responses, health checks, runtime installation gates, and rollback.
- Preserved the original directory identity and revalidates it before every file
  invariant check and append.
- Required effective UID 1001 and compares all probe-path ownership with UID 1001.
- Made initial-open cleanup independently attempt both descriptor closes while
  preserving the original open/validation error.
- Made the parallel scenario deterministic under the single global rewrite config.
- Documented the installed inspection split: standalone runtime inspection exposes
  plugin/hook/tool/diagnostic fields; live catalog/effective RPCs expose tool
  ownership/visibility; no installed live surface exposes lifecycle registrations.
