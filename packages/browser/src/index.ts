export {
  isHidden,
  isPickerNode,
  isSelectableTarget,
  isSensitiveBoundary,
  type BoundaryOptions,
  type SelectabilityOptions,
} from "./boundaries.js";

export { escapeAttributeValue, escapeIdentifier } from "./css.js";

export { buildDomPath, type DomPathResult } from "./extract/dom-path.js";

export {
  buildSignature,
  DEFAULT_EXCLUDED_CLASS_PREFIXES,
  readTag,
  significantClasses,
  type ElementNamingOptions,
  type ElementSignature,
} from "./extract/element.js";

export { readGeometry } from "./extract/geometry.js";

export {
  createTargetExtractor,
  extractUiTarget,
  type ExtractionOptions,
  type ExtractionResult,
  type ExtractionSuccess,
  type TargetExtractor,
} from "./extract/index.js";

export {
  readReferences,
  readRole,
  readStates,
  REFERENCE_ATTRIBUTES,
  type RawState,
} from "./extract/semantics.js";

export { collectVisibleText } from "./extract/visible-text.js";

export {
  isValidAdapterName,
  runResolver,
  type ComponentResolution,
  type ComponentResolutionResult,
  type ComponentResolver,
  type ValidatedResolution,
} from "./resolver.js";
