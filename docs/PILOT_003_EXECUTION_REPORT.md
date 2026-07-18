# PILOT-003 execution report

**Date:** 2026-07-17 through 2026-07-18 UTC
**Current result:** **PILOT-003 COMPLETE — PRE-EXECUTION INTERCEPTION VIABILITY PROVED**
**Current phase:** **PILOT-004 behavioral validation in progress; deterministic DENY and ALLOW passed**

## OpenClaw-to-invarosd IPC implementation milestone — 2026-07-18

The repository now contains the v1 Unix-stream client and real `invarosd` service.
A process evidence run used daemon PID 1837274 and Node client-harness PID 1837256.
It passed daemon-side DENY/ALLOW, matching parameter digests, peer PID/UID/GID,
replay, request-ID collision, stale denial, parallel isolation, socket cleanup, and
daemon-unavailable fail-closed assertions. Evidence is in
`evidence/ipc-authorization-20260718/`.

This is real-daemon IPC evidence, not a new live OpenClaw native-hook
qualification. Deployment/restart was blocked because `sudo -n true` returned
`sudo: a password is required`. Prior PILOT-003 evidence remains unchanged; the
new artifact has not yet produced live Gateway HTTP 403/200 evidence.

The narrow policy is not TBOM evaluation, a cryptographic receipt, kernel
mediation, hostile-runtime integrity, tamper-proof logging, OpenWrt qualification,
or general production readiness.

The earlier blocked and failed-install states below are retained as chronological
engineering history. They are superseded by the corrected installation,
deployment qualification, and deterministic DENY result recorded here.

## Deterministic DENY behavioral proof — 2026-07-18

At `2026-07-18T15:30:29.811Z`, the authenticated deterministic OpenClaw Gateway
surface received this sanitized request (Authorization material is deliberately
excluded):

```text
POST http://127.0.0.1:18789/tools/invoke
```

```json
{
  "name": "invaros_probe_touch",
  "args": { "marker": "deny-case" },
  "idempotencyKey": "probe-deny-001"
}
```

The Gateway returned `HTTP/1.1 403 Forbidden`:

```json
{
  "ok": false,
  "error": {
    "type": "tool_call_blocked",
    "message": "InvarOS interception probe denial",
    "requiresApproval": false
  }
}
```

The hook emitted exactly one correlated record at
`/run/user/1001/invaros-openclaw-interception-probe/hook-log.jsonl`:

```json
{
  "phase": "intercepted",
  "mode": "deny",
  "fault": "none",
  "toolName": "invaros_probe_touch",
  "params": { "marker": "deny-case" },
  "toolCallId": "http-probe-deny-001",
  "runId": null,
  "wallTime": "2026-07-18T15:30:29.811Z",
  "monotonicNs": "1484185587756486"
}
```

The protected tool-body sentinel at
`/run/user/1001/invaros-openclaw-interception-probe/sentinel.jsonl` remained
exactly zero bytes. The shared correlation value `http-probe-deny-001` binds the
Gateway attempt to the hook record. Together, the structured denial and unchanged
sentinel prove that the native awaited `before_tool_call` hook ran before the
protected tool body and prevented that body from executing without requesting
human approval.

### Milestone interpretation

- **PILOT-003: COMPLETE.** OpenClaw loaded and exposed the probe tool; the
  deterministic Gateway endpoint reached it; the synchronous pre-execution hook
  denied it; and the zero-byte sentinel proved non-execution.
- **PILOT-004 behavioral validation: IN PROGRESS.** The deterministic DENY and
  ALLOW cases passed. The runbook-required fault/fail-closed, rewrite, parallel,
  retry, model-facing, evidence-packaging, and acceptance-review gates remain.
- These proofs cover only the probe's deterministic DENY and ALLOW branches. They
  do not prove `invarosd`, IPC, the C++ math core, intent evaluation, cryptographic
  refusal receipts, network-egress containment, production enforcement, or the
  complete end-to-end pilot.

## Deterministic ALLOW behavioral proof — 2026-07-18

The reviewed OpenClaw configuration procedure changed only the probe state from
`{ "mode": "deny", "fault": "none" }` to
`{ "mode": "allow", "fault": "none" }`, followed by a successful Gateway
restart. A deterministic invocation then returned `HTTP 200 OK`:

```json
{
  "ok": true,
  "result": {
    "content": [
      { "type": "text", "text": "probe executed: allow-case" }
    ]
  }
}
```

The hook emitted this correlated pre-execution record:

```json
{
  "phase": "intercepted",
  "mode": "allow",
  "fault": "none",
  "toolName": "invaros_probe_touch",
  "params": { "marker": "allow-case" },
  "toolCallId": "http-probe-allow-002",
  "runId": null,
  "wallTime": "2026-07-18T16:26:32.615Z",
  "monotonicNs": "1487548392402398"
}
```

The protected tool body then appended exactly the correlated execution record:

```json
{
  "phase": "executed",
  "marker": "allow-case",
  "toolCallId": "http-probe-allow-002",
  "wallTime": "2026-07-18T16:26:34.617Z",
  "monotonicNs": "1487550394362585"
}
```

The sentinel size after execution was 150 bytes. The matching
`http-probe-allow-002` identifier and monotonic timestamps show that the hook ran
first, the two-second decision interval completed, and the protected body then
executed exactly once with `allow-case`.

### Preserved earlier invalid ALLOW attempt

An earlier attempt used an ALLOW-shaped request while the probe configuration was
still `{ "mode": "deny", "fault": "none" }`. Its denial was correct for the
active configuration but could not qualify the ALLOW branch. That attempt remains
historical evidence of configuration-state discipline; it is not reclassified as
an ALLOW failure and is not replaced by the later valid ALLOW proof.

### Two-path behavioral result

