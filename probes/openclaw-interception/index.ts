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

const PROBE_DIRECTORY = "/run/user/1001/invaros-openclaw-interception-probe";
const HOOK_LOG_NAME = "hook-log.jsonl";
const SENTINEL_NAME = "sentinel.jsonl";
const PROBE_TOOL_NAME = "invaros_probe_touch";
const MAX_RECORD_BYTES = 4_096;
const EXPECTED_UID = 1_001;

type ProbeConfig = {
  mode: "allow" | "deny";
  fault: "none" | "throw" | "timeout" | "malformed" | "rewrite";
};

type FileInvariant = {
  dev: bigint;
  ino: bigint;
  uid: number;
  mode: number;
};

type VerifiedFile = FileInvariant & {
  fd: number;
  expectedPath: string;
};

type VerifiedFiles = {
  directory: FileInvariant;
  hookLog: VerifiedFile;
  sentinel: VerifiedFile;
};

function requireConfig(value: unknown): ProbeConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("probe config missing");
  }
  const config = value as Record<string, unknown>;
  const keys = Object.keys(config).sort();
  if (
    keys.length !== 2 ||
    keys[0] !== "fault" ||
    keys[1] !== "mode" ||
    (config.mode !== "allow" && config.mode !== "deny") ||
    (config.fault !== "none" &&
      config.fault !== "throw" &&
      config.fault !== "timeout" &&
      config.fault !== "malformed" &&
      config.fault !== "rewrite")
  ) {
    throw new Error("probe config malformed");
  }
  return config as ProbeConfig;
}

function requireSecureDirectory(): FileInvariant {
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
  if (directoryStat.uid !== EXPECTED_UID || (directoryStat.mode & 0o777) !== 0o700) {
    throw new Error("probe directory must be owned by the gateway user with mode 0700");
  }
  return {
    dev: BigInt(directoryStat.dev),
    ino: BigInt(directoryStat.ino),
    uid: directoryStat.uid,
    mode: directoryStat.mode & 0o777
  };
}

function requireSecureFile(fd: number, expectedPath: string): VerifiedFile {
  if (path.dirname(expectedPath) !== PROBE_DIRECTORY) {
    throw new Error("probe file escaped fixed directory");
  }
  const fileStat = fstatSync(fd, { bigint: true });
  if (
    !fileStat.isFile() ||
    fileStat.nlink !== 1n ||
    fileStat.uid !== BigInt(EXPECTED_UID) ||
    (fileStat.mode & 0o777n) !== 0o600n
  ) {
    throw new Error("probe files must be regular, singly linked, gateway-owned mode-0600 files");
  }
  const pathStat = lstatSync(expectedPath, { bigint: true });
  if (
    pathStat.isSymbolicLink() ||
    pathStat.dev !== fileStat.dev ||
    pathStat.ino !== fileStat.ino
  ) {
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

function requireUnchangedDirectory(original: FileInvariant): void {
  const current = requireSecureDirectory();
  if (
    current.dev !== original.dev ||
    current.ino !== original.ino ||
    current.uid !== original.uid ||
    current.mode !== original.mode
  ) {
    throw new Error("probe directory changed while evidence files were opened");
  }
}

function requireUnchangedFile(file: VerifiedFile): void {
  const current = fstatSync(file.fd, { bigint: true });
  if (
    !current.isFile() ||
    current.dev !== file.dev ||
    current.ino !== file.ino ||
    current.nlink !== 1n ||
    current.uid !== BigInt(file.uid) ||
    Number(current.mode & 0o777n) !== file.mode
  ) {
    throw new Error(`probe evidence invariant changed: ${file.expectedPath}`);
  }
}

function openVerifiedFiles(): VerifiedFiles {
  const directoryInvariant = requireSecureDirectory();
  const flags = constants.O_WRONLY | constants.O_APPEND | constants.O_NOFOLLOW;
  const hookLogPath = path.join(PROBE_DIRECTORY, HOOK_LOG_NAME);
  const sentinelPath = path.join(PROBE_DIRECTORY, SENTINEL_NAME);
  let hookLogFd: number | undefined;
  let sentinelFd: number | undefined;
  try {
    // O_CREAT is deliberately absent: both files must be securely pre-created.
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
    if (sentinelFd !== undefined) {
      try {
        closeSync(sentinelFd);
      } catch {
        // Preserve the original open/validation error.
      }
    }
    if (hookLogFd !== undefined) {
      try {
        closeSync(hookLogFd);
      } catch {
        // Preserve the original open/validation error.
      }
    }
    throw error;
  }
}

function appendJsonLine(
  directory: FileInvariant,
  file: VerifiedFile,
  value: Record<string, unknown>
): void {
  requireUnchangedDirectory(directory);
  requireUnchangedFile(file);
  const record = Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
  if (record.length > MAX_RECORD_BYTES) {
    throw new Error(`probe evidence record exceeds ${MAX_RECORD_BYTES} bytes`);
  }
  const written = writeSync(file.fd, record, 0, record.length);
  if (written !== record.length) {
    throw new Error("partial probe evidence write");
  }
}

async function pause(milliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

export default definePluginEntry({
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
      let firstError: unknown;
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
            mode: config.mode,
            fault: config.fault,
            toolName: event.toolName,
            params: event.params,
            toolCallId: event.toolCallId ?? null,
            runId: event.runId ?? null,
            wallTime: new Date().toISOString(),
            monotonicNs: process.hrtime.bigint().toString()
          });

          if (config.fault === "throw") {
            throw new Error("injected probe hook failure");
          }
          if (config.fault === "timeout") {
            await pause(6_000);
            return { block: true, blockReason: "late probe timeout denial" };
          }

          await pause(2_000);

          // This is only a simulated malformed decision; no external parser exists here.
          if (config.fault === "malformed" || config.mode !== "allow") {
            return { block: true, blockReason: "InvarOS interception probe denial" };
          }
          if (config.fault === "rewrite") {
            if ((event.params as { marker?: unknown }).marker !== "allow-case") {
              return { block: true, blockReason: "probe rewrite requires allow-case" };
            }
            return { block: false, params: { ...event.params, marker: "rewritten-case" } };
          }
          return { block: false };
        },
        { priority: 100, timeoutMs: 5_000 }
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
          const marker = (params as { marker?: unknown }).marker;
          const markerIsValid =
            config.fault === "rewrite"
              ? marker === "rewritten-case"
              : marker === "deny-case" || marker === "allow-case";
          if (!markerIsValid) {
            throw new Error("invalid probe marker for configured scenario");
          }
          appendJsonLine(files.directory, files.sentinel, {
            phase: "executed",
            marker,
            toolCallId,
            wallTime: new Date().toISOString(),
            monotonicNs: process.hrtime.bigint().toString()
          });
          return {
            content: [{ type: "text" as const, text: `probe executed: ${marker}` }]
          };
        }
      });
    } catch (error) {
      try {
        closeFiles();
      } catch {
        // Preserve the registration error; closeFiles made a best effort on both descriptors.
      }
      throw error;
    }
  }
});
