import type { OutputFormat, UiTargetSessionV1, UiTargetV1 } from "@ui-target-picker/core";

import type { UiTargetPickerState } from "../controller-types.js";
import {
  EMPTY_HINT,
  EMPTY_TITLE,
  FORMAT_LABELS,
  REDACTED_NOTE,
  SELECTION_LABELS,
} from "./messages.js";
import {
  clampPosition,
  createPositionStore,
  PANEL_MARGIN,
  PANEL_WIDTH,
  type PanelPosition,
} from "./position.js";

/** Pointer travel before a press on the header becomes a drag. */
const DRAG_THRESHOLD = 4;
const ARROW_STEP = 8;
const ARROW_STEP_LARGE = 32;

export interface PanelHandlers {
  copy(): void;
  setFormat(format: OutputFormat): void;
  remove(index: number): void;
  clear(): void;
  undo(): void;
}

export interface Panel {
  readonly element: HTMLElement;
  render(state: Readonly<UiTargetPickerState>, session: UiTargetSessionV1): void;
  /** Polite update; `alert` is reserved for errors that need intervention. */
  announce(message: string, tone?: "status" | "alert"): void;
  /**
   * Move focus after a mutation removed the control that had it.
   *
   * Same control in the next card, otherwise the previous one, otherwise the
   * focusable empty title.
   */
  focusAfterRemoval(removedIndex: number): void;
  focusEmptyTitle(): void;
  resetPosition(): void;
  destroy(): void;
}

function element<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (className !== undefined) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function button(doc: Document, className: string, text: string): HTMLButtonElement {
  const node = element(doc, "button", className, text);
  node.type = "button";
  return node;
}

/** Innermost component name, or the element signature when there is none. */
function summarise(target: UiTargetV1): string {
  return target.component?.name ?? target.element.signature;
}

function describeRoute(target: UiTargetV1): string {
  return `${target.location.pathname}${target.location.search ?? ""}${target.location.hash ?? ""}`;
}

function detailRows(target: UiTargetV1): readonly (readonly [string, string])[] {
  const rows: (readonly [string, string])[] = [["rotta", describeRoute(target)]];
  const ancestry = target.component?.ancestry;

  if (ancestry !== undefined && ancestry.length > 0) {
    rows.push(["componenti", ancestry.join(" > ")]);
  }
  if (target.component?.selector !== undefined) {
    rows.push(["selettore", target.component.selector]);
  }
  rows.push(["elemento", target.element.signature]);
  if (target.element.domPath !== undefined) {
    rows.push(["percorso DOM", target.element.domPath]);
  }
  if (target.semantics?.role !== undefined) {
    rows.push(["ruolo", target.semantics.role]);
  }
  const states = target.semantics?.states;
  if (states !== undefined && states.length > 0) {
    rows.push([
      "stato",
      states
        .map((state) =>
          state.value === true ? state.name : `${state.name}="${String(state.value)}"`,
        )
        .join(", "),
    ]);
  }
  if (target.content?.text !== undefined) {
    rows.push(["testo", target.content.text]);
  }
  const references = target.content?.references;
  if (references !== undefined && references.length > 0) {
    rows.push([
      "riferimenti",
      references.map((reference) => `${reference.name}="${String(reference.value)}"`).join(", "),
    ]);
  }
  if (target.geometry !== undefined) {
    const { width, height, x, y } = target.geometry;
    rows.push(["box", `${String(width)}x${String(height)} px @ x:${String(x)}, y:${String(y)}`]);
  }
  return rows;
}

/**
 * Floating panel.
 *
 * It lives in the picker's shadow root, so the host cascade cannot reach it and
 * the picker never captures its own controls.
 */