- **DENY passed:** hook executed; HTTP 403; protected tool body did not execute;
  sentinel remained unchanged.
- **ALLOW passed:** hook executed; HTTP 200; protected tool body executed exactly
  once; sentinel contains the correlated execution record.
- **Not yet verified:** throw, timeout, simulated malformed decision, rewrite,
  parallel execution, retry, model-facing execution, `invarosd`, C++ policy and
  mathematical intent evaluation, cryptographic refusal receipts, network
  containment, and production governance.

## Resume attempt after operator authentication

The operator reported authenticating the current sudo session with `sudo -v` and
authorized resumption from the recorded authority gate. The first previously
blocked, narrowly scoped command was retried exactly:

```text
sudo -n -u invaros env XDG_RUNTIME_DIR=/run/user/1001 /home/invaros/.npm-global/bin/openclaw --version
```

It failed with:

```text
sudo: a password is required
```

The sudo timestamp established by the operator is therefore not visible in this
execution context (for example, sudo may be using a per-terminal or otherwise
context-scoped timestamp). In accordance with the resume instruction, execution
stopped immediately. No second sudo command, alternate identity mechanism, broader
permission request, installation, configuration change, service operation, or
probe invocation was attempted.

The operator subsequently executed the same version check manually in an
authenticated terminal:

```text
sudo -u invaros env XDG_RUNTIME_DIR=/run/user/1001 \
  /home/invaros/.npm-global/bin/openclaw --version
```

Observed output:

```text
OpenClaw 2026.6.10 (aa69b12)
```

This passes the runbook's installed-version check and confirms that the operator
can perform the required commands as `invaros`. PILOT-003 resumes through a
one-command-at-a-time operator relay. The earlier non-interactive sudo failures
describe only this automation context's credential-cache isolation; they are not
OpenClaw deployment attempts or pilot runtime failures. Any earlier literal
command containing `...` is an invalid placeholder and is not evidence of an
attempted deployment operation.

## Blocking discrepancy

The committed deployment runbook requires approved operations to be performed as
the separate Unix user `invaros` (UID 1001). The execution session cannot assume
that identity non-interactively: each attempted `sudo -n -u invaros ...` command
failed with `sudo: a password is required`.

This differs from the runbook prerequisite that an approved operator can act as
`invaros`. The failure occurred during the read-only pre-deployment record, before
the gateway was stopped and before any installation, configuration, evidence-path,
or service change. No alternate privilege mechanism was attempted because that
would depart from the reviewed runbook and authorization boundary.

## Chronological execution log

1. Confirmed the repository was clean at committed baseline
   `49164245b4adf401b62eff166072431caa563695` (`4916424 Add hardened OpenClaw
   interception probe for controlled evaluation`).
2. Read the committed `probes/openclaw-interception/DEPLOYMENT_RUNBOOK.md` and
   recorded the reviewed probe artifact hashes.
3. Began the runbook's read-only pre-deployment checks.
4. Confirmed `/run/user/1001` is a directory owned by UID/GID 1001 with mode 0700.
5. Confirmed exactly one matching gateway process was running before deployment:
   PID 1249, `/usr/bin/node .../openclaw/dist/index.js gateway --port 18789`.
6. Attempted the required read-only version, user-service, plugin inventory, tool
   catalog, and effective-tool queries as `invaros` using non-interactive,
   specifically scoped `sudo -n -u invaros` commands.
7. Each identity-changing command failed with `sudo: a password is required`.
8. Stopped the runbook immediately without installing or changing anything.
9. Confirmed the existing gateway remained live and ready and the repository
   remained clean.
10. After operator `sudo -v`, resumed at the authority gate and retried only the
    exact scoped OpenClaw version command.
11. Received `sudo: a password is required` again and stopped immediately.
12. Operator manually ran the exact OpenClaw version command as `invaros` and
    observed `OpenClaw 2026.6.10 (aa69b12)`.
13. Reclassified the authority gate as satisfied through operator relay and resumed
    PILOT-003 without repeating the completed baseline evidence.
14. Operator queried the `invaros` user service and observed `MainPID=1249`,
    `ActiveState=active`, `SubState=running`, and `ExecStart` pointing to the
    expected OpenClaw gateway executable. The pre-deployment gateway verification
    gate passed.
15. A backup command supplied through the operator relay was rendered with embedded
    line breaks inside quoted paths. The operator executed the malformed rendering
    literally and received:

    ```text
    sh: 2: openclaw.json.pilot-003.predeployment: not found
    sh: 3: home/invaros/.openclaw/openclaw.json: not found
    sh: 4: openclaw.json.pilot-003.predeployment: not found
    ```

    This is classified as an invalid command-formatting artifact, not a deployment
    attempt, pilot failure, runtime discrepancy, or OpenClaw failure.
16. Operator performed read-only state verification and observed:

    ```text
    /home/invaros/.openclaw/openclaw.json uid=1001 gid=1001 mode=600 size=5664
    BACKUP_ABSENT
    ```

    This confirmed the malformed command created no backup or partial state.
17. Operator then created the pre-deployment backup successfully and observed:

    ```text
    /home/invaros/.openclaw/openclaw.json.pilot-003.predeployment uid=1001 gid=1001 mode=600 size=5664
    ```

    The pre-deployment configuration backup gate passed.
18. The supplied plugin-inventory command was rendered with an embedded line break
    inside `/home/invaros/.npm-global/bin/openclaw`. The operator executed the
    malformed rendering and observed:

    ```text
    env: ‘/home/invaros/.npm-global/’: Permission denied
    -bash: bin/openclaw: No such file or directory
    ```

    The shell attempted to execute `/home/invaros/.npm-global/` as the executable
    and interpreted `bin/openclaw` as a second command. OpenClaw did not execute,
    no plugin registry was queried, and no deployment evidence was collected. This
    is classified as an invalid operator command caused by embedded line wrapping,
    not a deployment or pilot failure.
