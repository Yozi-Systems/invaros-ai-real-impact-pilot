# OpenClaw pre-execution interception feasibility

**Inspection date:** 2026-07-17 UTC; live qualification updated 2026-07-18 UTC

**Scope:** feasibility inspection, PILOT-003 packaging follow-up, deployment
qualification, and deterministic DENY/ALLOW behavioral proofs.
**Recommendation:** **B. Native hook is viable only with stated constraints.**

## Executive finding

The active host process is an OpenClaw Node gateway owned by the separate `invaros` account:

```text
PID 1249  /usr/bin/node
  /home/invaros/.npm-global/lib/node_modules/openclaw/dist/index.js
  gateway --port 18789
started 2026-07-01 11:14:13 UTC
```

This is runtime-observed host process metadata. Read access subsequently became available for the installed package and user service unit. The deployed package identifies itself as **OpenClaw 2026.6.10**, commit **`aa69b12d0086b631b139c1435c9621a5783e3a40`**, built **2026-06-24T01:31:31.922Z** (`dist/build-info.json`). The corresponding upstream commit exists and is the `2026.6.10` changelog commit dated 2026-06-24. It is not commit `4a675228` (`2026.7.2`).

The **installed compiled build itself** contains a genuine, awaited `before_tool_call` plugin hook. Its common agent-tool assembly collects native, shell, OpenClaw, plugin, subagent and tool-search definitions, policy-filters and schema-normalizes them, then wraps every remaining tool. The wrapper awaits the hook, returns a synthetic blocked result for intentional DENY, applies returned parameters on ALLOW, and only then calls the captured original `execute`. Hook errors and authored hook timeouts are fail-closed. This statement is specifically about the captured `execute`: optional tool-owned `prepareBeforeToolCallParams` code runs before the hook and is not enforced to be side-effect-free.

PILOT-003 has now experimentally verified the native DENY path. An authenticated
`POST /tools/invoke` for `invaros_probe_touch` with correlation key
`probe-deny-001` produced exactly one `before_tool_call` record, returned HTTP 403
`tool_call_blocked`, requested no approval, and left the protected tool-body
sentinel at zero bytes. A subsequent correctly configured ALLOW invocation emitted
the correlated hook record `http-probe-allow-002`, returned HTTP 200, and then
appended exactly one correlated `allow-case` execution record to the 150-byte
sentinel. Fault, rewrite, parallel, retry, and model-facing paths remain unverified,
so recommendation B and all stated constraints remain in force.

PILOT-003 first installation exposed a pre-load default-configuration defect. The
manifest correction retained strict required/enumerated properties while adding
`{ "mode": "deny", "fault": "none" }` defaults. The failed publication was
forensically classified as an unrecorded orphan and removed; the corrected artifact
was hash-verified, installed, registered, made visible through the exact
`tools.alsoAllow: [invaros_probe_touch]` selector, and qualified through the live
DENY proof.

## Evidence classification

| Finding | Status | Evidence |
|---|---|---|
| Gateway is active on port 18789 | **Experimentally verified** | Host `pgrep`/`ps` output shown above |
| Installed source root is `/home/invaros/.npm-global/lib/node_modules/openclaw` | **Experimentally verified** | Process command line |
| Installed version/commit/build | **Installed-build evidence** | `package.json`: `2026.6.10`; `dist/build-info.json`: commit `aa69b12d...`, built `2026-06-24T01:31:31.922Z` |
| Active service version and command | **Runtime/config observed** | `openclaw-gateway.service`: v2026.6.10, same Node entry point and port 18789 |
| Effective config and tool visibility | **Runtime/config observed** | `profile: coding` plus exact `alsoAllow: [invaros_probe_touch]`; live `tools.effective` exposed only that additional plugin tool alongside the existing memory tools |
| `before_tool_call` exists and is awaited | **Installed-build evidence** | `dist/hook-runner-global-Bm5WihiA.js:823-851`; `dist/agent-tools.before-tool-call-CDuA0_mC.js:1258-1495` |
| DENY prevents captured `execute` | **Runtime-observed deterministic proof** | HTTP 403 `tool_call_blocked`; correlated `http-probe-deny-001` hook record; protected sentinel remained zero bytes |
| ALLOW reaches execution | **Runtime-observed deterministic proof** | HTTP 200; hook `http-probe-allow-002` precedes one correlated sentinel execution record; sentinel size 150 bytes |
| Rewrite reaches execution | **Installed-build evidence; not live verified** | wrapper reconciles `outcome.params`, then calls `execute`; probe rewrite scenario remains pending |
| Hook error fails closed | **Installed-build evidence; not live verified** | hook runner configures `before_tool_call: "fail-closed"`; orchestration catches and returns `blocked: true` |

