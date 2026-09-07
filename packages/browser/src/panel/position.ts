/**
 * Namespaced store for the panel position.
 *
 * It holds a version and two coordinates and nothing else: session data is
 * never persisted, and the two stores stay separate on purpose.
 */
const STORAGE_KEY = "ui-target-picker:panel-position";
const STORAGE_VERSION = 1;

/** Margin kept between the panel and the viewport edges. */
export const PANEL_MARGIN = 12;

/** Panel width in CSS pixels. The stylesheet reads the same constant. */
export const PANEL_WIDTH = 340;

export interface PanelPosition {
  readonly x: number;
  readonly y: number;
}

interface StoredPosition {
  readonly version: number;
  readonly x: number;
  readonly y: number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Bring a position back inside the visible area. */
export function clampPosition(
  position: PanelPosition,
  panel: { readonly width: number; readonly height: number },
  viewport: { readonly width: number; readonly height: number },
): PanelPosition {
  const maxX = Math.max(PANEL_MARGIN, viewport.width - panel.width - PANEL_MARGIN);
  const maxY = Math.max(PANEL_MARGIN, viewport.height - panel.height - PANEL_MARGIN);
  return {
    x: Math.min(Math.max(position.x, PANEL_MARGIN), maxX),
    y: Math.min(Math.max(position.y, PANEL_MARGIN), maxY),
  };
}

/** Default corner: bottom right, with a margin from the viewport. */
export function defaultPosition(
  panel: { readonly width: number; readonly height: number },
  viewport: { readonly width: number; readonly height: number },
): PanelPosition {
  return clampPosition(
    {
      x: viewport.width - panel.width - PANEL_MARGIN,
      y: viewport.height - panel.height - PANEL_MARGIN,
    },
    panel,
    viewport,
  );
}

export interface PositionStore {
  read(): PanelPosition | undefined;
  write(position: PanelPosition): void;
  clear(): void;
}

/**
 * Storage-backed store that degrades to a no-op.
 *
 * `localStorage` throws in a few contexts, and a position is a convenience: the
 * panel must stay usable when it cannot be remembered.
 */
export function createPositionStore(view: Window | null): PositionStore {
  function storage(): Storage | undefined {
    try {
      return view?.localStorage ?? undefined;
    } catch {
      return undefined;
    }
  }

  return {
    read() {
      try {
        const raw = storage()?.getItem(STORAGE_KEY);
        if (raw === null || raw === undefined) {
          return undefined;
        }
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null) {
          return undefined;
        }
        const stored = parsed as Partial<StoredPosition>;
        if (
          stored.version !== STORAGE_VERSION ||
          !isFiniteNumber(stored.x) ||
          !isFiniteNumber(stored.y)
        ) {
          return undefined;
        }
        return { x: stored.x, y: stored.y };
      } catch {
        return undefined;
      }
    },

    write(position) {
      try {
        storage()?.setItem(
          STORAGE_KEY,
          JSON.stringify({ version: STORAGE_VERSION, x: position.x, y: position.y }),
        );
      } catch {
        // A position that cannot be remembered is not worth an error.
      }
    },

    clear() {
      try {
        storage()?.removeItem(STORAGE_KEY);
      } catch {
        // Same: losing the stored position is harmless.
      }
    },
  };
}
