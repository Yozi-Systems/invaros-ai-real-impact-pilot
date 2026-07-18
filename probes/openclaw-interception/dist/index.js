// index.ts
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  realpathSync,
  writeSync
} from "node:fs";
import path from "node:path";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

// ipc-client.ts
import net from "node:net";

// protocol.ts
import { createHash, randomUUID } from "node:crypto";
var AUTH_PROTOCOL = "invaros.openclaw.authorization.v1";
var REQUEST_TYPE = "authorization_request";
var RESPONSE_TYPE = "authorization_response";
var MAX_FRAME_BYTES = 65536;
function buildAuthorizationRequest(event, now = Date.now(), requestId = randomUUID()) {
  if (!event.toolCallId) throw new Error("toolCallId is required for authorization");
  if (!event.params || typeof event.params !== "object" || Array.isArray(event.params)) {
    throw new Error("tool params must be an object");
  }
  const paramsJson = JSON.stringify(event.params);
  const paramsBytes = Buffer.from(paramsJson, "utf8");
  const paramsSha256 = createHash("sha256").update(paramsBytes).digest("hex");
  const prefix = JSON.stringify({
    protocol: AUTH_PROTOCOL,
    messageType: REQUEST_TYPE,
    requestId,
    toolCallId: event.toolCallId,
    toolName: event.toolName
  }).slice(0, -1);
  const suffix = `,"params":${paramsJson},"sentAtUnixMs":${now},"runId":${event.runId === void 0 ? "null" : JSON.stringify(event.runId)}}`;
  const body = Buffer.from(prefix + suffix, "utf8");
  if (body.length === 0 || body.length > MAX_FRAME_BYTES) throw new Error("authorization request exceeds frame limit");
  return { body, requestId, toolCallId: event.toolCallId, paramsByteLength: paramsBytes.length, paramsSha256 };
}
function parseAuthorizationResponse(bytes, requestId, toolCallId) {
  if (bytes.length === 0 || bytes.length > MAX_FRAME_BYTES) throw new Error("invalid authorization response size");
  let value;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error("authorization response is malformed");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("authorization response must be an object");
  const response = value;
  const expected = ["daemonPid", "decision", "message", "messageType", "policyId", "protocol", "reasonCode", "requestId", "toolCallId"];
  const keys = Object.keys(response).sort();
  if (keys.length !== expected.length || keys.some((key, i) => key !== expected[i])) throw new Error("authorization response fields are invalid");
  if (response.protocol !== AUTH_PROTOCOL || response.messageType !== RESPONSE_TYPE || response.requestId !== requestId || response.toolCallId !== toolCallId) throw new Error("authorization response correlation is invalid");
  if (response.decision !== "ALLOW" && response.decision !== "DENY") throw new Error("authorization decision is invalid");
  if (typeof response.reasonCode !== "string" || !response.reasonCode || typeof response.message !== "string" || !response.message || typeof response.policyId !== "string" || !response.policyId || !Number.isInteger(response.daemonPid) || response.daemonPid < 1) throw new Error("authorization response values are invalid");
  return response;
}

// ipc-client.ts
var DEFAULT_SOCKET_PATH = "/run/invarosd/openclaw-authorize.sock";
var DEFAULT_TIMEOUT_MS = 1e3;
async function authorizeToolCall(event, options = {}) {
  const request = buildAuthorizationRequest(event, options.now ?? Date.now(), options.requestId);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const frame = Buffer.allocUnsafe(4 + request.body.length);
  frame.writeUInt32BE(request.body.length, 0);
  request.body.copy(frame, 4);
  const response = await new Promise((resolve, reject) => {
    const socket = net.createConnection({ path: options.socketPath ?? DEFAULT_SOCKET_PATH });
    let header = Buffer.alloc(0), body = Buffer.alloc(0), expected, settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      error ? reject(error) : resolve(value);
    };
    const timer = setTimeout(() => finish(new Error("authorization IPC deadline exceeded")), timeoutMs);
    socket.once("connect", () => socket.write(frame));
    socket.on("data", (chunk) => {
      if (expected === void 0) {
        header = Buffer.concat([header, chunk]);
        if (header.length < 4) return;
        expected = header.readUInt32BE(0);
        if (expected === 0 || expected > MAX_FRAME_BYTES) return finish(new Error("authorization response frame is invalid"));
        body = header.subarray(4);
        header = Buffer.alloc(0);
      } else body = Buffer.concat([body, chunk]);
      if (body.length > expected) return finish(new Error("authorization response has trailing bytes"));
      if (body.length === expected) finish(void 0, body);
    });
    socket.once("error", (error) => finish(error));
    socket.once("end", () => finish(new Error("authorization response ended early")));
    socket.once("close", () => {
      if (!settled) finish(new Error("authorization connection closed"));
    });
  });
  return { response: parseAuthorizationResponse(response, request.requestId, request.toolCallId), ...request };
}

