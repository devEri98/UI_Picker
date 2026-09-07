/**
 * Canonical logical paths a redaction decision can refer to.
 *
 * A field is not a JSON Pointer: it can also name a property that the sanitised
 * model omits entirely.
 */
export type CandidateField =
  | "location.pathname"
  | "location.search"
  | "location.hash"
  | "component.name"
  | "component.selector"
  | "component.ancestry"
  | "element.id"
  | "element.class"
  | "element.domPath"
  | "semantics.role"
  | "semantics.state"
  | "content.text"
  | "content.reference";

/** Every candidate field, in the order used to sort redaction records. */
export const CANDIDATE_FIELDS: readonly CandidateField[] = [
  "component.ancestry",
  "component.name",
  "component.selector",
  "content.reference",
  "content.text",
  "element.class",
  "element.domPath",
  "element.id",
  "location.hash",
  "location.pathname",
  "location.search",
  "semantics.role",
  "semantics.state",
];

const FIELD_SET = new Set<string>(CANDIDATE_FIELDS);

export function isCandidateField(value: unknown): value is CandidateField {
  return typeof value === "string" && FIELD_SET.has(value);
}