19. Adopted a mandatory operator-command interface after the two formatting
    artifacts. Every future operator command must be a single logical line in a
    fenced `bash` block, contain no embedded breaks in paths/quotes/JSON/shell
    expressions/environment assignments, be copy/paste safe, and be followed by
    purpose, expected output, and stop conditions. Any violating command is invalid
    and must be regenerated before execution.
20. Operator successfully executed the corrected plugin inventory command:

    ```text
    sudo -u invaros env XDG_RUNTIME_DIR=/run/user/1001 /home/invaros/.npm-global/bin/openclaw plugins list --json
    ```

    Raw evidence location: the operator transcript in the PILOT-003 conversation,
    delimited by `BEGIN RAW PLUGIN INVENTORY JSON` and `END RAW PLUGIN INVENTORY
    JSON`. The transcript includes the shell prompt/command line before the JSON
    payload, so the complete delimited transcript is not itself a JSON document.
    The JSON payload was inspected in full, but no byte-identical local evidence
    file was supplied to a parser; parser-level syntactic validation therefore
    remains unproven and the gate is not marked PASS.
21. Exact inventory observations:

    - no plugin ID exactly equal to `invaros-interception-probe` was present;
    - no visually equivalent normalized probe identifier was present;
    - no duplicate plugin ID was observed in the supplied payload, although an
      exact parser-backed uniqueness check remains part of the unproven JSON gate;
    - the top-level `diagnostics` array was empty;
    - `registry.diagnostics` was non-empty with informational code
      `persisted-registry-missing`, stating that the derived plugin index was used;
    - no plugin had `status: "error"` in the supplied payload;
    - enabled plugin `canvas` reported `dependencyStatus.installed: false`,
      `dependencyStatus.requiredInstalled: false`, and missing required packages
      `@a2ui/lit`, `@lit/context`, and `lit`;
    - disabled plugin `oc-path` also reported missing dependencies, but it was not
      active.

    The enabled `canvas` dependency condition is classified as a pre-existing host
    plugin dependency discrepancy. The runbook/instruction requires stopping on a
    dependency failure rather than engineering around it. No installation step was
    started.
22. The operator re-executed the inventory command with stdout redirected directly
    to `/tmp/pilot-003-plugin-inventory.json`. The JSON-only artifact was reported
    as 151440 bytes and was parsed locally with `JSON.parse`; parsing succeeded.
    Programmatic validation found 77 plugin records, zero duplicate IDs, zero
    matches for `invaros-interception-probe`, an empty top-level `diagnostics`
    array, zero plugin-local non-empty diagnostic arrays, and zero plugin statuses
    other than `loaded` or `disabled`.
23. The registry source is `derived`. Its sole diagnostic is level `info`, code
    `persisted-registry-missing`; this is an explicit fallback state, not a registry
    load failure, and the inventory was derived successfully. Dependency analysis
    found exactly two records with unavailable required dependencies:

    - `canvas`: enabled and `loaded`; `installed: false`,
      `requiredInstalled: false`; missing `@a2ui/lit`, `@lit/context`, and `lit`;
    - `oc-path`: disabled; missing `jsonc-parser` and `markdown-it`.

    Because `canvas` is reported `loaded`, has no plugin diagnostic, does not own
    the fixed probe ID or tool, and its missing UI dependencies are unrelated to
    the interception probe execution path, this is classified as pre-existing
    host state outside PILOT-003 rather than a probe-deployment blocker. No repair
    or configuration change is authorized or required. The parser-backed plugin
    inventory and identifier-collision gate therefore passed.
24. The operator captured the live `tools.catalog` response as JSON-only stdout at
    `/tmp/pilot-003-tools-catalog.json` (11491 bytes). `JSON.parse` succeeded.
    Structural validation found `agentId: "main"`, four profiles, 12 groups, and
    41 tools. Every group had the required identifier, label, source, and tools
    array; every tool had an identifier, source, and profile array. The artifact
    ended as a complete JSON object, with no indication of truncation. This proves
    structural completeness of the returned response; it does not claim tools
    omitted by gateway policy must appear.
25. Programmatic collision and ownership checks found zero duplicate group IDs,
    zero duplicate tool IDs, no group or ownership reference to
    `invaros-interception-probe`, and no tool named `invaros_probe_touch`. The sole
    plugin group was `plugin:file-transfer`, owning four tools. Each tool's
    `source: "plugin"` and `pluginId: "file-transfer"` matched its group; zero
    ownership inconsistencies were found. The installed `tools.catalog` response
    schema has no diagnostics field, so no catalog diagnostics were present to
    evaluate; plugin/registry diagnostics remain covered by the preceding plugin
    inventory. The live catalog and namespace/ownership-collision gate passed.
26. The first supplied `tools.effective` command was rendered with a line break
    inside the OpenClaw executable path. OpenClaw did not execute. The event is
    excluded as an operator-interface formatting artifact, not a gateway, runtime,
    or PILOT-003 failure.
27. The operator executed the corrected command and redirected JSON-only stdout to
    `/tmp/pilot-003-tools-effective.json`. The artifact exists as a regular file
    owned by UID/GID 1000, mode 0664, size 15076 bytes. `JSON.parse` succeeded.
    The complete response contains `agentId: "main"`, profile `coding`, two groups,
    and 23 effective tools: 21 core tools and two plugin tools. The response does
    not echo the request's literal `sessionKey`; `agentId: "main"` is the installed
    API's returned confirmation of main-agent scope.