// index.ts
var PROBE_DIRECTORY = "/run/user/1001/invaros-openclaw-interception-probe";
var HOOK_LOG_NAME = "hook-log.jsonl";
var SENTINEL_NAME = "sentinel.jsonl";
var PROBE_TOOL_NAME = "invaros_probe_touch";
var MAX_RECORD_BYTES = 4096;
var EXPECTED_UID = 1001;
function requireConfig(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("probe config missing");
  }
  const config = value;
  const keys = Object.keys(config).sort();
  if (keys.length !== 2 || keys[0] !== "socketPath" || keys[1] !== "timeoutMs" || config.socketPath !== "/run/invarosd/openclaw-authorize.sock" || config.timeoutMs !== 1e3) {
    throw new Error("probe config malformed");
  }
  return config;
}
function requireSecureDirectory() {
  if (process.getuid?.() !== EXPECTED_UID) {
    throw new Error(`probe must run as effective UID ${EXPECTED_UID}`);
  }
  const directoryStat = lstatSync(PROBE_DIRECTORY);
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) {
    throw new Error("probe directory must be a real directory");
  }
  if (realpathSync(PROBE_DIRECTORY) !== PROBE_DIRECTORY) {
    throw new Error("probe directory must use its canonical path");
  }
  if (directoryStat.uid !== EXPECTED_UID || (directoryStat.mode & 511) !== 448) {
    throw new Error("probe directory must be owned by the gateway user with mode 0700");
  }
  return {
    dev: BigInt(directoryStat.dev),
    ino: BigInt(directoryStat.ino),
    uid: directoryStat.uid,
    mode: directoryStat.mode & 511
  };
}
function requireSecureFile(fd, expectedPath) {
  if (path.dirname(expectedPath) !== PROBE_DIRECTORY) {
    throw new Error("probe file escaped fixed directory");
  }
  const fileStat = fstatSync(fd, { bigint: true });
  if (!fileStat.isFile() || fileStat.nlink !== 1n || fileStat.uid !== BigInt(EXPECTED_UID) || (fileStat.mode & 0o777n) !== 0o600n) {
    throw new Error("probe files must be regular, singly linked, gateway-owned mode-0600 files");
  }
  const pathStat = lstatSync(expectedPath, { bigint: true });
  if (pathStat.isSymbolicLink() || pathStat.dev !== fileStat.dev || pathStat.ino !== fileStat.ino) {
    throw new Error("probe pathname does not identify the opened file");
  }
  return {
    fd,
    expectedPath,
    dev: fileStat.dev,
    ino: fileStat.ino,
    uid: Number(fileStat.uid),
    mode: Number(fileStat.mode & 0o777n)
  };
}
function requireUnchangedDirectory(original) {
  const current = requireSecureDirectory();
  if (current.dev !== original.dev || current.ino !== original.ino || current.uid !== original.uid || current.mode !== original.mode) {
    throw new Error("probe directory changed while evidence files were opened");
  }
}
function requireUnchangedFile(file) {
  const current = fstatSync(file.fd, { bigint: true });
  if (!current.isFile() || current.dev !== file.dev || current.ino !== file.ino || current.nlink !== 1n || current.uid !== BigInt(file.uid) || Number(current.mode & 0o777n) !== file.mode) {
    throw new Error(`probe evidence invariant changed: ${file.expectedPath}`);
  }
}
function openVerifiedFiles() {
  const directoryInvariant = requireSecureDirectory();
  const flags = constants.O_WRONLY | constants.O_APPEND | constants.O_NOFOLLOW;
  const hookLogPath = path.join(PROBE_DIRECTORY, HOOK_LOG_NAME);
  const sentinelPath = path.join(PROBE_DIRECTORY, SENTINEL_NAME);
  let hookLogFd;
  let sentinelFd;
  try {
    hookLogFd = openSync(hookLogPath, flags);
    sentinelFd = openSync(sentinelPath, flags);
    const hookLog = requireSecureFile(hookLogFd, hookLogPath);
    const sentinel = requireSecureFile(sentinelFd, sentinelPath);
    requireUnchangedDirectory(directoryInvariant);
    if (hookLog.dev === sentinel.dev && hookLog.ino === sentinel.ino) {
      throw new Error("hook log and sentinel must be distinct files");
    }
    return { directory: directoryInvariant, hookLog, sentinel };
  } catch (error) {
    if (sentinelFd !== void 0) {
      try {
        closeSync(sentinelFd);
      } catch {
      }
    }
    if (hookLogFd !== void 0) {
      try {
        closeSync(hookLogFd);
      } catch {
      }
    }
    throw error;
  }
}
function appendJsonLine(directory, file, value) {
  requireUnchangedDirectory(directory);
  requireUnchangedFile(file);
  const record = Buffer.from(`${JSON.stringify(value)}
`, "utf8");
  if (record.length > MAX_RECORD_BYTES) {
    throw new Error(`probe evidence record exceeds ${MAX_RECORD_BYTES} bytes`);
  }
  const written = writeSync(file.fd, record, 0, record.length);
  if (written !== record.length) {
    throw new Error("partial probe evidence write");
  }
}
var index_default = definePluginEntry({
  id: "invaros-interception-probe",
  name: "InvarOS Interception Probe",
  description: "Review-only DENY/ALLOW pre-execution probe",
  register(api) {
    const config = requireConfig(api.pluginConfig);
    const files = openVerifiedFiles();
    let closed = false;
    const closeFiles = () => {
      if (closed) return;
      closed = true;
      let firstError;
      try {
        closeSync(files.sentinel.fd);
      } catch (error) {
        firstError = error;
      }
      try {
        closeSync(files.hookLog.fd);
      } catch (error) {
        firstError ??= error;
      }
      if (firstError) throw firstError;
    };
    try {
      api.lifecycle.registerRuntimeLifecycle({
        id: "invaros-interception-probe-files",
        description: "Close verified interception-probe evidence files",
        cleanup: closeFiles
      });
      api.on(
        "before_tool_call",
        async (event) => {
          if (event.toolName !== PROBE_TOOL_NAME) return;
          appendJsonLine(files.directory, files.hookLog, {
            phase: "intercepted",
            toolName: event.toolName,
            toolCallId: event.toolCallId ?? null,
            runId: event.runId ?? null,
            wallTime: (/* @__PURE__ */ new Date()).toISOString(),
            monotonicNs: process.hrtime.bigint().toString()
          });
          try {
            const result = await authorizeToolCall(event, config);
            appendJsonLine(files.directory, files.hookLog, {
              phase: "authorization_decision",
              requestId: result.requestId,
              toolCallId: result.toolCallId,
              toolName: event.toolName,
              paramsByteLength: result.paramsByteLength,
              paramsSha256: result.paramsSha256,
              daemonPid: result.response.daemonPid,
              policyId: result.response.policyId,
              decision: result.response.decision,
              reasonCode: result.response.reasonCode,
              wallTime: (/* @__PURE__ */ new Date()).toISOString(),
              monotonicNs: process.hrtime.bigint().toString()
            });
            if (result.response.decision === "ALLOW") return { block: false };
            return { block: true, blockReason: `InvarOS policy denied this tool call (${result.response.reasonCode})` };
          } catch (error) {
            appendJsonLine(files.directory, files.hookLog, {
              phase: "authorization_failure",
              toolCallId: event.toolCallId ?? null,
              toolName: event.toolName,
              errorClass: error instanceof Error ? error.name : "Error",
              wallTime: (/* @__PURE__ */ new Date()).toISOString(),
              monotonicNs: process.hrtime.bigint().toString()
            });
            return { block: true, blockReason: "InvarOS authorization unavailable" };
          }
        },
        { priority: 100, timeoutMs: 1250 }
      );
      api.registerTool({
        name: PROBE_TOOL_NAME,
        description: "Append one harmless marker to the interception probe sentinel",
        parameters: {
          type: "object",
          additionalProperties: false,
          required: ["marker"],
          properties: {
            marker: { type: "string", enum: ["deny-case", "allow-case", "rewritten-case"] }
          }
        },
        async execute(toolCallId, params) {
          const marker = params.marker;
          const markerIsValid = marker === "deny-case" || marker === "allow-case" || marker === "rewritten-case";
          if (!markerIsValid) {
            throw new Error("invalid probe marker for configured scenario");
          }
          appendJsonLine(files.directory, files.sentinel, {
            phase: "executed",
            marker,
            toolCallId,
            wallTime: (/* @__PURE__ */ new Date()).toISOString(),
            monotonicNs: process.hrtime.bigint().toString()
          });
          return {
            content: [{ type: "text", text: `probe executed: ${marker}` }]
          };
        }
      });
    } catch (error) {
      try {
        closeFiles();
      } catch {
      }
      throw error;
    }
  }
});
export {
  index_default as default
};
