import { createHash, randomUUID } from "node:crypto";

export const AUTH_PROTOCOL = "invaros.openclaw.authorization.v1";
export const REQUEST_TYPE = "authorization_request";
export const RESPONSE_TYPE = "authorization_response";
export const MAX_FRAME_BYTES = 65_536;

export function buildAuthorizationRequest(event: {
  toolName: string; params: unknown; toolCallId?: string; runId?: string;
}, now = Date.now(), requestId = randomUUID()) {
  if (!event.toolCallId) throw new Error("toolCallId is required for authorization");
  if (!event.params || typeof event.params !== "object" || Array.isArray(event.params)) {
    throw new Error("tool params must be an object");
  }
  const paramsJson = JSON.stringify(event.params);
  const paramsBytes = Buffer.from(paramsJson, "utf8");
  const paramsSha256 = createHash("sha256").update(paramsBytes).digest("hex");
  const prefix = JSON.stringify({
    protocol: AUTH_PROTOCOL, messageType: REQUEST_TYPE, requestId,
    toolCallId: event.toolCallId, toolName: event.toolName
  }).slice(0, -1);
  const suffix = `,"params":${paramsJson},"sentAtUnixMs":${now},"runId":${event.runId === undefined ? "null" : JSON.stringify(event.runId)}}`;
  const body = Buffer.from(prefix + suffix, "utf8");
  if (body.length === 0 || body.length > MAX_FRAME_BYTES) throw new Error("authorization request exceeds frame limit");
  return { body, requestId, toolCallId: event.toolCallId, paramsByteLength: paramsBytes.length, paramsSha256 };
}

export function parseAuthorizationResponse(bytes: Buffer, requestId: string, toolCallId: string) {
  if (bytes.length === 0 || bytes.length > MAX_FRAME_BYTES) throw new Error("invalid authorization response size");
  let value: unknown;
  try { value = JSON.parse(bytes.toString("utf8")); } catch { throw new Error("authorization response is malformed"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("authorization response must be an object");
  const response = value as Record<string, unknown>;
  const expected = ["daemonPid", "decision", "message", "messageType", "policyId", "protocol", "reasonCode", "requestId", "toolCallId"];
  const keys = Object.keys(response).sort();
  if (keys.length !== expected.length || keys.some((key, i) => key !== expected[i])) throw new Error("authorization response fields are invalid");
  if (response.protocol !== AUTH_PROTOCOL || response.messageType !== RESPONSE_TYPE ||
      response.requestId !== requestId || response.toolCallId !== toolCallId) throw new Error("authorization response correlation is invalid");
  if (response.decision !== "ALLOW" && response.decision !== "DENY") throw new Error("authorization decision is invalid");
  if (typeof response.reasonCode !== "string" || !response.reasonCode ||
      typeof response.message !== "string" || !response.message ||
      typeof response.policyId !== "string" || !response.policyId ||
      !Number.isInteger(response.daemonPid) || (response.daemonPid as number) < 1) throw new Error("authorization response values are invalid");
  return response as { decision: "ALLOW"|"DENY"; reasonCode: string; message: string; policyId: string; daemonPid: number; requestId: string; toolCallId: string };
}
