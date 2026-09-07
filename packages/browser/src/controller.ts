import {
  createEmptySession,
  createSessionStore,
  deepFreeze,
  formatSession,
  resolvePrivacyPolicy,
  type CopyError,
  type OutputFormat,
  type PickerError,
  type PrivacyPolicy,
  type UiTargetSessionV1,
} from "@ui-target-picker/core";

import { isSelectableTarget } from "./boundaries.js";
import type {
  CopyResult,
  CopyState,
  Lifecycle,
  LifecycleResult,
  SelectionMode,
  StateListener,
  UiTargetPickerState,
  Unsubscribe,
} from "./controller-types.js";
import { ClipboardWriteError, createClipboardWriter, type ClipboardWriter } from "./clipboard.js";
import { createTargetExtractor, type TargetExtractor } from "./extract/index.js";
import { readTag, significantClasses } from "./extract/element.js";
import { createOverlay, type Overlay } from "./overlay.js";
import { createPanel, type Panel } from "./panel/panel.js";
import {
  copySucceeded,
  errorMessage,
  sessionCleared,
  targetAdded,
  targetRemoved,
  undone,
  POSITION_RESET,
} from "./panel/messages.js";
import { installPointerCapture, type PointerCapture } from "./pointer.js";
import type { ComponentResolver } from "./resolver.js";
import { createPickerSurface, type PickerSurface } from "./surface.js";
import {
  codeMatches,
  EXIT_SELECTION_CODE,
  isComposing,
  isEditableEventSource,
  matchesShortcut,
  releasesHold,
  resolveShortcuts,
  type UiTargetPickerShortcuts,
} from "./shortcuts.js";

export interface UiTargetPickerOptions {
  readonly resolver?: ComponentResolver;
  readonly shortcuts?: Partial<UiTargetPickerShortcuts>;
  readonly privacy?: Partial<PrivacyPolicy>;
  readonly maxTargets?: number;
  readonly initialFormat?: OutputFormat;
  /** Document to operate on; defaults to the ambient one. Injected in tests. */
  readonly document?: Document;
  readonly excludedClassPrefixes?: readonly string[];
  readonly sensitiveSelectors?: readonly string[];
  readonly now?: () => Date;
  /** Clipboard implementation; defaults to the browser one. Injected in tests. */
  readonly clipboard?: ClipboardWriter;
  /** Mounts the floating panel with the picker. Defaults to true. */
  readonly panel?: boolean;
}

export interface UiTargetPickerController {
  enable(): LifecycleResult;
  disable(): LifecycleResult;
  destroy(): LifecycleResult;
  getState(): Readonly<UiTargetPickerState>;
  getSession(): Readonly<UiTargetSessionV1>;
  /** Selects the format used by `copy` when it is called without one. */
  setOutputFormat(format: OutputFormat): LifecycleResult;
  copy(format?: OutputFormat): Promise<CopyResult>;
  /** Removes one target and renumbers the rest. */
  removeTarget(index: number): LifecycleResult;
  /** Empties the session; the picker stays usable. */
  clearSession(): LifecycleResult;
  /** Restores the single removal snapshot. */
  undo(): LifecycleResult;
  /** Brings the panel back to its initial corner. */
  resetPanelPosition(): LifecycleResult;
  subscribe(listener: StateListener): Unsubscribe;
}

/** A copy without an outcome after this long is abandoned. */
export const COPY_TIMEOUT_MS = 10_000;

const DESTROYED: LifecycleResult = {
  ok: false,
  error: { code: "CONTROLLER_DESTROYED", recoverable: false },
};

const OK: LifecycleResult = { ok: true };

const OUTPUT_FORMATS: readonly OutputFormat[] = ["text", "json"];

function resolveDocument(candidate: Document | undefined): Document {
  const doc = candidate ?? (globalThis as { document?: Document }).document;
  if (doc === undefined) {
    throw new Error("UI Target Picker requires a document; pass options.document.");
  }
  return doc;
}

/**
 * Create the picker controller.
 *
 * Nothing is installed until `enable` is called, and importing this module has
 * no side effect: a development-only integration must start the picker
 * explicitly.
 */
