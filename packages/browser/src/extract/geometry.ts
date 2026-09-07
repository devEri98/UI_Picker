import type { UiGeometryV1 } from "@ui-target-picker/core";

function toPixels(value: number): number {
  return Number.isFinite(value) ? Math.round(value) : 0;
}

/**
 * Bounding box and viewport, rounded to whole CSS pixels.
 *
 * `scrollX` and `scrollY` are omitted when the page is not scrolled.
 */
export function readGeometry(element: Element, view: Window): UiGeometryV1 {
  const rect = element.getBoundingClientRect();
  const scrollX = toPixels(view.scrollX);
  const scrollY = toPixels(view.scrollY);

  const geometry: UiGeometryV1 = {
    x: toPixels(rect.x),
    y: toPixels(rect.y),
    width: toPixels(rect.width),
    height: toPixels(rect.height),
    viewportWidth: toPixels(view.innerWidth),
    viewportHeight: toPixels(view.innerHeight),
  };

  if (scrollX === 0 && scrollY === 0) {
    return geometry;
  }
  if (scrollY === 0) {
    return { ...geometry, scrollX };
  }
  if (scrollX === 0) {
    return { ...geometry, scrollY };
  }
  return { ...geometry, scrollX, scrollY };
}
