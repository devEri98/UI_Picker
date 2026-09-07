import { BUDGETS } from "./budgets.js";
import type { CandidateField } from "./fields.js";
import { mergeRedactions } from "./redaction-records.js";
import type { UiRedactionActionV1, UiRedactionReasonV1, UiRedactionV1 } from "./schema.js";
import { clampCodePoints, normalizeString } from "./text.js";

export type PrivacyPreset = "balanced" | "strict";

export interface PrivacyPolicy {
  readonly preset: PrivacyPreset;
  readonly includeSearch: boolean;
  readonly includeHash: boolean;
  readonly maxTextLength: number;
  readonly redact?: TrustedRedactor;
}

export interface RedactionCandidate {
  readonly field: CandidateField;
  readonly value: string;
}

export type RedactionDecision =
  | { readonly action: "keep" }
  | { readonly action: "omit" }
  | { readonly action: "replace"; readonly value: string };

/**
 * Consumer-provided redactor.
 *
 * Trust boundary: this callback is privileged consumer code. It receives one
 * raw string at a time and never an `Element`, `Window`, cookie, storage or
 * framework instance. It runs after the built-in redactor and cannot re-enable
 * a value the built-in policy removed.
 */
export type TrustedRedactor = (candidate: Readonly<RedactionCandidate>) => RedactionDecision;

/** Replacement used when a value must exist but cannot be disclosed. */
export const REDACTED_PLACEHOLDER = "[redacted]";