export function createPanel(
  doc: Document,
  shadow: ShadowRoot,
  view: Window,
  handlers: PanelHandlers,
): Panel {
  const store = createPositionStore(view);

  const panel = element(doc, "section", "panel");
  panel.setAttribute("role", "complementary");
  panel.setAttribute("aria-label", "UI Target Picker");

  const header = element(doc, "header", "header");
  header.tabIndex = 0;
  header.setAttribute("aria-label", "UI Target Picker, trascina o usa le frecce per spostare");
  const title = element(doc, "span", "header__title", "UI Target Picker");
  const status = element(doc, "span", "header__status", SELECTION_LABELS.inactive);
  const count = element(doc, "span", "header__count", "0/20");
  const collapse = button(doc, "icon-button", "−");
  collapse.setAttribute("aria-expanded", "true");
  collapse.setAttribute("aria-label", "Riduci il pannello");
  header.append(title, status, count, collapse);

  const body = element(doc, "div", "body");

  const copyButton = button(doc, "cta", "Copia tutto");
  const formats = element(doc, "div", "formats");
  formats.setAttribute("role", "radiogroup");
  formats.setAttribute("aria-label", "Formato dell'output");
  const formatButtons = new Map<OutputFormat, HTMLButtonElement>();
  for (const format of ["text", "json"] as const) {
    const control = button(doc, "", FORMAT_LABELS[format]);
    control.setAttribute("role", "radio");
    control.setAttribute("aria-checked", String(format === "text"));
    control.addEventListener("click", () => {
      handlers.setFormat(format);
    });
    formatButtons.set(format, control);
    formats.append(control);
  }
  const primary = element(doc, "div", "primary");
  primary.append(copyButton, formats);

  const emptyTitle = element(doc, "h2", "empty", EMPTY_TITLE);
  emptyTitle.tabIndex = -1;
  const hint = element(doc, "p", "hint", EMPTY_HINT);
  const list = element(doc, "ol", "list");

  const clearButton = button(doc, "", "Svuota sessione");
  const undoButton = button(doc, "", "Annulla");
  const resetButton = button(doc, "", "Ripristina posizione");
  const secondary = element(doc, "div", "secondary");
  secondary.append(clearButton, undoButton, resetButton);

  const feedback = element(doc, "p", "feedback");
  feedback.setAttribute("role", "status");
  feedback.setAttribute("aria-live", "polite");
  feedback.setAttribute("aria-atomic", "true");
  const alert = element(doc, "p", "alert");
  alert.setAttribute("role", "alert");

  body.append(primary, emptyTitle, hint, list, secondary, feedback, alert);
  panel.append(header, body);
  shadow.append(panel);

  let position: PanelPosition | undefined;
  let expanded = new Set<number>();
  let renderedSession: UiTargetSessionV1 | undefined;
  let lastAnnouncement = "";

  function viewportSize(): { width: number; height: number } {
    return { width: view.innerWidth, height: view.innerHeight };
  }

  function panelSize(): { width: number; height: number } {
    const rect = panel.getBoundingClientRect();
    // Before the shadow stylesheet applies, the panel measures as a plain block
    // as wide as the host. The declared width is the reliable value.
    return { width: PANEL_WIDTH, height: rect.height };
  }

  /**
   * Place the panel.
   *
   * `undefined` means the default corner, which CSS anchors with `right` and
   * `bottom`. Measuring at mount time is unreliable, because the panel is
   * positioned before the first layout, so the default measures nothing at all.
   */
  function applyPosition(next: PanelPosition | undefined): void {
    if (next === undefined) {
      position = undefined;
      panel.style.left = "";
      panel.style.top = "";
      panel.style.right = `${String(PANEL_MARGIN)}px`;
      panel.style.bottom = `${String(PANEL_MARGIN)}px`;
      return;
    }
    position = clampPosition(next, panelSize(), viewportSize());
    panel.style.right = "";
    panel.style.bottom = "";
    panel.style.left = `${String(position.x)}px`;
    panel.style.top = `${String(position.y)}px`;
  }

  /** Where the panel is right now, measured only when it has to be. */
  function currentPosition(): PanelPosition {
    if (position !== undefined) {
      return position;
    }
    const rect = panel.getBoundingClientRect();
    return { x: rect.left, y: rect.top };
  }

  applyPosition(store.read());

  function onResize(): void {
    if (position !== undefined) {
      applyPosition(position);
    }
  }
  view.addEventListener("resize", onResize);

  let dragOrigin: { pointerId: number; x: number; y: number; start: PanelPosition } | undefined;
  let dragging = false;

  header.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target === collapse) {
      return;
    }
    dragOrigin = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      start: currentPosition(),
    };
    dragging = false;
    header.setPointerCapture(event.pointerId);
  });

  header.addEventListener("pointermove", (event) => {
    if (dragOrigin === undefined || event.pointerId !== dragOrigin.pointerId) {
      return;
    }
    const deltaX = event.clientX - dragOrigin.x;
    const deltaY = event.clientY - dragOrigin.y;
    if (!dragging && Math.abs(deltaX) + Math.abs(deltaY) < DRAG_THRESHOLD) {
      // A short press on the header is not a drag.
      return;
    }
    dragging = true;
    applyPosition({ x: dragOrigin.start.x + deltaX, y: dragOrigin.start.y + deltaY });
  });

  function endDrag(event: PointerEvent): void {
    if (dragOrigin === undefined || event.pointerId !== dragOrigin.pointerId) {
      return;
    }
    if (dragging && position !== undefined) {
      store.write(position);
    }
    dragOrigin = undefined;
    dragging = false;
  }
  header.addEventListener("pointerup", endDrag);
  header.addEventListener("pointercancel", endDrag);

  const ARROWS: Record<string, readonly [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };

  header.addEventListener("keydown", (event) => {
    const direction = ARROWS[event.key];
    if (direction === undefined) {
      return;
    }
    // Dragging must never be the only way to place the panel.
    event.preventDefault();
    const step = event.shiftKey ? ARROW_STEP_LARGE : ARROW_STEP;
    const current = currentPosition();
    const next = { x: current.x + direction[0] * step, y: current.y + direction[1] * step };
    applyPosition(next);
    store.write(next);
  });

  collapse.addEventListener("click", () => {
    const nowExpanded = collapse.getAttribute("aria-expanded") !== "true";
    collapse.setAttribute("aria-expanded", String(nowExpanded));
    collapse.setAttribute("aria-label", nowExpanded ? "Riduci il pannello" : "Espandi il pannello");
    collapse.textContent = nowExpanded ? "−" : "+";
    body.hidden = !nowExpanded;
    // Focus stays on the toggle that caused the change.
    collapse.focus();
    if (position !== undefined) {
      applyPosition(position);
    }
  });

  copyButton.addEventListener("click", () => {
    handlers.copy();
  });
  clearButton.addEventListener("click", () => {
    handlers.clear();
  });
  undoButton.addEventListener("click", () => {
    handlers.undo();
  });
  resetButton.addEventListener("click", () => {
    store.clear();
    applyPosition(undefined);
  });

  function buildCard(target: UiTargetV1, index: number): HTMLLIElement {
    const card = element(doc, "li", "card");
    const row = element(doc, "div", "card__row");
    const name = summarise(target);
    const isExpanded = expanded.has(index);

    const toggle = button(doc, "card__toggle", "");
    toggle.setAttribute("aria-expanded", String(isExpanded));
    toggle.append(
      element(doc, "span", "card__index", String(index + 1)),
      element(doc, "span", "card__name", name),
    );
    toggle.setAttribute("aria-label", `Target ${String(index + 1)}: ${name}`);
    toggle.addEventListener("click", () => {
      if (expanded.has(index)) {
        expanded.delete(index);
      } else {
        expanded.add(index);
      }
      renderList(renderedSession?.targets ?? []);
      const restored = list.querySelectorAll<HTMLButtonElement>(".card__toggle")[index];
      restored?.focus();
    });

    const remove = button(doc, "card__remove", "✕");
    remove.setAttribute("aria-label", `Rimuovi il target ${String(index + 1)}: ${name}`);
    remove.addEventListener("click", () => {
      handlers.remove(index);
    });

    row.append(toggle, remove);
    card.append(row);

    const metaParts = [describeRoute(target)];
    if (target.content?.text !== undefined) {
      metaParts.push(`"${target.content.text}"`);
    }
    card.append(element(doc, "p", "card__meta", metaParts.join(" · ")));

    if (target.redactions !== undefined && target.redactions.length > 0) {
      card.append(element(doc, "p", "card__meta", REDACTED_NOTE));
    }

    if (isExpanded) {
      const detail = element(doc, "dl", "card__detail");
      for (const [label, value] of detailRows(target)) {
        detail.append(element(doc, "dt", "", label), element(doc, "dd", "", value));
      }
      card.append(detail);
    }

    return card;
  }

  function renderList(targets: readonly UiTargetV1[]): void {
    list.replaceChildren(...targets.map((target, index) => buildCard(target, index)));
    const isEmpty = targets.length === 0;
    list.hidden = isEmpty;
    emptyTitle.hidden = !isEmpty;
    hint.hidden = !isEmpty;
  }

  return {
    element: panel,

    render(state, session) {
      status.textContent = SELECTION_LABELS[state.selectionMode];
      count.textContent = `${String(state.targetCount)}/${String(state.maxTargets)}`;
      copyButton.disabled = state.copyState === "pending" || state.targetCount === 0;
      clearButton.disabled = state.targetCount === 0;
      undoButton.hidden = !state.canUndo;

      for (const [format, control] of formatButtons) {
        control.setAttribute("aria-checked", String(format === state.outputFormat));
      }

      if (session !== renderedSession) {
        expanded = new Set([...expanded].filter((index) => index < session.targets.length));
        renderedSession = session;
        renderList(session.targets);
      }
    },

    focusAfterRemoval(removedIndex) {
      const remaining = renderedSession?.targets.length ?? 0;
      if (remaining === 0) {
        emptyTitle.focus();
        return;
      }
      const controls = list.querySelectorAll<HTMLButtonElement>(".card__remove");
      const control = controls[Math.min(removedIndex, remaining - 1)];
      if (control === undefined) {
        emptyTitle.focus();
        return;
      }
      control.focus();
    },

    focusEmptyTitle() {
      emptyTitle.focus();
    },

    announce(message, tone = "status") {
      const region = tone === "alert" ? alert : feedback;
      const other = tone === "alert" ? feedback : alert;
      other.textContent = "";
      if (message === lastAnnouncement) {
        // Repeating the same text would not be announced anyway.
        region.textContent = "";
      }
      region.textContent = message;
      lastAnnouncement = message;
    },

    resetPosition() {
      store.clear();
      applyPosition(undefined);
    },

    destroy() {
      view.removeEventListener("resize", onResize);
      panel.remove();
    },
  };
}