28. Programmatic checks found no malformed group/tool records, duplicate group
    IDs, duplicate tool IDs, probe ID, or `invaros_probe_touch`. The two effective
    plugin tools are `memory_get` and `memory_search`, each consistently marked
    `source: "plugin"` and owned by `memory-core`. The response has neither a
    `diagnostics` nor an `error` field. The parser-backed `tools.effective` scope,
    integrity, ownership, and collision gate passed.
29. The first gateway-stop command was displayed with a physical line break
    between `stop` and `openclaw-gateway.service`. The operator did not execute it,
    and the gateway was unaffected. This is an excluded command-formatting
    artifact, not a deployment attempt or PILOT-003 failure.
30. The operator executed the corrected single-line command:

    ```text
    sudo -u invaros env XDG_RUNTIME_DIR=/run/user/1001 systemctl --user stop openclaw-gateway.service
    ```

    It returned successfully with no output, authentication error, unexpected
    authority request, or service-stop failure. The stop request passed; stopped
    state and zero plugin-host processes remain to be verified before evidence
    setup.
31. The operator verified the user service after the stop request:

    ```text
    MainPID=0
    ActiveState=inactive
    SubState=dead
    ```

    These values exactly match the required stopped state. The gateway-stop
    verification gate passed. No evidence directory or file has yet been created.
32. An earlier `pgrep -af openclaw` query matched the process-query command text
    itself. Those self-matches are excluded as a process-query design artifact and
    are not runtime evidence. The operator then used the non-self-matching query
    twice:

    ```text
    sudo -u invaros pgrep -a -u invaros -f '[o]penclaw'
    ```

    Both runs produced no process output; the second explicitly reported
    `exit_status=1`. This proves no OpenClaw-related process owned by `invaros`
    remained after shutdown. The zero-plugin-host gate passed.
33. The operator checked the complete fixed evidence path with both `test ! -e`
    and `test ! -L`. It produced no output and explicitly returned
    `exit_status=0`. Therefore no filesystem object, including a dangling symbolic
    link, existed at `/run/user/1001/invaros-openclaw-interception-probe`. The
    pre-creation evidence-path absence gate passed.
34. While the gateway remained verified inactive/dead with no OpenClaw process
    owned by `invaros`, the operator created the fixed evidence directory using
    `mkdir -m 700` as `invaros`. The command succeeded without output,
    authentication prompt, permission error, or filesystem error. Directory
    creation passed; its ownership, type, mode, link count, and identity remain to
    be verified before either evidence file is created.
35. Non-following metadata inspection of the created evidence directory returned:

    ```text
    /run/user/1001/invaros-openclaw-interception-probe type=directory uid=1001 gid=1001 mode=700 links=2 dev=48 ino=40
    ```

    The path, directory type, UID/GID 1001, mode 0700, link count, and original
    device/inode identity satisfy the runbook. Device 48 and inode 40 are the
    recorded directory identity for subsequent pathname revalidation. The
    evidence-directory identity gate passed.
36. With the gateway still stopped, the operator created
    `hook-log.jsonl` inside the verified private directory using `umask 077` and
    shell noclobber mode (`set -C`). The command succeeded without output,
    authentication prompt, or filesystem error and did not overwrite a
    pre-existing object. Hook evidence file creation passed; its metadata and
    identity will be verified together with the sentinel before plugin loading.
37. With the gateway still stopped, the operator created `sentinel.jsonl` using
    the same `umask 077` and noclobber protection. The command succeeded without
    output, authentication prompt, overwrite, or filesystem error. Both initial
    evidence artifacts—`hook-log.jsonl` and `sentinel.jsonl`—now exist inside the
    verified directory. Sentinel creation passed; joint metadata and identity
    verification is the next gate.
38. Joint non-following metadata inspection produced:

    ```text
    . type=directory uid=1001 gid=1001 mode=700 links=2 size=80 dev=48 ino=40
    hook-log.jsonl type=regular empty file uid=1001 gid=1001 mode=600 links=1 size=0 dev=48 ino=41
    sentinel.jsonl type=regular empty file uid=1001 gid=1001 mode=600 links=1 size=0 dev=48 ino=42
    ```

    Directory identity remains device 48/inode 40. The hook log is device
    48/inode 41 and the sentinel is device 48/inode 42. Both files are empty,
    regular, UID/GID 1001, mode 0600, link count one, and all three identities are
    distinct. The joint evidence metadata, no-hard-link-alias, and distinct-inode
    gates passed. Canonical pathname verification remains before installation.
39. Canonical resolution returned exactly:

    ```text
    /run/user/1001/invaros-openclaw-interception-probe
    /run/user/1001/invaros-openclaw-interception-probe/hook-log.jsonl
    /run/user/1001/invaros-openclaw-interception-probe/sentinel.jsonl
    ```

    The directory and both evidence files resolve beneath the exact reviewed
    private path, with no alternate component or traversal. The canonical-path
    gate passed.
40. The next runbook instruction is installation of the reviewed artifact in
    "the approved plugin location." The committed runbook does not identify that
    location or provide an exact installation command; the README likewise lists
    the plugin location and registration command as evidence to record rather than
    defining them. Selecting a destination or CLI installation mechanism here
    would invent a deployment procedure, contrary to the PILOT-003 authorization.
    Execution therefore stops before plugin installation, configuration change,
    import, or registration.
41. The operator accepted this blocker and authorized only the minimum read-only
    local discovery needed to identify the canonical installed OpenClaw plugin
    mechanism and destination. Installation, copy, link, registration, enablement,
    import, gateway restart, and evidence-file mutation remain prohibited during
    this discovery. Any resulting runbook amendment requires separate operator
    approval before installation.
