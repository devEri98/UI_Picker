import { isPickerNode } from "./boundaries.js";

/** Above every realistic application overlay, including the Angular CDK. */
export const PICKER_Z_INDEX = 2147483000;

export interface PointerCaptureHandlers {
  /**
   * Whether the picker is currently armed.
   *
   * The machine stays installed while disarmed so that a sequence started in
   * selection mode can still swallow its trailing click.
   */
  isArmed(): boolean;
  /** Whether the element may become a target at all. */
  isSelectable(element: Element): boolean;
  /** Hover feedback; `null` clears it. */
  onHover(element: Element | null): void;
  /** Fired once per completed pointer sequence. */
  onCapture(element: Element): void;
}

export interface PointerCapture {
  /** Abort the sequence in flight without capturing. */
  cancel(): void;
  dispose(): void;
}

interface PendingSequence {
  readonly pointerId: number;
  readonly target: Element;
}

/** Mouse events the browser may synthesise for the same pointer sequence. */
const COMPATIBILITY_EVENTS = ["mousedown", "mouseup", "dblclick", "auxclick", "contextmenu"];

function suppress(event: Event): void {
  event.preventDefault();
  event.stopImmediatePropagation();
}

/**
 * Install the capture-phase pointer state machine.
 *
 * Suppression always precedes extraction and stays valid even if extraction
 * fails, so a captured click never reaches the application. The contract cannot
 * undo a global capture listener the application registered on `window` before
 * the picker was enabled: that is a declared limit of a development-only
 * integration.
 */
export function installPointerCapture(
  view: Window,
  pickerRoot: Node | undefined,
  handlers: PointerCaptureHandlers,
): PointerCapture {
  let pending: PendingSequence | undefined;
  let swallowNextClick = false;

  function targetOf(event: Event): Element | undefined {
    for (const entry of event.composedPath()) {
      if (typeof entry !== "object" || entry === null || !("nodeType" in entry)) {
        continue;
      }
      const node = entry as Node;
      if (node.nodeType !== 1) {
        continue;
      }
      const element = node as Element;
      // The picker's own UI is never a target, and an event that starts there
      // belongs to the picker: it is left alone instead of being retargeted to
      // whatever sits behind it.
      return isPickerNode(element, pickerRoot) ? undefined : element;
    }
    return undefined;
  }

  function validTargetOf(event: Event): Element | undefined {
    const element = targetOf(event);
    return element !== undefined && handlers.isSelectable(element) ? element : undefined;
  }

  function clearPending(): void {
    if (pending !== undefined) {
      pending = undefined;
      swallowNextClick = true;
    }
  }

  function onPointerDown(event: PointerEvent): void {
    if (!handlers.isArmed() || !event.isPrimary || event.button !== 0) {
      return;
    }
    const target = validTargetOf(event);
    if (target === undefined) {
      // Not our target: leave the application's own sequence alone.
      return;
    }
    suppress(event);
    pending = { pointerId: event.pointerId, target };
  }

  function onPointerUp(event: PointerEvent): void {
    if (pending === undefined || event.pointerId !== pending.pointerId) {
      return;
    }
    suppress(event);
    const { target } = pending;
    pending = undefined;
    swallowNextClick = true;

    if (validTargetOf(event) === target) {
      handlers.onCapture(target);
    }
  }

  function onPointerCancel(event: PointerEvent): void {
    if (pending === undefined || event.pointerId !== pending.pointerId) {
      return;
    }
    suppress(event);
    clearPending();
  }

  function onPointerMove(event: PointerEvent): void {
    if (!handlers.isArmed()) {
      return;
    }
    handlers.onHover(validTargetOf(event) ?? null);
  }

  function onClick(event: MouseEvent): void {
    if (!swallowNextClick && pending === undefined) {
      return;
    }
    suppress(event);
    swallowNextClick = false;
  }

  function onCompatibilityEvent(event: Event): void {
    if (pending === undefined && !swallowNextClick) {
      return;
    }
    suppress(event);
  }

  const listenerOptions = { capture: true } as const;
  view.addEventListener("pointerdown", onPointerDown as EventListener, listenerOptions);
  view.addEventListener("pointerup", onPointerUp as EventListener, listenerOptions);
  view.addEventListener("pointercancel", onPointerCancel as EventListener, listenerOptions);
  view.addEventListener("pointermove", onPointerMove as EventListener, listenerOptions);
  view.addEventListener("click", onClick as EventListener, listenerOptions);
  for (const type of COMPATIBILITY_EVENTS) {
    view.addEventListener(type, onCompatibilityEvent, listenerOptions);
  }

  return {
    cancel() {
      pending = undefined;
      swallowNextClick = false;
      handlers.onHover(null);
    },

    dispose() {
      view.removeEventListener("pointerdown", onPointerDown as EventListener, listenerOptions);
      view.removeEventListener("pointerup", onPointerUp as EventListener, listenerOptions);
      view.removeEventListener("pointercancel", onPointerCancel as EventListener, listenerOptions);
      view.removeEventListener("pointermove", onPointerMove as EventListener, listenerOptions);
      view.removeEventListener("click", onClick as EventListener, listenerOptions);
      for (const type of COMPATIBILITY_EVENTS) {
        view.removeEventListener(type, onCompatibilityEvent, listenerOptions);
      }
      pending = undefined;
      swallowNextClick = false;
    },
  };
}
