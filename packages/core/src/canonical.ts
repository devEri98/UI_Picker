import {
  SESSION_SCHEMA,
  SESSION_SCHEMA_VERSION,
  type UiNameValueV1,
  type UiTargetSessionV1,
  type UiTargetV1,
} from "./schema.js";
import { utf8ByteLength } from "./text.js";

type JsonValue = string | number | boolean | JsonObject | readonly JsonValue[];
interface JsonObject {
  readonly [key: string]: JsonValue;
}

const INDENT = 2;

function put(target: Record<string, JsonValue>, key: string, value: JsonValue | undefined): void {
  if (value !== undefined) {
    target[key] = value;
  }
}

function canonicalNameValues(pairs: readonly UiNameValueV1[]): readonly JsonObject[] {
  return pairs.map((pair) => ({ name: pair.name, value: pair.value }));
}

/**
 * Rebuild a target as a plain object whose property order matches the schema.
 *
 * Property order is part of the contract: the same sanitised model must always
 * produce the same bytes.
 */
export function toCanonicalTarget(target: UiTargetV1): JsonObject {
  const location: Record<string, JsonValue> = { pathname: target.location.pathname };
  put(location, "search", target.location.search);
  put(location, "hash", target.location.hash);

  const element: Record<string, JsonValue> = {
    tag: target.element.tag,
    signature: target.element.signature,
  };
  put(element, "domPath", target.element.domPath);

  const result: Record<string, JsonValue> = { capturedAt: target.capturedAt, location };

  if (target.component !== undefined) {
    const component: Record<string, JsonValue> = {
      adapter: target.component.adapter,
      name: target.component.name,
    };
    put(component, "selector", target.component.selector);
    put(component, "ancestry", target.component.ancestry);
    result["component"] = component;
  }

  result["element"] = element;

  if (target.semantics !== undefined) {
    const semantics: Record<string, JsonValue> = {};
    put(semantics, "role", target.semantics.role);
    if (target.semantics.states !== undefined) {
      semantics["states"] = canonicalNameValues(target.semantics.states);
    }
    result["semantics"] = semantics;
  }

  if (target.content !== undefined) {
    const content: Record<string, JsonValue> = {};
    put(content, "text", target.content.text);
    if (target.content.references !== undefined) {
      content["references"] = canonicalNameValues(target.content.references);
    }
    put(content, "textTruncated", target.content.textTruncated);
    result["content"] = content;
  }

  if (target.geometry !== undefined) {
    const geometry: Record<string, JsonValue> = {
      x: target.geometry.x,
      y: target.geometry.y,
      width: target.geometry.width,
      height: target.geometry.height,
      viewportWidth: target.geometry.viewportWidth,
      viewportHeight: target.geometry.viewportHeight,
    };
    put(geometry, "scrollX", target.geometry.scrollX);
    put(geometry, "scrollY", target.geometry.scrollY);
    result["geometry"] = geometry;
  }

  if (target.redactions !== undefined && target.redactions.length > 0) {
    result["redactions"] = target.redactions.map((redaction) => ({
      field: redaction.field,
      action: redaction.action,
      reason: redaction.reason,
    }));
  }

  return result;
}

export function toCanonicalSession(session: UiTargetSessionV1): JsonObject {
  return {
    schema: SESSION_SCHEMA,
    schemaVersion: SESSION_SCHEMA_VERSION,
    targets: session.targets.map(toCanonicalTarget),
  };
}

/** Deterministic JSON text: schema order, two-space indent, LF newlines. */
export function serializeSession(session: UiTargetSessionV1): string {
  return JSON.stringify(toCanonicalSession(session), null, INDENT);
}

export function serializeTarget(target: UiTargetV1): string {
  return JSON.stringify(toCanonicalTarget(target), null, INDENT);
}

export function targetJsonBytes(target: UiTargetV1): number {
  return utf8ByteLength(serializeTarget(target));
}

export function sessionJsonBytes(session: UiTargetSessionV1): number {
  return utf8ByteLength(serializeSession(session));
}