42. Read-only installed CLI help for OpenClaw 2026.6.10 (`aa69b12`) listed plugin
    commands `build`, `disable`, `doctor`, `enable`, `init`, `inspect`, `install`,
    `list`, `marketplace`, `registry`, `search`, `uninstall`, `update`, and
    `validate`. Its `install` summary accepts a path, archive, npm spec, git
    repository, ClawHub package, or marketplace entry. This establishes
    `openclaw plugins install` as the locally supported CLI-managed installation
    mechanism. Exact syntax, destination behavior, verification, and rollback
    remain unresolved, so no installation command has been added to the runbook.
    The help command caused no state change.
43. Read-only `openclaw plugins install --help` confirmed usage
    `openclaw plugins install [options] <path-or-spec-or-plugin>`. Local
    `.ts`/`.js` files, archives, package specs, git repositories, ClawHub packages,
    and marketplace entries are accepted. `--link` selects linking rather than
    the default copy behavior; `--force` permits overwrite; `--pin` applies to npm
    resolution. The deprecated unsafe-install flag is a no-op. The help does not
    disclose the managed destination, configuration mutations, verification, or
    rollback. The installation mechanism and local copy/link choice are now
    established; destination and resulting state remain the blocker. No install
    operation occurred.
44. Installed compiled source
    `dist/plugins-install-command-BSS899HR.js:730-850` confirms local paths are
    passed to `installPluginFromPath({ path: resolved, extensionsDir, ... })`.
    Successful installation is then persisted by `persistPluginInstall()` with
    `sourcePath: resolved` and `installPath: result.targetDir`. Terminal installer
    failure returns before persistence. Thus the CLI—not the operator—selects the
    managed copy destination and records the actual result. Destination resolver,
    ownership/modes, verification, and uninstall behavior remain under read-only
    discovery; no installation occurred.
45. Installed compiled source `dist/install-paths-oR9PAGcS.js:1-140` defines the
    default path-install root as
    `path.join(resolveConfigDir(env, homedir), "extensions")` and resolves each
    plugin through `resolvePluginInstallDir()`. That function validates the plugin
    ID, rejects malformed/path-traversal segments, safely encodes the ID, and uses
    `resolveSafeInstallDir()` for the final target. With the already verified
    effective config directory `/home/invaros/.openclaw`, the CLI-managed root is
    `/home/invaros/.openclaw/extensions`; the expected recorded target for fixed ID
    `invaros-interception-probe` is
    `/home/invaros/.openclaw/extensions/invaros-interception-probe`. The operator
    does not construct or populate that target manually.
46. The proposed local copy-install source is the frozen reviewed directory
    `/home/yozi/invaros-ai-real-impact-pilot/probes/openclaw-interception`. The
    proposed command omits `--link`, `--force`, `--pin`, and all network-capable
    specs. It remains unapproved and unexecuted. Installed ownership/mode results,
    exact verification output, and CLI uninstall semantics remain to be confirmed
    before the documentation correction is complete.
47. The operator accepted the canonical installation mechanism, managed root, and
    destination-selection blocker as resolved, but withheld approval for the first
    state change pending read-only confirmation of uninstall behavior,
    post-install identity/installPath verification, installed ownership/layout,
    and partial-install recovery. Discovery remains read-only and installation is
    still prohibited.
48. Read-only `openclaw plugins uninstall --help` establishes ID-based usage
    `openclaw plugins uninstall [options] <id>`. `--dry-run` reports planned
    removal without mutation; `--force` skips confirmation; `--keep-files`
    removes registration while retaining files; deprecated `--keep-config` aliases
    `--keep-files`. Rollback is CLI-managed rather than manual recursive deletion.
    Exact dry-run and final rollback commands for fixed ID
    `invaros-interception-probe` are now documented, but remain unexecuted.
49. Read-only `openclaw plugins inspect --help` establishes usage
    `openclaw plugins inspect|info [options] [id]`. `--json` emits structured
    verification evidence, `--runtime` loads the selected runtime to enumerate
    registrations and diagnostics, and `--all` covers every installed plugin.
    This confirms the authoritative immediate identity/registration inspection
    surface already required by the runbook. No plugin was loaded because only
    help was requested. Installed ownership/mode and partial-install cleanup
    semantics remain the final read-only gaps.
50. Installed `dist/install-package-dir-Cgbcg-TS.js:130-330` implements local
    publication as a staged transaction beneath the canonical managed base. It
    records and rechecks the base realpath, rejects targets outside the base,
    copies recursively to `.openclaw-install-stage-*` with verbatim symlinks,
    performs post-copy/dependency/post-install validation before publication, and
    moves the prepared stage to the canonical target. Failure restores an update
    backup when present and removes the stage; successful updates remove the old
    backup. First installs have no old target to restore and are not reported
    successful unless publication completes. Hardlinks are rejected for this
    dependency-free manifest package. This resolves copy/publication recovery.
51. Repository metadata inspection found the reviewed source directories mode
    0775 and files mode 0664, owned by the development user/group. The installed
    copy runs as UID/GID 1001 and `fs.cp` preserves source permission bits; expected
    target content is therefore UID/GID 1001 with directories 0775 and files 0664.
    GID 1001 is the private `invaros` group with no listed supplementary members,
    and the managed tree is beneath the private user configuration directory.
    Post-install verification must reject any different ownership, file type,
    symlink, hardlink, unexpected entry, or group/other write beyond these reviewed
    source modes. Persistence failure after successful target publication remains
    the final partial-state question.
52. Installed `dist/plugins-install-persist-njvnEWy2.js:180-310` prepares plugin
    allow/deny, enablement, and slot state; records `source`, `sourcePath`,
    `installPath`, and version; and atomically commits configuration plus install
    records with snapshot path/hash/include guards. Only after commit does it clean
    a replaced managed target, refresh the registry, invalidate cache, and request
    restart. The inspected caller has no compensating removal of a newly published
    first-install target if the configuration/install-record commit rejects.
    Therefore a persistence failure may leave an unrecorded managed target. This
    is an explicit recovery condition, not proof the configuration commit itself
    is non-transactional. Recovery must verify the exact target and absence of a
    valid record/source before any deletion.