Installed paths and line numbers refer to immutable files read under `/home/invaros/.npm-global/lib/node_modules/openclaw`. Upstream comparison used both [installed-source commit aa69b12d](https://github.com/openclaw/openclaw/tree/aa69b12d0086b631b139c1435c9621a5783e3a40) and [current comparison commit 4a675228](https://github.com/openclaw/openclaw/tree/4a675228af5758d6205b7d8a058f2a1d42948721).

## Installed implementation and registration

- Executable runtime: `/usr/bin/node`.
- Installed entry point: `/home/invaros/.npm-global/lib/node_modules/openclaw/dist/index.js`.
- Command: `gateway --port 18789`.
- Owner/process supervisor: `invaros`, parent `/usr/lib/systemd/systemd --user`.
- Installed package version/commit/build: **2026.6.10 / `aa69b12d...` / 2026-06-24T01:31:31.922Z**.
- Package and build-info SHA-256: `865c6f95910979dc5cfcd9752a3a208d6b94c5fdd46b36a7e9f2b0b42cdf9426` and `f4402ab0044dcfa2f9f5ee3324af9d14f2ad115890b971afe542134c306a9a62`.
- Effective config path: `/home/invaros/.openclaw/openclaw.json` by service environment and installed defaults; the qualified tool policy is `profile: coding` with exact `alsoAllow: [invaros_probe_touch]`.
- Installed service unit: `/home/invaros/.config/systemd/user/openclaw-gateway.service`.
- Installed active plugin registration and visibility: **verified for the probe**.
  Stopped-gateway runtime inspection showed exactly one priority-100
  `before_tool_call` hook and one `invaros_probe_touch` tool with no diagnostics;
  live `tools.catalog` and `tools.effective` confirmed ownership and exact-ID
  visibility. No installed live surface exposes lifecycle registrations directly;
  shutdown cleanup remains a separate behavioral gate.

In the installed build, plugins register an in-process typed handler with `api.on("before_tool_call", handler, options)`. `dist/hook-runner-global-Bm5WihiA.js` initializes the global runner from live registries. `dist/agent-tools-XUrUI5bQ.js:2860-3077` collects core, shell, plugin, subagent and search tools, applies policies, normalizes schemas, and adds the common wrapper. The plugin hook is distinct from coarse internal `HOOK.md` automation hooks.

## Hook semantics in the installed build

The relevant contract is:

```ts
before_tool_call: (event, ctx) =>
  Promise<PluginHookBeforeToolCallResult | void> |
  PluginHookBeforeToolCallResult | void;
```

`event` contains normalized `toolName`, `params`, run/tool-call identifiers and optional host-derived metadata (`src/plugins/hook-types.ts:635-676`). The result can contain `block`, `blockReason`, `params`, or `requireApproval`.

| Question | Installed-build result | Important qualification |
|---|---|---|
| Runs before underlying side effects? | **Before the captured tool `execute`, yes.** | `prepareBeforeToolCallParams` runs first and is not mechanically prevented from causing effects. Both pilot tools must omit it or be audited. A tool already running in the background is also outside this call. This is not a kernel syscall boundary. |
| Await an external decision? | **Yes.** Handlers may return promises and the runner awaits them sequentially. | No general hook deadline is imposed here. A plugin must implement its own timeout and fail-closed mapping. |
| ALLOW? | **Yes**, by returning nothing, `{ block: false }`, or adjusted params. | There is no explicit `ALLOW` enum in the basic hook result. |
| DENY without crashing agent? | **Yes for an intentional veto.** `{ block: true, blockReason }` returns a synthetic blocked tool result. | Hook infrastructure failures take the error path rather than the clean veto path, but remain blocked. |
| Modify request? | **Yes.** Return `{ params: ... }`; reconciled params are passed to `execute`. | Multiple hooks merge sequentially; block is terminal and parameter ownership interacts with approvals. |
| Hook exception? | **Fail closed.** | `hook-runner-global.ts` configures `before_tool_call: "fail-closed"`; wrapper maps failure to a pre-execution error. |
| Timeout? | **Plugin responsibility.** | An authored `api.on(..., { timeoutMs })` budget rejects an overlong hook and the installed fail-closed policy blocks execution, but this is an error path rather than a clean synthetic DENY. A clean timeout denial must be returned by an earlier plugin-owned decision deadline. |
| Malformed external response? | **Plugin responsibility.** | Core validates neither an InvarOS response nor an ALLOW/DENY schema. A careless plugin could interpret malformed data as allow. |
| Cancellation? | **Constrained.** | Installed 2026.6.10 passes the signal to preparation/execute but lacks the newer explicit post-hook `signal.throwIfAborted()`. A cancellation-ignoring hook can finish and reach an execute implementation that ignores the already-aborted signal. Do not claim cancellation-safe enforcement until probed or upgraded. |

Concise source-confirmed ordering:

```ts
outcome = await runBeforeToolCallHook(...);
if (outcome.blocked) return blockedResult; // intentional veto
executeParams = reconcile(...outcome.params);
return await execute(toolCallId, executeParams, signal, onUpdate);
```

Unlike `4a675228`, installed `aa69b12d` has no explicit abort check between the awaited decision and reconciliation/execution. This is the principal pilot-relevant code difference. Current upstream also has substantially expanded pre-execution diagnostic/failure classification; those changes improve observability but do not change the installed clean veto or fail-closed hook-error ordering.

## Coverage and bypass assessment

| Surface | Installed-build evidence | Assessment for installed deployment |
|---|---|---|
| Core/native agent tools, including read/web/message | Installed final assembled list is wrapped in `createOpenClawCodingTools` | **Installed-source confirmed; probe pending** |
| Plugin tools | Added before the installed final common wrapper | **Installed-source confirmed; probe pending** |
| Shell `exec` | It is an assembled tool and is wrapper-covered | One allow gates the whole command; child syscalls/subprocess behavior is not individually hooked |
| Gateway HTTP `/tools/invoke` | Installed HTTP handler authenticates, resolves unwrapped gateway-scoped tools, explicitly awaits the common `runBeforeToolCallHook`, then calls `execute` only on ALLOW | Runtime endpoint exposure not tested; this is the deterministic probe surface |
| Plugin tools served via MCP | Installed `dist/mcp/plugin-tools-serve.js:15-55` explicitly wraps/rewraps before `tool.execute` | Covers this server only, not every arbitrary external MCP process |
| External MCP tools | Tool-specific construction must be confirmed for the installed release | **Potential bypass; unresolved** |
| Sub-agent spawn/control tool | Parent invocation is wrapped; child runs normally assemble wrapped tools | Plugin availability/context in every child runtime must be probed; spawn may itself start later activity after an allow |
| Background tasks | Initial scheduling tool is wrapped | Work continuing after an allowed return is not reauthorized automatically; direct scheduler/internal callbacks may not be model tool calls |
| Retries | Each normal `execute` invocation traverses its wrapper | Provider/harness replay and installed release behavior require a counter probe |
| Parallel calls | Each wrapped call awaits its own hook | Hooks can run concurrently across distinct tool calls; the policy client/log must be concurrency-safe |
| Codex/native harness | Installed SDK exports wrapper/relay paths, but active harness is unknown | Disable for pilot or specifically probe; do not infer parity from embedded-agent path |

## Risk and failure-mode table

| Risk/failure | Consequence | Present control | Required pilot control |
|---|---|---|---|
| Alternate path bypasses installed hook | Prohibited egress executes | Common agent and plugin-tools MCP paths are wrapped | Run DENY probe on every enabled tool family; disable all unproved paths |
| External-decision timeout | Agent hangs; cancellation may be delayed | None for arbitrary hook promise | Plugin-owned short timeout; map timeout to DENY |
| Hook throws | Tool does not execute, but agent receives tool error | Installed fail-closed source path | Verify runtime behavior and produce a stable denial message |
| Simulated malformed decision mistaken for parser proof | A future real parser could fail open | Probe has no external InvarOS parser | Treat the simulated branch only as hook-path evidence; later require an exhaustive real parser where only exact ALLOW permits execution |
| Parameter rewrite after policy check | Checked request differs from executed request | Wrapper reconciles hook params | Decide on and log final normalized params; reject ambiguous merging |
| Side effects in parameter preparation | Effect occurs before hook | Architectural convention only | Probe target must have side-effect-free preparation; audit pilot tool adapters |
| Background process survives later denial | Egress occurs outside new call | No retroactive enforcement | Do not permit tools that can daemonize; add OS network containment for defense in depth |
| Shell command multiplexes actions | One allow authorizes several side effects | Single tool-call boundary | Do not expose general shell for pilot; expose exactly two narrow tools |
| External MCP path is unwrapped | MCP call bypasses native gate | Some MCP paths explicitly wrap | Inventory and test the exact installed MCP adapter or do not expose it |
| Parallel calls race policy state | inconsistent decisions/logs | Per-call awaited wrapper | Stateless/correlation-ID decisions; concurrency test before deployment |
| Retry duplicates allowed side effect | repeated operation | Per-invocation hook likely reruns | Correlate attempts; make pilot action idempotent; verify retry behavior |
| Plugin not loaded in cron/subagent runtime | bypass in alternate runtime | Installed global live runner exists | Disable those surfaces for pilot until specifically tested |

## Suitability for the narrow pilot

The installed build is hook-capable and the native boundary is viable **with constraints** for a tightly constrained demonstration with exactly:

1. one narrow local-read tool restricted to a fixed sample file; and
2. one narrow network-egress test tool whose entire network action occurs inside its wrapped `execute`.

The pilot must disable general shell, browser/web, arbitrary MCP, subagent, cron/background, alternate harnesses, and plugin tools except the two targets; confirm that the two target tools have no side-effecting pre-hook preparation; implement a strict plugin-owned decision timeout that maps every non-exact response to DENY; and pass the prepared probe before deployment. Because 2026.6.10 lacks the post-hook abort check, cancellation is explicitly excluded from the authorization invariant and must not be relied upon as a security control. This remains a tool-dispatch boundary, not a host network sandbox.

## FastMCP fallback criterion

Do **not** adopt FastMCP merely because native inspection needs access. Use it only if the reviewed probe establishes one of these concrete native limitations on the exact deployment:

- the installed release has no awaited pre-execution hook;
- the egress tool or required MCP tool does not traverse it;
- DENY reaches underlying execution or destabilizes the agent;
- a bounded external-decision wait cannot be made fail-closed; or
- the hook cannot see/reliably normalize the exact request that the underlying pilot tool executes.

FastMCP only solves interception for calls deliberately routed through that MCP proxy. It would not cover native shell/web/background paths, so those must still be disabled or independently contained.

## Review gate

Before changing the live runtime, review and approve the isolated probe and `probes/openclaw-interception/DEPLOYMENT_RUNBOOK.md`. Required exit evidence is: runtime plugin registration; effective tool inventory; DENY/ALLOW artifact logs; side-effect sentinel assertions; timeout/exception/simulated-malformed/cancellation cases; the separate parameter-rewrite case; and coverage tests for every enabled tool surface. Until those pass, recommendation remains **B**, not A.
