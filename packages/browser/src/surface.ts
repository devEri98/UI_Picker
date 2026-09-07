import { PANEL_MARGIN, PANEL_WIDTH } from "./panel/position.js";

/** Above every realistic application overlay, including the Angular CDK. */
export const PICKER_Z_INDEX = 2147483000;

/**
 * Styles for the whole picker UI.
 *
 * The surface is an open shadow root, so the host application's cascade cannot
 * reach it and the picker cannot leak styles out. Nothing is inherited on
 * purpose: every value is declared here, with system fonts only and no remote
 * resource.
 */
const STYLES = `
:host {
  all: initial;
  position: fixed;
  inset: 0;
  display: block;
  pointer-events: none;
  z-index: ${String(PICKER_Z_INDEX)};

  --utp-surface: #ffffff;
  --utp-surface-raised: #f4f5f7;
  --utp-border: #c4c9d2;
  --utp-text: #14161a;
  --utp-text-muted: #545b66;
  --utp-accent: #1d4ed8;
  --utp-accent-text: #ffffff;
  --utp-danger: #a4231b;
  --utp-shadow: 0 6px 20px rgba(15, 18, 25, 0.22);
  --utp-radius: 8px;
  --utp-font:
    13px/1.45 system-ui, "Segoe UI", -apple-system, sans-serif;
  --utp-mono:
    12px/1.5 ui-monospace, "Cascadia Mono", Consolas, monospace;
}

@media (prefers-color-scheme: dark) {
  :host {
    --utp-surface: #1b1e24;
    --utp-surface-raised: #262a32;
    --utp-border: #454b57;
    --utp-text: #f1f3f6;
    --utp-text-muted: #aab1bd;
    --utp-accent: #7aa2ff;
    --utp-accent-text: #12151b;
    --utp-danger: #ff9c94;
    --utp-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
  }
}

.overlay-box {
  position: absolute;
  box-sizing: border-box;
  border: 2px solid var(--utp-accent);
  background: rgba(29, 78, 216, 0.12);
  border-radius: 2px;
  transition:
    top 150ms ease-out,
    left 150ms ease-out,
    width 150ms ease-out,
    height 150ms ease-out;
}

.overlay-label {
  position: absolute;
  box-sizing: border-box;
  max-width: 40ch;
  overflow: hidden;
  padding: 2px 6px;
  border-radius: 3px;
  background: var(--utp-accent);
  color: var(--utp-accent-text);
  font: var(--utp-font);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.panel {
  position: absolute;
  /* Default corner. Overridden with left/top once the panel is moved. */
  right: ${String(PANEL_MARGIN)}px;
  bottom: ${String(PANEL_MARGIN)}px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: ${String(PANEL_WIDTH)}px;
  max-width: calc(100vw - 24px);
  max-height: calc(100vh - 24px);
  pointer-events: auto;
  border: 1px solid var(--utp-border);
  border-radius: var(--utp-radius);
  background: var(--utp-surface);
  color: var(--utp-text);
  font: var(--utp-font);
  box-shadow: var(--utp-shadow);
}

.panel *,
.panel *::before,
.panel *::after {
  box-sizing: border-box;
}

.panel :focus-visible {
  outline: 2px solid var(--utp-accent);
  outline-offset: 2px;
}

.header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 6px 6px 10px;
  border-bottom: 1px solid var(--utp-border);
  border-radius: var(--utp-radius) var(--utp-radius) 0 0;
  background: var(--utp-surface-raised);
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.header:active {
  cursor: grabbing;
}

.header__title {
  font-weight: 600;
  white-space: nowrap;
}

.header__status {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--utp-text-muted);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.header__count {
  font-variant-numeric: tabular-nums;
  color: var(--utp-text-muted);
}

.body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  overflow: hidden;
}

.primary {
  display: flex;
  gap: 8px;
  align-items: center;
}

.formats {
  display: flex;
  border: 1px solid var(--utp-border);
  border-radius: 6px;
  overflow: hidden;
}

button {
  min-height: 32px;
  padding: 4px 10px;
  border: 1px solid var(--utp-border);
  border-radius: 6px;
  background: var(--utp-surface);
  color: var(--utp-text);
  font: inherit;
  cursor: pointer;
}

button[aria-checked="true"] {
  background: var(--utp-accent);
  color: var(--utp-accent-text);
}

.formats button {
  min-width: 56px;
  border: 0;
  border-radius: 0;
}

.formats button + button {
  border-left: 1px solid var(--utp-border);
}

.cta {
  flex: 1;
  border-color: var(--utp-accent);
  background: var(--utp-accent);
  color: var(--utp-accent-text);
  font-weight: 600;
}

button[disabled] {
  opacity: 0.55;
  cursor: not-allowed;
}

.icon-button {
  min-width: 32px;
  padding: 4px 8px;
  font: var(--utp-mono);
}

.empty {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.hint,
.feedback,
.alert {
  margin: 0;
  color: var(--utp-text-muted);
}

.alert:not(:empty) {
  color: var(--utp-danger);
  font-weight: 600;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.card {
  border: 1px solid var(--utp-border);
  border-radius: 6px;
  background: var(--utp-surface-raised);
}

.card__row {
  display: flex;
  align-items: stretch;
  gap: 4px;
}

.card__toggle {
  flex: 1;
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
  border: 0;
  border-radius: 6px 0 0 6px;
  background: transparent;
  text-align: left;
}

.card__index {
  flex: none;
  min-width: 20px;
  font-variant-numeric: tabular-nums;
  color: var(--utp-text-muted);
}

.card__name {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.card__remove {
  flex: none;
  border: 0;
  border-radius: 0 6px 6px 0;
  background: transparent;
  color: var(--utp-danger);
}

.card__meta {
  margin: 0;
  padding: 0 10px 8px;
  color: var(--utp-text-muted);
  overflow-wrap: anywhere;
}

.card__detail {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 2px 10px;
  margin: 0;
  padding: 0 10px 10px;
  font: var(--utp-mono);
}

.card__detail dt {
  color: var(--utp-text-muted);
}

.card__detail dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.secondary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

@media (max-width: 420px) {
  .panel {
    width: calc(100vw - 16px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .overlay-box {
    transition: none;
  }
}

@media (forced-colors: active) {
  .overlay-box {
    border-color: Highlight;
    background: transparent;
  }

  .overlay-label,
  .panel {
    background: Canvas;
    color: CanvasText;
    border: 1px solid CanvasText;
    forced-color-adjust: none;
  }

  button[aria-checked="true"],
  .cta {
    background: Highlight;
    color: HighlightText;
  }
}
`;

export interface PickerSurface {
  /** Host element: the root of the picker UI, never a selectable target. */
  readonly root: Element;
  readonly shadow: ShadowRoot;
  destroy(): void;
}

/** Mount the shared shadow root that hosts the overlay and the panel. */
export function createPickerSurface(doc: Document): PickerSurface {
  const host = doc.createElement("div");
  host.setAttribute("data-ui-target-picker", "root");

  const shadow = host.attachShadow({ mode: "open" });
  const style = doc.createElement("style");
  style.textContent = STYLES;
  shadow.append(style);
  doc.body.append(host);

  return {
    root: host,
    shadow,
    destroy() {
      host.remove();
    },
  };
}