53. Installed `dist/uninstall-B71fJR_4.js:280-370` confirms uninstall planning is
    driven by configuration entries and install records. Copied managed targets
    are deleted only from a validated plan; linked source paths are protected; an
    absent entry/record returns `Plugin not found` and cannot delete an arbitrary
    directory. Consequently normal rollback uses CLI dry-run plus ID-based
    uninstall, while an unrecorded orphan requires separately gated exact-path
    recovery after proving its identity and lack of any valid record/source.
54. Installed `plugins-inspect-command-C4UdUQ3Q.js` confirms JSON inspection loads
    install records and includes them as `install`, including `source`,
    `sourcePath`, `installPath`, and version, alongside plugin identity and runtime
    registration fields. Thus the immediate post-install JSON inspection is the
    authoritative recorded-installPath and plugin-identity verification surface.
55. One operational gap remains before an executable approval package: runbook
    step 2 requires the exact initial configuration `{mode: deny, fault: none}`
    before runtime inspection/start, but no exact installed CLI command for that
    configuration mutation has yet been established. Guessing config syntax would
    violate the same reviewed-procedure constraint. Read-only config-subcommand
    help is therefore required before final approval.
56. Read-only `openclaw config set --help` establishes supported usage
    `openclaw config set <path> <value>` with dot/bracket paths, JSON/JSON5/raw
    values, `--strict-json`, and non-writing `--dry-run`. Batch, merge, replace,
    and secret-provider builders also exist but are unnecessary here. The probe
    runbook can validate each fixed JSON object with `--strict-json --dry-run`,
    then repeat the identical command without `--dry-run`; direct editing of the
    secret-bearing configuration file is unnecessary. This closes the final
    implementation-discovery gap. No configuration was changed.
57. The operator subsequently installed a staged copy from
    `/home/invaros/plugin-staging/openclaw-interception`. OpenClaw copied it to
    `/home/invaros/.openclaw/extensions/invaros-interception-probe`, discovered the
    manifest, selected the manifest ID despite the differing npm package name, and
    then rejected the enabled empty config because required `mode` was absent.
    `plugins inspect ... --json` reproduced the same pre-load validation failure.
    This is classified as a probe packaging/lifecycle defect, not an installer,
    gateway, or operator failure. The live copied installation was not modified by
    the engineering correction.
58. Installed source confirms the exact ordering and root cause:

    - `loader-CXafBhxY.js:1367-1420` validates `entry?.config ?? {}` against the
      manifest before importing/registering the plugin;
    - the same function calls `validateJsonSchemaValue(..., applyDefaults: true)`;
    - loader call sites reject invalid config before module load and pass
      `validatedConfig.value` as `api.pluginConfig` only after success;
    - `manifest-registry-CGMXWseL.d.ts` exposes `configSchema` but no separate
      manifest or package `defaultConfig` field.

    The original manifest required `mode` and `fault` but declared no JSON Schema
    defaults. Therefore an install-created enabled entry with absent config failed
    before `index.ts` and its `requireConfig()` could run.
59. The minimal repository-only correction adds property defaults `mode: "deny"`
    and `fault: "none"` to `openclaw.plugin.json`, while retaining `required`,
    enums, and `additionalProperties: false`. No OpenClaw or live installation file
    changed. Installed default materialization produces the exact object accepted
    by the existing strict runtime parser, so first load is deterministic and
    fail-closed. Empty/missing initial config is now a valid default case; extra or
    invalid config remains a load rejection. The runbook was reordered to install,
    inspect the materialized default, and only use config writes for later explicit
    scenarios.
60. The operator conceptually accepted the repository-only manifest correction for
    controlled validation. No live mutation is authorized yet. The next phase is
    read-only classification of the existing managed target and persisted
    config/install-record state, followed by evidence-selected normal uninstall or
    separately gated orphan recovery. Only after recovery may a new hash baseline
    and clean staging copy be prepared.
61. Direct read-only inspection of the SQLite-backed install record store and
    sanitized probe-specific config state found no install record, config entry,
    allowlist membership, denylist membership, or active record/config reference.
    Combined with the verified published target, this classified the failed target
    as an unrecorded orphan.
62. The fixed orphan verifier then revalidated canonical containment, directory
    identity, same-filesystem descendants, no symlinks, single-link regular files,
    UID/GID 1001, exact eight-entry payload layout, seven hashes matching the
    failed staging payload, and continued absence of all records/references. The
    read-only orphan-removal gate passed.
63. The first removal-helper command used incorrect Node stdin argument ordering;
    Node treated `--remove` as a module name and exited before reading or executing
    the helper. This is an invocation artifact, not a validation or recovery
    failure. The corrected `node --input-type=module - --remove` invocation reran
    all predicates, removed only the fixed orphan, and returned `REMOVED` with the
    target absent, extensions parent preserved, and every record/config/reference
    predicate still absent. The environment returned to clean pre-install state.
64. Initial patched staging attempts failed before mutation first because `invaros`
    could not traverse `/home/yozi`, then because the canonical staging parent is
    intentionally root:root mode 0755. The helper was corrected to run under the
    approved operator identity, require that exact parent invariant, copy only the
    seven artifact files into a sibling temporary directory, assign only the fixed
    child to UID/GID 1001, and atomically replace the child. No source permission,
    group membership, staging-parent ownership, or managed extension changed.
