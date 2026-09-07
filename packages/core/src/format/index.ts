import { serializeSession } from "../canonical.js";
import type { UiTargetSessionV1 } from "../schema.js";
import { formatSessionAsText } from "./text.js";

export type OutputFormat = "text" | "json";

export { formatSessionAsText, formatTargetAsText } from "./text.js";

/** Deterministic JSON: schema property order, two-space indent, LF newlines. */
export function formatSessionAsJson(session: UiTargetSessionV1): string {
  return serializeSession(session);
}

export function formatSession(session: UiTargetSessionV1, format: OutputFormat): string {
  return format === "json" ? formatSessionAsJson(session) : formatSessionAsText(session);
}
