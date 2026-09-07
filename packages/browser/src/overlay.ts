/** Distance between the highlight box and its label, in CSS pixels. */
const LABEL_GAP = 4;
const LABEL_HEIGHT = 20;

export interface Overlay {
  show(element: Element, label: string): void;
  hide(): void;
}

/**
 * Highlight for the element under the pointer.
 *
 * Position comes from `getBoundingClientRect`, so the box uses viewport
 * coordinates and needs no scroll compensation.
 */
export function createOverlay(doc: Document, shadow: ShadowRoot): Overlay {
  const box = doc.createElement("div");
  box.className = "overlay-box";
  const label = doc.createElement("div");
  label.className = "overlay-label";
  box.hidden = true;
  label.hidden = true;
  shadow.append(box, label);

  return {
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

      box.hidden = false;
      label.hidden = false;
    },

    hide() {
      box.hidden = true;
      label.hidden = true;
    },
  };
}