65. The corrected staging run passed. Canonical target
    `/home/invaros/plugin-staging/openclaw-interception` contains exactly the two
    reviewed directories and seven files, owned by `invaros:invaros`, directories
    mode 0775, files mode 0664, regular-file link count one. All seven SHA-256
    values were emitted and every staged file matched the patched repository
    source (`source_staging_match=PASS`).

## Operator command interface constraint

For the remainder of PILOT-003:

1. Every operator command is emitted in a fenced `bash` block.
2. Every command is one logical shell line unless reviewed multiline syntax is
   explicitly necessary.
3. No executable path, filesystem path, quoted string, JSON value, shell
   expression, or environment assignment may contain an inserted line break.
4. Commands must be directly copy/paste safe from the operator UI.
5. Long commands must be rewritten rather than wrapped.
6. Each command is accompanied by purpose, expected output, and stop conditions.

Violation makes the command invalid before execution. A formatting artifact is not
classified as a deployment attempt, runtime discrepancy, or pilot failure.

## Commands executed

Repository baseline and hashes:

```text
git status --short
git rev-parse HEAD
git log -1 --oneline
sed -n '1,240p' probes/openclaw-interception/DEPLOYMENT_RUNBOOK.md
sha256sum probes/openclaw-interception/{index.ts,dist/index.js,openclaw.plugin.json,package.json,README.md,CHANGELOG.md,DEPLOYMENT_RUNBOOK.md}
```

Read-only pre-deployment checks:

```text
sudo -n -u invaros env XDG_RUNTIME_DIR=/run/user/1001 /home/invaros/.npm-global/bin/openclaw --version
sudo -n -u invaros env XDG_RUNTIME_DIR=/run/user/1001 systemctl --user show openclaw-gateway.service -p MainPID -p ExecStart -p ActiveState -p SubState
stat -c '%n type=%F uid=%u gid=%g mode=%a dev=%d ino=%i' /run/user/1001
pgrep -af '/home/invaros/.npm-global/lib/node_modules/openclaw|openclaw.*gateway'
sudo -n -u invaros env XDG_RUNTIME_DIR=/run/user/1001 /home/invaros/.npm-global/bin/openclaw plugins list --json
sudo -n -u invaros env XDG_RUNTIME_DIR=/run/user/1001 /home/invaros/.npm-global/bin/openclaw gateway call tools.catalog --params '{"includePlugins":true}' --json
sudo -n -u invaros env XDG_RUNTIME_DIR=/run/user/1001 /home/invaros/.npm-global/bin/openclaw gateway call tools.effective --params '{"sessionKey":"main"}' --json
```

Post-failure health and baseline checks:

```text
curl -fsS http://127.0.0.1:18789/healthz
curl -fsS http://127.0.0.1:18789/readyz
pgrep -af '^/usr/bin/node /home/invaros/.npm-global/lib/node_modules/openclaw/dist/index.js gateway --port 18789$'
git status --short
```

No credential, token, private configuration value, or private endpoint was printed
or stored.

## Evidence collected

### Frozen baseline

| Artifact | SHA-256 |
|---|---|
| `index.ts` | `8e72cb792c00d6c8e5f4d3c73efa5697550b912c6e9a75fca1f80a657aa68b66` |
| `dist/index.js` | `68d28421bfea37027dc32dc3b51aea26285e45af371383ffa7032a6fa86a255d` |
| `openclaw.plugin.json` | `17ef2179d5f26ee14883da550f205151a33c15d973a2b907a64469251e4457a2` |
| `package.json` | `0f711fdeb0d7a8a1d0b9bd86dceb3ee77ccbe211e00555b3f84c8929da9fc07a` |
| `README.md` | `435fa6f0914c624a4762dc05fc3346dbb8861899dae000b219d3c776740e0dca` |
| `CHANGELOG.md` | `e783ec7a091907acd2cd381a537b723a71256afad535246a9e8beaba2c653eac` |
| `DEPLOYMENT_RUNBOOK.md` | `421151d1f36c1d04c452729fa4da4083f394bf56fd9600463d09f5448a1e906a` |

### Runtime prerequisites and health

```text
/run/user/1001 type=directory uid=1001 gid=1001 mode=700 dev=48 ino=1
PID 1249 /usr/bin/node /home/invaros/.npm-global/lib/node_modules/openclaw/dist/index.js gateway --port 18789
/healthz => {"ok":true,"status":"live"}
/readyz  => {"ready":true,"failing":[],..."degraded":false...}
```

### Authorization failure

```text
sudo: a password is required
```

The same error was reproduced on the single authorized resume attempt after the
operator ran `sudo -v`.

The post-failure `git status --short` produced no output before this report was
created. No live OpenClaw state was changed.

## Observed versus expected behavior

