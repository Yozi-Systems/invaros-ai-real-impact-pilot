# Changelog

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
