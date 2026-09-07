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
import { ClipboardWriteError, createClipboardWriter, type ClipboardWriter } from "./clipboard.js";
import { createTargetExtractor, type TargetExtractor } from "./extract/index.js";
import { readTag, significantClasses } from "./extract/element.js";
import { createOverlay, type Overlay } from "./overlay.js";
import { installPointerCapture, type PointerCapture } from "./pointer.js";
import type { ComponentResolver } from "./resolver.js";
import {
  EXIT_SELECTION_CODE,
  isComposing,
  isEditableEventSource,
  matchesShortcut,
  releasesHold,
  resolveShortcuts,
  type UiTargetPickerShortcuts,
} from "./shortcuts.js";

export type Lifecycle = "created" | "enabled" | "disabled" | "destroyed";
export type SelectionMode = "inactive" | "temporary" | "continuous";
export type CopyState = "idle" | "pending";

export interface UiTargetPickerState {
  readonly lifecycle: Lifecycle;
  readonly selectionMode: SelectionMode;
  readonly copyState: CopyState;
  readonly targetCount: number;
  readonly maxTargets: number;
  readonly outputFormat: OutputFormat;
  readonly lastError?: PickerError;
}

export type ControllerDestroyedError = {
  readonly code: "CONTROLLER_DESTROYED";
  readonly recoverable: false;
};

export type LifecycleResult =
  { readonly ok: true } | { readonly ok: false; readonly error: ControllerDestroyedError };

export type CopyResult =
  | { readonly ok: true; readonly format: OutputFormat; readonly targetCount: number }
  | { readonly ok: false; readonly error: CopyError };

export type StateListener = (state: Readonly<UiTargetPickerState>) => void;
export type Unsubscribe = () => void;

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
      ...(overlay === undefined ? {} : { pickerRoot: overlay.root }),
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
  let overlay: Overlay | undefined;
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
      next.outputFormat === state.outputFormat &&
      next.lastError === state.lastError
    ) {
      return;
    }
    state = next;
    for (const listener of [...listeners]) {
      listener(state);
    }
  }

  function isSelectable(element: Element): boolean {
    return isSelectableTarget(element, {
      document: doc,
      ...(overlay === undefined ? {} : { pickerRoot: overlay.root }),
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
      return;
    }

    const added = session.add(extraction.value);
    lastError = added.ok ? extraction.warnings[0] : added.error;
    emit();
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
    if (event.code === EXIT_SELECTION_CODE && selectionMode !== "inactive") {
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
    overlay?.destroy();
    overlay = undefined;
    extractor = undefined;
    selectionMode = "inactive";
  }

  return {
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
      overlay = createOverlay(doc);
      extractor = undefined;
      pointer = installPointer(view, overlay.root);
      installGlobalListeners(view);
      lifecycle = "enabled";
      emit();
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

      return runCopy(chosen, formatSession(snapshot, chosen), targetCount);
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
}