| Step | Expected | Observed | Result |
|---|---|---|---|
| Frozen baseline | Clean committed probe | Clean at `49164245...` | PASS |
| Private runtime parent | UID/GID 1001, mode 0700 | Matched | PASS |
| Single existing gateway | One PID | PID 1249 only | PASS |
| Act as approved `invaros` operator | Scoped commands execute as UID 1001 | Non-interactive sudo required a password | **BLOCKED** |
| Resume after operator `sudo -v` | Cached credential permits exact scoped retry | Cache was not visible; same password error | **BLOCKED** |
| Operator version check | Installed OpenClaw 2026.6.10, commit `aa69b12` | Exact match | PASS |
| Gateway service verification | Active/running service, nonzero PID, expected executable | PID 1249; active/running; expected `ExecStart` | PASS |
| Malformed line-wrapped backup command | Not applicable as a deployment operation | Shell reported three path-fragment `not found` errors; read-only verification showed backup absent | INVALID COMMAND ARTIFACT; NOT A PILOT FAILURE |
| Live configuration verification | Existing config owned by UID/GID 1001, private mode | mode 600, size 5664 | PASS |
| Pre-deployment configuration backup | Private preserved backup owned by `invaros` | UID/GID 1001, mode 600, size 5664 | PASS |
| Malformed line-wrapped plugin-inventory command | Not applicable as a deployment operation | Directory execution permission error followed by missing split command; OpenClaw did not run | INVALID COMMAND ARTIFACT; NOT A PILOT FAILURE |
| Corrected plugin inventory command | OpenClaw emits complete inventory | Command succeeded and emitted a complete-looking JSON payload | EVIDENCE RECEIVED |
| Probe identifier collision | No existing exact/equivalent probe ID | No `invaros-interception-probe` or equivalent observed | PASS from supplied payload |
| Inventory JSON parser validation | JSON-only stdout artifact parses | `/tmp/pilot-003-plugin-inventory.json`, 151440 bytes, parsed successfully with `JSON.parse` | PASS |
| Registry diagnostics | No error/failure diagnostic | One informational `persisted-registry-missing`; top-level diagnostics empty | QUALIFIED, NOT AN ERROR |
| Enabled plugin dependencies | Classify dependency issues and stop on a relevant load failure | `canvas` is loaded without diagnostics; missing UI dependencies are pre-existing and outside the probe path; disabled `oc-path` also has missing dependencies | PASS WITH HOST-STATE NOTE |
| Live tool catalog | Valid, structurally complete catalog with no fixed probe ID/tool collision | JSON parsed; main agent, 4 profiles, 12 groups, 41 tools; no duplicate IDs or probe matches | PASS |
| Existing plugin tool ownership | Plugin-owned tools have consistent group/tool ownership | `file-transfer` is the sole plugin group; all four tools consistently owned | PASS |
| Effective main-session tools | Valid effective inventory with consistent ownership and no probe collision | JSON parsed; `agentId=main`, profile `coding`, 2 groups, 23 tools; no duplicates, diagnostics, errors, or probe matches | PASS |
| Gateway stop request | Approved user-service stop succeeds and stopped state is verified | Successful exit; `MainPID=0`, inactive/dead | PASS |
| Post-shutdown process inventory | No OpenClaw/plugin-host process owned by `invaros` | Bracketed-pattern query returned no output and status 1 | PASS |
| Fixed evidence-path absence | No object or dangling symlink at the fixed path | Both nonexistence tests returned status 0 | PASS |
| Fixed evidence-directory creation | Create and verify only the reviewed path while gateway is stopped | Directory, UID/GID 1001, mode 0700, dev 48, inode 40 | PASS |
| Hook evidence-file creation | Noclobber creation and verified private metadata | Regular empty file, UID/GID 1001, mode 0600, links 1, dev 48/ino 41 | PASS |
| Sentinel evidence-file creation | Noclobber creation and verified private metadata | Regular empty file, UID/GID 1001, mode 0600, links 1, dev 48/ino 42 | PASS |
| Evidence identity separation | Directory and files must have distinct identities | dev/inodes `48:40`, `48:41`, and `48:42` | PASS |
| Canonical evidence paths | Directory and both files resolve only to fixed reviewed locations | All three canonical paths matched exactly | PASS |
| Approved plugin installation procedure | Exact CLI-managed source, destination, verification, and rollback | Locally source-confirmed and documented; awaiting operator approval | PASS FOR APPROVAL |
| Gateway health after aborted attempt | Live and ready | Live and ready | PASS |
| First installation | Managed copy and valid default load | Copy published; pre-load config validation rejected missing `mode` | FAIL — PROBE PACKAGING DEFECT |

## Current acceptance criteria

| Criterion | Result | Evidence |
|---|---|---|
| Hook executes before underlying tool | PASS | One correlated `intercepted` record preceded the protected body; sentinel remained zero bytes |
| ALLOW executes correctly | PASS | HTTP 200; correlated hook and sentinel records `http-probe-allow-002`; sentinel 150 bytes |
| DENY prevents execution | PASS | HTTP 403 `tool_call_blocked`, correlation `http-probe-deny-001`, zero-byte sentinel |
| Rewrite behaves as documented | NOT RUN | Pending controlled behavioral validation |
| Timeout fails closed | NOT RUN | Pending controlled behavioral validation |
| Gateway remains healthy | PASS | Post-deployment `/healthz` live and `/readyz` ready/non-degraded |
| Restart behavior is deterministic | PASS for deployment qualification | One gateway process, systemd PID consistency, healthy startup, no restart loop |
| Lifecycle cleanup functions correctly | PARTIAL | Inspection process exited cleanly; controlled gateway-shutdown cleanup remains pending |
| Rollback completes successfully | PARTIAL | Failed-install orphan was safely removed; final post-pilot uninstall rollback remains pending |
| Evidence matches runbook | PARTIAL | Deployment and deterministic DENY evidence match; ALLOW/fault/evidence-package gates remain |

## Historical pre-correction continuation state

The pre-deployment inventory, shutdown, evidence-filesystem, and read-only
deployment-mechanism discovery gates passed. The first managed copy exposed a
probe manifest defect: required configuration lacked install-time defaults and was
rejected before module registration. The repository patch now supplies fail-closed
schema defaults without weakening validation. Before any retry, the patch requires
review, a new frozen hash baseline, approved restaging, and classification/recovery
of the existing failed-install target. No live file was changed by this fix.

## Current recommendation

**PILOT-003 COMPLETE — PRE-EXECUTION INTERCEPTION VIABILITY PROVED**

Proceed only with the controlled behavioral-validation scenario sequence. The
deterministic DENY and ALLOW cases passed; fault/fail-closed, rewrite, parallel,
retry, model-facing, evidence-packaging, and acceptance-review gates remain. Do not infer full-policy, `invarosd`, C++
core, cryptographic-receipt, egress-containment, or end-to-end pilot completion.
