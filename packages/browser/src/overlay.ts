import { PICKER_Z_INDEX } from "./pointer.js";

/**
 * Overlay styles.
 *
 * Everything lives in an open shadow root so the host application's cascade
 * cannot reach it and the picker cannot leak styles into the application. The
 * root is inert to the pointer: it must never intercept a click.
 */
const STYLES = `
:host {
  all: initial;
  position: fixed;
  inset: 0;
  display: block;
  pointer-events: none;
  z-index: ${String(PICKER_Z_INDEX)};
  contain: layout style;
}

.box {
  position: absolute;
  box-sizing: border-box;
  border: 2px solid #2563eb;
  background: rgba(37, 99, 235, 0.12);
  border-radius: 2px;
  transition:
    top 150ms ease-out,
    left 150ms ease-out,
    width 150ms ease-out,
    height 150ms ease-out;
}

.label {
  position: absolute;
  box-sizing: border-box;
  max-width: 40ch;
  overflow: hidden;
  padding: 2px 6px;
  border-radius: 3px;
  background: #0b1220;
  color: #ffffff;
  font:
    12px/1.4 system-ui,
    "Segoe UI",
    sans-serif;
  white-space: nowrap;
  text-overflow: ellipsis;
}

@media (prefers-reduced-motion: reduce) {
  .box {
    transition: none;
  }
}

@media (forced-colors: active) {
  .box {
    border-color: Highlight;
    background: transparent;
  }

  .label {
    background: Canvas;
    color: CanvasText;
    border: 1px solid CanvasText;
    forced-color-adjust: none;
  }
}
`;

/** Distance between the highlight box and its label, in CSS pixels. */
const LABEL_GAP = 4;
const LABEL_HEIGHT = 20;

export interface Overlay {
  /** Root of the picker UI: excluded from selection and never read. */
  readonly root: Element;
  show(element: Element, label: string): void;
  hide(): void;
  destroy(): void;
}

/**
 * Create the highlight overlay.
 *
 * Position comes from `getBoundingClientRect`, so the box uses viewport
 * coordinates and needs no scroll compensation.
 */
export function createOverlay(doc: Document): Overlay {
  const host = doc.createElement("div");
  host.setAttribute("data-ui-target-picker", "overlay");
  host.setAttribute("aria-hidden", "true");

  const shadow = host.attachShadow({ mode: "open" });
  const style = doc.createElement("style");
  style.textContent = STYLES;

  const box = doc.createElement("div");
  box.className = "box";
  const label = doc.createElement("div");
  label.className = "label";

  shadow.append(style, box, label);
  doc.body.append(host);

  let visible = false;

  function setVisible(next: boolean): void {
    if (visible === next) {
      return;
    }
    visible = next;
    box.hidden = !next;
    label.hidden = !next;
  }

  setVisible(false);

  return {
    root: host,

    show(element, text) {
      const rect = element.getBoundingClientRect();
      box.style.top = `${String(rect.top)}px`;
      box.style.left = `${String(rect.left)}px`;
      box.style.width = `${String(rect.width)}px`;
      box.style.height = `${String(rect.height)}px`;

      label.textContent = text;
      const above = rect.top >= LABEL_HEIGHT + LABEL_GAP;
      label.style.top = `${String(above ? rect.top - LABEL_HEIGHT - LABEL_GAP : rect.bottom + LABEL_GAP)}px`;
      label.style.left = `${String(Math.max(0, rect.left))}px`;

      setVisible(true);
    },

    hide() {
      setVisible(false);
    },

    destroy() {
      host.remove();
    },
  };
}