export function createUiTargetPicker(
  options: UiTargetPickerOptions = {},
): UiTargetPickerController {
  const doc = resolveDocument(options.document);
  const shortcuts = resolveShortcuts(options.shortcuts);
  let outputFormat = options.initialFormat ?? "text";

  if (!OUTPUT_FORMATS.includes(outputFormat)) {
    throw new Error(`initialFormat must be one of ${OUTPUT_FORMATS.join(", ")}`);
  }

  const session = createSessionStore(
    options.maxTargets === undefined ? undefined : { maxTargets: options.maxTargets },
  );

  // Resolved here so an out of contract policy fails the initialisation instead
  // of the first capture.
  const privacy = resolvePrivacyPolicy(options.privacy);

  let extractor: TargetExtractor | undefined;
  function targetExtractor(): TargetExtractor {
    extractor ??= createTargetExtractor({
      privacy,
      ...(options.resolver === undefined ? {} : { resolver: options.resolver }),
      ...(options.now === undefined ? {} : { now: options.now }),
      ...(options.excludedClassPrefixes === undefined
        ? {}
        : { excludedClassPrefixes: options.excludedClassPrefixes }),
      ...(options.sensitiveSelectors === undefined
        ? {}
        : { sensitiveSelectors: options.sensitiveSelectors }),
      ...(surface === undefined ? {} : { pickerRoot: surface.root }),
    });
    return extractor;
  }

  const clipboard = options.clipboard ?? createClipboardWriter(doc);

  let lifecycle: Lifecycle = "created";
  let selectionMode: SelectionMode = "inactive";
  let copyState: CopyState = "idle";
  /** Invalidates the outcome of a copy that timed out or outlived the controller. */
  let copyToken = 0;
  let lastError: PickerError | undefined;
  let surface: PickerSurface | undefined;
  let overlay: Overlay | undefined;
  let panel: Panel | undefined;
  let pointer: PointerCapture | undefined;
  let listeners: StateListener[] = [];
  let state = buildState();

  function buildState(): Readonly<UiTargetPickerState> {
    return deepFreeze<UiTargetPickerState>({
      lifecycle,
      selectionMode,
      copyState,
      targetCount: session.size(),
      maxTargets: session.maxTargets,
      outputFormat,
      canUndo: session.canUndo(),
      ...(lastError === undefined ? {} : { lastError }),
    });
  }

  function emit(): void {
    const next = buildState();
    if (
      next.lifecycle === state.lifecycle &&
      next.selectionMode === state.selectionMode &&
      next.copyState === state.copyState &&
      next.targetCount === state.targetCount &&
      next.canUndo === state.canUndo &&
      next.outputFormat === state.outputFormat &&
      next.lastError === state.lastError
    ) {
      return;
    }
    state = next;
    panel?.render(state, session.getSession());
    for (const listener of [...listeners]) {
      listener(state);
    }
  }

  /** Panel feedback. Errors that need intervention are announced as alerts. */
  function announce(message: string, tone: "status" | "alert" = "status"): void {
    panel?.announce(message, tone);
  }

  function announceError(error: PickerError): void {
    announce(errorMessage(error, session.maxTargets), "alert");
  }

  function isSelectable(element: Element): boolean {
    return isSelectableTarget(element, {
      document: doc,
      ...(surface === undefined ? {} : { pickerRoot: surface.root }),
      ...(options.sensitiveSelectors === undefined
        ? {}
        : { sensitiveSelectors: options.sensitiveSelectors }),
    });
  }

  /**
   * Transient label for the overlay.
   *
   * Under the strict preset only the tag is shown, so the overlay never
   * displays something the sanitised model would have removed.
   */
  function describe(element: Element): string {
    const tag = readTag(element);
    if (privacy.preset === "strict") {
      return tag;
    }
    const classes = significantClasses(element, {
      ...(options.excludedClassPrefixes === undefined
        ? {}
        : { excludedClassPrefixes: options.excludedClassPrefixes }),
    });
    return classes.length === 0 ? tag : `${tag}.${classes.join(".")}`;
  }

  function capture(element: Element): void {
    const extraction = targetExtractor().extract(element);
    if (!extraction.ok) {
      lastError = extraction.error;
      emit();
      announceError(extraction.error);
      return;
    }

    const added = session.add(extraction.value);
    lastError = added.ok ? extraction.warnings[0] : added.error;
    emit();

    if (!added.ok) {
      announceError(added.error);
      return;
    }
    announce(targetAdded(added.value.index + 1));
    if (extraction.warnings[0] !== undefined) {
      announceError(extraction.warnings[0]);
    }
  }

  function setSelectionMode(next: SelectionMode): void {
    if (selectionMode === next) {
      return;
    }
    selectionMode = next;
    if (next === "inactive") {
      overlay?.hide();
    }
    emit();
  }

  /**
   * The pointer machine stays installed for the whole enabled lifetime.
   *
   * Tearing it down from inside its own handler, right after a temporary
   * capture, would let the trailing click reach the application.
   */
  function installPointer(view: Window, pickerRoot: Node): PointerCapture {
    return installPointerCapture(view, pickerRoot, {
      isArmed: () => selectionMode !== "inactive",
      isSelectable,
      onHover: (element) => {
        if (element === null) {
          overlay?.hide();
          return;
        }
        overlay?.show(element, describe(element));
      },
      onCapture: (element) => {
        capture(element);
        if (selectionMode === "temporary") {
          setSelectionMode("inactive");
        }
      },
    });
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (isComposing(event) || isEditableEventSource(event.target)) {
      return;
    }
    if (matchesShortcut(event, shortcuts.continuousSelection)) {
      event.preventDefault();
      setSelectionMode(selectionMode === "continuous" ? "inactive" : "continuous");
      return;
    }
    if (codeMatches(event, EXIT_SELECTION_CODE) && selectionMode !== "inactive") {
      // Leaving selection never clears the session.
      setSelectionMode("inactive");
      return;
    }
    if (matchesShortcut(event, shortcuts.captureFocused)) {
      event.preventDefault();
      const focused = doc.activeElement;
      if (focused !== null && isSelectable(focused)) {
        capture(focused);
      } else {
        lastError = { code: "TARGET_NOT_SELECTABLE", recoverable: true };
        emit();
        announceError(lastError);
      }
      return;
    }
    if (selectionMode === "inactive" && matchesShortcut(event, shortcuts.temporarySelection)) {
      setSelectionMode("temporary");
    }
  }

  function onKeyUp(event: KeyboardEvent): void {
    if (selectionMode === "temporary" && releasesHold(event, shortcuts.temporarySelection)) {
      setSelectionMode("inactive");
    }
  }

  /** Losing focus or visibility always falls back to inactive, and never re-arms. */
  function failSafe(): void {
    pointer?.cancel();
    setSelectionMode("inactive");
  }

  function onVisibilityChange(): void {
    if (doc.visibilityState === "hidden") {
      failSafe();
    }
  }

  function installGlobalListeners(view: Window): void {
    view.addEventListener("keydown", onKeyDown as EventListener, true);
    view.addEventListener("keyup", onKeyUp as EventListener, true);
    view.addEventListener("blur", failSafe);
    doc.addEventListener("visibilitychange", onVisibilityChange);
  }

  function removeGlobalListeners(view: Window): void {
    view.removeEventListener("keydown", onKeyDown as EventListener, true);
    view.removeEventListener("keyup", onKeyUp as EventListener, true);
    view.removeEventListener("blur", failSafe);
    doc.removeEventListener("visibilitychange", onVisibilityChange);
  }

  function copyErrorFor(error: unknown): CopyError {
    if (error instanceof ClipboardWriteError && error.reason === "denied") {
      return { code: "CLIPBOARD_DENIED", recoverable: true };
    }
    return { code: "CLIPBOARD_UNAVAILABLE", recoverable: true };
  }

  /**
   * Single-flight copy.
   *
   * The command snapshots session, format and count immediately, so a capture
   * arriving while the promise is pending cannot change what was copied.
   */
  async function runCopy(format: OutputFormat, text: string, count: number): Promise<CopyResult> {
    const token = ++copyToken;
    copyState = "pending";
    emit();

    const view = doc.defaultView;
    let timer: ReturnType<Window["setTimeout"]> | undefined;
    const expiry = new Promise<"timeout">((resolve) => {
      timer = view?.setTimeout(() => {
        resolve("timeout");
      }, COPY_TIMEOUT_MS);
    });

    const attempt = clipboard.write(text).then(
      () => "written" as const,
      (error: unknown) => copyErrorFor(error),
    );

    const outcome = await Promise.race([attempt, expiry]);
    if (timer !== undefined) {
      view?.clearTimeout(timer);
    }

    // A newer command, a timeout or destroy already settled this one.
    if (token !== copyToken) {
      return { ok: false, error: { code: "COPY_TIMEOUT", recoverable: true } };
    }
    copyToken += 1;
    copyState = "idle";

    if (outcome === "timeout") {
      lastError = { code: "COPY_TIMEOUT", recoverable: true };
      emit();
      return { ok: false, error: lastError };
    }
    if (outcome !== "written") {
      lastError = outcome;
      emit();
      return { ok: false, error: outcome };
    }

    lastError = undefined;
    emit();
    return { ok: true, format, targetCount: count };
  }

  function teardown(): void {
    const view = doc.defaultView;
    if (view !== null) {
      removeGlobalListeners(view);
    }
    pointer?.dispose();
    pointer = undefined;
    panel?.destroy();
    panel = undefined;
    overlay = undefined;
    surface?.destroy();
    surface = undefined;
    extractor = undefined;
    selectionMode = "inactive";
  }

  const controller: UiTargetPickerController = {
    enable() {
      if (lifecycle === "destroyed") {
        return DESTROYED;
      }
      if (lifecycle === "enabled") {
        return OK;
      }
      const view = doc.defaultView;
      if (view === null) {
        return OK;
      }
      surface = createPickerSurface(doc);
      overlay = createOverlay(doc, surface.shadow);
      if (options.panel !== false) {
        panel = createPanel(doc, surface.shadow, view, {
          copy: () => {
            void controller.copy();
          },
          setFormat: (format) => {
            controller.setOutputFormat(format);
          },
          remove: (index) => {
            controller.removeTarget(index);
          },
          clear: () => {
            controller.clearSession();
          },
          undo: () => {
            controller.undo();
          },
        });
      }
      extractor = undefined;
      pointer = installPointer(view, surface.root);
      installGlobalListeners(view);
      lifecycle = "enabled";
      emit();
      panel?.render(state, session.getSession());
      return OK;
    },

    disable() {
      if (lifecycle === "destroyed") {
        return DESTROYED;
      }
      if (lifecycle !== "enabled") {
        return OK;
      }
      teardown();
      lifecycle = "disabled";
      emit();
      return OK;
    },

    destroy() {
      if (lifecycle === "destroyed") {
        return DESTROYED;
      }
      teardown();
      session.clear();
      // A copy still in flight must not report into a destroyed controller.
      copyToken += 1;
      copyState = "idle";
      lifecycle = "destroyed";
      lastError = undefined;
      state = buildState();
      listeners = [];
      return OK;
    },

    getState() {
      return state;
    },

    getSession() {
      return lifecycle === "destroyed" ? createEmptySession() : session.getSession();
    },

    setOutputFormat(format) {
      if (lifecycle === "destroyed") {
        return DESTROYED;
      }
      if (!OUTPUT_FORMATS.includes(format)) {
        throw new Error(`format must be one of ${OUTPUT_FORMATS.join(", ")}`);
      }
      // Changing the format never touches the captured targets.
      outputFormat = format;
      emit();
      return OK;
    },

    removeTarget(index) {
      if (lifecycle === "destroyed") {
        return DESTROYED;
      }
      const removed = session.removeAt(index);
      if (removed === undefined) {
        return OK;
      }
      emit();
      // The removed control no longer exists: focus must land somewhere useful.
      panel?.focusAfterRemoval(index);
      announce(targetRemoved());
      return OK;
    },

    clearSession() {
      if (lifecycle === "destroyed") {
        return DESTROYED;
      }
      const removedCount = session.clear();
      if (removedCount === 0) {
        return OK;
      }
      emit();
      panel?.focusEmptyTitle();
      announce(sessionCleared(removedCount));
      return OK;
    },

    undo() {
      if (lifecycle === "destroyed") {
        return DESTROYED;
      }
      if (!session.undo()) {
        return OK;
      }
      // Undo leaves focus where it is unless the user moved it explicitly.
      emit();
      announce(undone());
      return OK;
    },

    resetPanelPosition() {
      if (lifecycle === "destroyed") {
        return DESTROYED;
      }
      panel?.resetPosition();
      announce(POSITION_RESET);
      return OK;
    },

    async copy(format) {
      if (lifecycle === "destroyed") {
        return { ok: false, error: { code: "CONTROLLER_DESTROYED", recoverable: false } };
      }
      if (copyState === "pending") {
        return { ok: false, error: { code: "COPY_IN_PROGRESS", recoverable: true } };
      }

      const chosen = format ?? outputFormat;
      if (!OUTPUT_FORMATS.includes(chosen)) {
        throw new Error(`format must be one of ${OUTPUT_FORMATS.join(", ")}`);
      }

      const snapshot = session.getSession();
      const targetCount = snapshot.targets.length;
      if (targetCount === 0) {
        // An empty session must not overwrite whatever the user already has.
        return { ok: true, format: chosen, targetCount: 0 };
      }

      const result = await runCopy(chosen, formatSession(snapshot, chosen), targetCount);
      if (result.ok) {
        announce(copySucceeded(result.targetCount, result.format));
      } else {
        announceError(result.error);
      }
      return result;
    },

    subscribe(listener) {
      if (lifecycle === "destroyed") {
        return () => undefined;
      }
      listeners.push(listener);
      let active = true;
      return () => {
        if (!active) {
          return;
        }
        active = false;
        listeners = listeners.filter((entry) => entry !== listener);
      };
    },
  };

  return controller;
}
