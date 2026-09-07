import { BUDGETS } from "./budgets.js";
import { CANDIDATE_FIELDS, type CandidateField } from "./fields.js";
import type { UiRedactionActionV1, UiRedactionReasonV1, UiRedactionV1 } from "./schema.js";

const ACTION_ORDER: Record<UiRedactionActionV1, number> = {
  omitted: 0,
  replaced: 1,
  truncated: 2,
};

const REASON_ORDER: Record<UiRedactionReasonV1, number> = {
  "default-policy": 0,
  "sensitive-element": 1,
  "custom-policy": 2,
  "length-limit": 3,
};

const FIELD_ORDER = new Map<CandidateField, number>(
  CANDIDATE_FIELDS.map((field, index) => [field, index]),
);

function compare(left: UiRedactionV1, right: UiRedactionV1): number {
  const byField = (FIELD_ORDER.get(left.field) ?? 0) - (FIELD_ORDER.get(right.field) ?? 0);
  if (byField !== 0) {
    return byField;
  }
  const byAction = ACTION_ORDER[left.action] - ACTION_ORDER[right.action];
  if (byAction !== 0) {
    return byAction;
  }
  return REASON_ORDER[left.reason] - REASON_ORDER[right.reason];
}

function key(redaction: UiRedactionV1): string {
  return `${redaction.field}|${redaction.action}|${redaction.reason}`;
}

/**
 * Merge redaction records, drop duplicates, sort by field then action and cap
 * the result at the documented budget.
 */
export function mergeRedactions(
  ...groups: readonly (readonly UiRedactionV1[] | undefined)[]
): readonly UiRedactionV1[] {
  const unique = new Map<string, UiRedactionV1>();
  for (const group of groups) {
    for (const redaction of group ?? []) {
      const identity = key(redaction);
      if (!unique.has(identity)) {
        unique.set(identity, redaction);
      }
    }
  }
  return [...unique.values()].sort(compare).slice(0, BUDGETS.redactions);
}
