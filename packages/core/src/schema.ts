import type { CandidateField } from "./fields.js";

/** Machine contract identifier written in every serialised session. */
export const SESSION_SCHEMA = "ui-target-picker/session";

/** Schema version of the session contract implemented by this package. */
export const SESSION_SCHEMA_VERSION = 1;

export interface UiTargetSessionV1 {
  readonly schema: typeof SESSION_SCHEMA;
  readonly schemaVersion: typeof SESSION_SCHEMA_VERSION;
  readonly targets: readonly UiTargetV1[];
}

export interface UiTargetV1 {
  readonly capturedAt: string;
  readonly location: UiLocationV1;
  readonly component?: UiComponentV1;
  readonly element: UiElementV1;
  readonly semantics?: UiSemanticsV1;
  readonly content?: UiContentV1;
  readonly geometry?: UiGeometryV1;
  readonly redactions?: readonly UiRedactionV1[];
}

export interface UiLocationV1 {
  readonly pathname: string;
  readonly search?: string;
  readonly hash?: string;
}

export interface UiComponentV1 {
  readonly adapter: string;
  readonly name: string;
  readonly selector?: string;
  readonly ancestry?: readonly string[];
}

export interface UiElementV1 {
  readonly tag: string;
  readonly signature: string;
  readonly domPath?: string;
}

export interface UiSemanticsV1 {
  readonly role?: string;
  readonly states?: readonly UiNameValueV1[];
}

export interface UiNameValueV1 {
  readonly name: string;
  readonly value: string | boolean;
}

export interface UiContentV1 {
  readonly text?: string;
  readonly references?: readonly UiNameValueV1[];
  readonly textTruncated?: true;
}

export interface UiGeometryV1 {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly scrollX?: number;
  readonly scrollY?: number;
}

export type UiRedactionActionV1 = "omitted" | "replaced" | "truncated";

export type UiRedactionReasonV1 =
  "default-policy" | "sensitive-element" | "custom-policy" | "length-limit";

export interface UiRedactionV1 {
  readonly field: CandidateField;
  readonly action: UiRedactionActionV1;
  readonly reason: UiRedactionReasonV1;
}

/** An empty, valid session. */
export function createEmptySession(): UiTargetSessionV1 {
  return deepFreeze({
    schema: SESSION_SCHEMA,
    schemaVersion: SESSION_SCHEMA_VERSION,
    targets: [],
  });
}

/**
 * Structural guard for a session produced by an unknown source.
 *
 * A consumer must reject a version it does not understand instead of guessing.
 */
export function isUiTargetSessionV1(value: unknown): value is UiTargetSessionV1 {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<UiTargetSessionV1>;
  return (
    candidate.schema === SESSION_SCHEMA &&
    candidate.schemaVersion === SESSION_SCHEMA_VERSION &&
    Array.isArray(candidate.targets)
  );
}

/** Error thrown when a session declares a schema version this package cannot read. */
export class UnsupportedSchemaVersionError extends Error {
  readonly code = "UNSUPPORTED_SCHEMA_VERSION" as const;
  readonly receivedVersion: unknown;

  constructor(receivedVersion: unknown) {
    super(
      `Unsupported session schema version: ${String(receivedVersion)}. Expected ${String(SESSION_SCHEMA_VERSION)}.`,
    );
    this.name = "UnsupportedSchemaVersionError";
    this.receivedVersion = receivedVersion;
  }
}

/**
 * Freeze a value and everything reachable from it.
 *
 * Snapshots handed to consumers are deeply immutable by contract.
 */
export function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const entry of Object.values(value as Record<string, unknown>)) {
    deepFreeze(entry);
  }
  return value;
}
