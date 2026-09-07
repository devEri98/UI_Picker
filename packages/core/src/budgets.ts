/**
 * Normative budgets defined by `docs/extraction-spec.md`.
 *
 * Every limit is expressed in Unicode code points unless the name says bytes.
 * Byte budgets are measured on the canonical UTF-8 JSON serialisation.
 */
export const BUDGETS = {
  /** Maximum targets a session can hold. */
  maxTargetsPerSession: 20,
  /** Maximum targets configurable through options. */
  maxTargetsUpperBound: 20,
  /** Minimum targets configurable through options. */
  maxTargetsLowerBound: 1,
  /** UTF-8 JSON bytes allowed for a single target. */
  targetJsonBytes: 8 * 1024,
  /** UTF-8 JSON bytes allowed for the whole session. */
  sessionJsonBytes: 64 * 1024,
  /** Upper bound accepted for `maxTextLength`. */
  textCodePoints: 80,
  pathnameCodePoints: 512,
  searchCodePoints: 512,
  hashCodePoints: 512,
  domPathCodePoints: 2048,
  domPathSegments: 12,
  domPathSegmentCodePoints: 256,
  ancestryNames: 16,
  states: 16,
  references: 8,
  redactions: 32,
  tagCodePoints: 64,
  idCodePoints: 128,
  classCodePoints: 128,
  /** Significant classes kept in the element signature. */
  signatureClasses: 2,
  componentNameCodePoints: 128,
  componentSelectorCodePoints: 128,
  adapterCodePoints: 64,
  roleCodePoints: 64,
  stateNameCodePoints: 64,
  stateValueCodePoints: 128,
  referenceNameCodePoints: 64,
  referenceValueCodePoints: 128,
} as const;
