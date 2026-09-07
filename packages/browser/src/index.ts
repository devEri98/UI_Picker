export {
  isHidden,
  isPickerNode,
  isSelectableTarget,
  isSensitiveBoundary,
  type BoundaryOptions,
  type SelectabilityOptions,
} from "./boundaries.js";

export {
  ClipboardWriteError,
  createClipboardWriter,
  type ClipboardFailureReason,
  type ClipboardWriter,
} from "./clipboard.js";

export {
  COPY_TIMEOUT_MS,
  createUiTargetPicker,
  type UiTargetPickerController,
  type UiTargetPickerOptions,
} from "./controller.js";

export type {
  ControllerDestroyedError,
  CopyResult,
  CopyState,
  Lifecycle,
  LifecycleResult,
  SelectionMode,
  StateListener,
  UiTargetPickerState,
  Unsubscribe,
} from "./controller-types.js";

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

export { createOverlay, type Overlay } from "./overlay.js";

export { createPanel, type Panel, type PanelHandlers } from "./panel/panel.js";

export {
  clampPosition,
  createPositionStore,
  defaultPosition,
  PANEL_MARGIN,
  PANEL_WIDTH,
  type PanelPosition,
  type PositionStore,
} from "./panel/position.js";

export {
  copySucceeded,
  errorMessage,
  sessionCleared,
  targetAdded,
  targetRemoved,
  undone,
  EMPTY_HINT,
  EMPTY_TITLE,
  FORMAT_LABELS,
  POSITION_RESET,
  REDACTED_NOTE,
  SELECTION_LABELS,
} from "./panel/messages.js";

export { createPickerSurface, PICKER_Z_INDEX, type PickerSurface } from "./surface.js";

export {
  installPointerCapture,
  type PointerCapture,
  type PointerCaptureHandlers,
} from "./pointer.js";

export {
  codeMatches,
  DEFAULT_SHORTCUTS,
  EXIT_SELECTION_CODE,
  isComposing,
  isEditableEventSource,
  matchesShortcut,
  modifierForCode,
  releasesHold,
  resolveShortcuts,
  type KeyboardShortcut,
  type UiTargetPickerShortcuts,
} from "./shortcuts.js";

export {
  isValidAdapterName,
  runResolver,
  type ComponentResolution,
  type ComponentResolutionResult,
  type ComponentResolver,
  type ValidatedResolution,
} from "./resolver.js";
