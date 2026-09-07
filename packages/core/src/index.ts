export { BUDGETS } from "./budgets.js";

export {
  serializeSession,
  serializeTarget,
  sessionJsonBytes,
  targetJsonBytes,
  toCanonicalSession,
  toCanonicalTarget,
} from "./canonical.js";

export {
  fail,
  ok,
  resolverFailed,
  SESSION_SIZE_LIMIT_REACHED,
  TARGET_LIMIT_REACHED,
  TARGET_NOT_SELECTABLE,
  TARGET_TOO_LARGE,
  type CopyError,
  type PickerError,
  type PickerErrorCode,
  type Result,
} from "./errors.js";

export { CANDIDATE_FIELDS, isCandidateField, type CandidateField } from "./fields.js";

export {
  formatSession,
  formatSessionAsJson,
  formatSessionAsText,
  formatTargetAsText,
  type OutputFormat,
} from "./format/index.js";

export {
  createRedactionEngine,
  InvalidConfigurationError,
  REDACTED_PLACEHOLDER,
  resolvePrivacyPolicy,
  type PrivacyPolicy,
  type PrivacyPreset,
  type RedactionCandidate,
  type RedactionDecision,
  type RedactionEngine,
  type RedactionResult,
  type TrustedRedactor,
} from "./privacy.js";

export { mergeRedactions } from "./redaction-records.js";

export {
  createEmptySession,
  deepFreeze,
  isUiTargetSessionV1,
  SESSION_SCHEMA,
  SESSION_SCHEMA_VERSION,
  UnsupportedSchemaVersionError,
  type UiComponentV1,
  type UiContentV1,
  type UiElementV1,
  type UiGeometryV1,
  type UiLocationV1,
  type UiNameValueV1,
  type UiRedactionActionV1,
  type UiRedactionReasonV1,
  type UiRedactionV1,
  type UiSemanticsV1,
  type UiTargetSessionV1,
  type UiTargetV1,
} from "./schema.js";

export {
  createSessionStore,
  reduceTargetToBudget,
  type AddedTarget,
  type SessionStoreOptions,
  type UiTargetSessionStore,
} from "./session.js";

export {
  clampCodePoints,
  countCodePoints,
  normalizeString,
  toCodePoints,
  utf8ByteLength,
  type ClampResult,
} from "./text.js";