/** Thrown when options fall outside the public contract. */
export class InvalidConfigurationError extends Error {
  readonly code = "INVALID_CONFIGURATION" as const;
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid UI Target Picker configuration: ${issues.join("; ")}`);
    this.name = "InvalidConfigurationError";
    this.issues = issues;
  }
}

const PRESETS: readonly PrivacyPreset[] = ["balanced", "strict"];

const STATIC_FIELD_LIMITS: Record<Exclude<CandidateField, "content.text">, number> = {
  "component.ancestry": BUDGETS.componentNameCodePoints,
  "component.name": BUDGETS.componentNameCodePoints,
  "component.selector": BUDGETS.componentSelectorCodePoints,
  "content.reference": BUDGETS.referenceValueCodePoints,
  "element.class": BUDGETS.classCodePoints,
  "element.domPath": BUDGETS.domPathCodePoints,
  "element.id": BUDGETS.idCodePoints,
  "location.hash": BUDGETS.hashCodePoints,
  "location.pathname": BUDGETS.pathnameCodePoints,
  "location.search": BUDGETS.searchCodePoints,
  "semantics.role": BUDGETS.roleCodePoints,
  "semantics.state": BUDGETS.stateValueCodePoints,
};

function fieldLimit(policy: PrivacyPolicy, field: CandidateField): number {
  return field === "content.text" ? policy.maxTextLength : STATIC_FIELD_LIMITS[field];
}

/**
 * Validate and complete a partial policy.
 *
 * Values outside the contract invalidate the initialisation instead of being
 * silently corrected.
 */
export function resolvePrivacyPolicy(input?: Partial<PrivacyPolicy>): PrivacyPolicy {
  const issues: string[] = [];
  const preset = input?.preset ?? "balanced";

  if (!PRESETS.includes(preset)) {
    issues.push(`privacy.preset must be one of ${PRESETS.join(", ")}`);
  }

  const defaultMaxTextLength = preset === "strict" ? 0 : BUDGETS.textCodePoints;
  const maxTextLength = input?.maxTextLength ?? defaultMaxTextLength;

  if (
    typeof maxTextLength !== "number" ||
    !Number.isInteger(maxTextLength) ||
    maxTextLength < 0 ||
    maxTextLength > BUDGETS.textCodePoints
  ) {
    issues.push(`privacy.maxTextLength must be an integer between 0 and ${BUDGETS.textCodePoints}`);
  }

  const includeSearch = input?.includeSearch ?? false;
  const includeHash = input?.includeHash ?? false;

  if (typeof includeSearch !== "boolean") {
    issues.push("privacy.includeSearch must be a boolean");
  }
  if (typeof includeHash !== "boolean") {
    issues.push("privacy.includeHash must be a boolean");
  }
  if (input?.redact !== undefined && typeof input.redact !== "function") {
    issues.push("privacy.redact must be a function");
  }

  if (issues.length > 0) {
    throw new InvalidConfigurationError(issues);
  }

  const policy = { preset, includeSearch, includeHash, maxTextLength };
  return input?.redact === undefined ? policy : { ...policy, redact: input.redact };
}

export type RedactionResult =
  | { readonly kind: "value"; readonly value: string; readonly truncated: boolean }
  | { readonly kind: "omitted" };

export interface RedactionEngine {
  /** Run the full pipeline for one raw candidate string. */
  apply(field: CandidateField, rawValue: string): RedactionResult;
  /** Record that a value was skipped because the element itself is sensitive. */
  omitSensitive(field: CandidateField): void;
  /** Record that a value was dropped to fit a budget. */
  recordLengthLimit(field: CandidateField, action: UiRedactionActionV1): void;
  /** Sorted, deduplicated and capped redaction metadata. */
  records(): readonly UiRedactionV1[];
}

type BuiltinDecision =
  | { readonly action: "keep" }
  | { readonly action: "omit" }
  | { readonly action: "replace"; readonly value: string };

const KEEP: BuiltinDecision = { action: "keep" };
const OMIT: BuiltinDecision = { action: "omit" };

function builtinDecision(policy: PrivacyPolicy, field: CandidateField): BuiltinDecision {
  if (policy.preset === "strict") {
    // The DOM path is built from ids, test ids and classes, none of which the
    // strict preset discloses, so it is dropped with them.
    switch (field) {
      case "location.pathname":
        return { action: "replace", value: REDACTED_PLACEHOLDER };
      case "location.search":
      case "location.hash":
      case "element.id":
      case "element.class":
      case "element.domPath":
      case "content.text":
      case "content.reference":
        return OMIT;
      default:
        return KEEP;
    }
  }

  switch (field) {
    case "location.search":
      return policy.includeSearch ? KEEP : OMIT;
    case "location.hash":
      return policy.includeHash ? KEEP : OMIT;
    case "content.text":
      return policy.maxTextLength === 0 ? OMIT : KEEP;
    default:
      return KEEP;
  }
}

function isRedactionDecision(value: unknown): value is RedactionDecision {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const action: unknown = (value as { action?: unknown }).action;
  if (action === "keep" || action === "omit") {
    return true;
  }
  if (action !== "replace") {
    return false;
  }
  return typeof (value as { value?: unknown }).value === "string";
}

export function createRedactionEngine(policy: PrivacyPolicy): RedactionEngine {
  const collected = new Map<string, UiRedactionV1>();

  function record(
    field: CandidateField,
    action: UiRedactionActionV1,
    reason: UiRedactionReasonV1,
  ): void {
    const key = `${field}|${action}|${reason}`;
    if (!collected.has(key)) {
      collected.set(key, { field, action, reason });
    }
  }

  function failClosed(field: CandidateField): RedactionResult {
    if (field === "location.pathname") {
      record(field, "replaced", "custom-policy");
      return { kind: "value", value: REDACTED_PLACEHOLDER, truncated: false };
    }
    record(field, "omitted", "custom-policy");
    return { kind: "omitted" };
  }

  function finish(field: CandidateField, value: string, truncated: boolean): RedactionResult {
    const clamped = clampCodePoints(value, fieldLimit(policy, field));
    if (clamped.truncated) {
      record(field, "truncated", "length-limit");
    }
    if (clamped.value.length === 0) {
      return { kind: "omitted" };
    }
    return { kind: "value", value: clamped.value, truncated: truncated || clamped.truncated };
  }

  function runCustomRedactor(
    redact: TrustedRedactor,
    field: CandidateField,
    value: string,
  ): RedactionResult {
    let decision: RedactionDecision;
    try {
      decision = redact({ field, value });
    } catch {
      return failClosed(field);
    }

    if (!isRedactionDecision(decision)) {
      return failClosed(field);
    }
    if (decision.action === "keep") {
      return finish(field, value, false);
    }
    if (decision.action === "omit") {
      if (field === "location.pathname") {
        record(field, "replaced", "custom-policy");
        return { kind: "value", value: REDACTED_PLACEHOLDER, truncated: false };
      }
      record(field, "omitted", "custom-policy");
      return { kind: "omitted" };
    }

    const replacement = normalizeString(decision.value);
    if (
      replacement.length === 0 ||
      clampCodePoints(replacement, fieldLimit(policy, field)).truncated
    ) {
      return failClosed(field);
    }
    record(field, "replaced", "custom-policy");
    return finish(field, replacement, false);
  }

  return {
    apply(field, rawValue) {
      const normalized = normalizeString(rawValue);
      if (normalized.length === 0) {
        // Nothing was collected, so nothing was redacted.
        return { kind: "omitted" };
      }

      const builtin = builtinDecision(policy, field);
      let value: string;

      if (builtin.action === "omit") {
        record(field, "omitted", "default-policy");
        return { kind: "omitted" };
      }
      if (builtin.action === "replace") {
        record(field, "replaced", "default-policy");
        value = builtin.value;
      } else {
        value = normalized;
      }

      if (policy.redact === undefined) {
        return finish(field, value, false);
      }
      return runCustomRedactor(policy.redact, field, value);
    },

    omitSensitive(field) {
      record(field, "omitted", "sensitive-element");
    },

    recordLengthLimit(field, action) {
      record(field, action, "length-limit");
    },

    records() {
      return mergeRedactions([...collected.values()]);
    },
  };
}
