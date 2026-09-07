import { type BoundaryOptions, isHidden, isSensitiveBoundary } from "../boundaries.js";

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

/**
 * Collect the visible text of a subtree.
 *
 * Only `nodeValue` of admitted `Text` nodes is read. `innerText`,
 * `textContent`, `innerHTML` and `outerHTML` are never used, and the whole
 * subtree of a sensitive boundary is skipped even when the captured target is
 * one of its plain ancestors.
 *
 * The result is a diagnostic hint, not the browser's accessible name.
 */
export function collectVisibleText(root: Element, options: BoundaryOptions = {}): string {
  if (isSensitiveBoundary(root, options) || isHidden(root)) {
    return "";
  }

  const parts: string[] = [];
  visitChildren(root, options, parts);
  return parts.join(" ");
}

function visitChildren(element: Element, options: BoundaryOptions, parts: string[]): void {
  for (const node of element.childNodes) {
    if (node.nodeType === TEXT_NODE) {
      const value = node.nodeValue;
      if (value !== null && value.trim().length > 0) {
        parts.push(value);
      }
      continue;
    }
    if (node.nodeType !== ELEMENT_NODE) {
      continue;
    }
    const child = node as Element;
    if (isSensitiveBoundary(child, options) || isHidden(child)) {
      continue;
    }
    visitChildren(child, options, parts);
  }
}
