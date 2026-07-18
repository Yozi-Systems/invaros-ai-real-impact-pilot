import net from "node:net";
import { buildAuthorizationRequest, MAX_FRAME_BYTES, parseAuthorizationResponse } from "./protocol.js";

export const DEFAULT_SOCKET_PATH = "/run/invarosd/openclaw-authorize.sock";
export const DEFAULT_TIMEOUT_MS = 1_000;

export async function authorizeToolCall(event: { toolName: string; params: unknown; toolCallId?: string; runId?: string }, options: { socketPath?: string; timeoutMs?: number; requestId?: string; now?: number } = {}) {
  const request = buildAuthorizationRequest(event, options.now ?? Date.now(), options.requestId);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const frame = Buffer.allocUnsafe(4 + request.body.length);
  frame.writeUInt32BE(request.body.length, 0); request.body.copy(frame, 4);
  const response = await new Promise<Buffer>((resolve, reject) => {
    const socket = net.createConnection({ path: options.socketPath ?? DEFAULT_SOCKET_PATH });
    let header = Buffer.alloc(0), body = Buffer.alloc(0), expected: number | undefined, settled = false;
    const finish = (error?: Error, value?: Buffer) => { if (settled) return; settled = true; clearTimeout(timer); socket.destroy(); error ? reject(error) : resolve(value!); };
    const timer = setTimeout(() => finish(new Error("authorization IPC deadline exceeded")), timeoutMs);
    socket.once("connect", () => socket.write(frame));
    socket.on("data", (chunk) => {
      if (expected === undefined) {
        header = Buffer.concat([header, chunk]);
        if (header.length < 4) return;
        expected = header.readUInt32BE(0);
        if (expected === 0 || expected > MAX_FRAME_BYTES) return finish(new Error("authorization response frame is invalid"));
        body = header.subarray(4); header = Buffer.alloc(0);
      } else body = Buffer.concat([body, chunk]);
      if (body.length > expected) return finish(new Error("authorization response has trailing bytes"));
      if (body.length === expected) finish(undefined, body);
    });
    socket.once("error", (error) => finish(error));
    socket.once("end", () => finish(new Error("authorization response ended early")));
    socket.once("close", () => { if (!settled) finish(new Error("authorization connection closed")); });
  });
  return { response: parseAuthorizationResponse(response, request.requestId, request.toolCallId), ...request };
}
