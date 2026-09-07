import { BUDGETS, countCodePoints } from "@ui-target-picker/core";

import { escapeAttributeValue, escapeIdentifier } from "../css.js";
import { readTag, significantClasses, type ElementNamingOptions } from "./element.js";

const SEPARATOR = " > ";

export interface DomPathResult {
  readonly path: string;
  /** True when outer segments had to be dropped to fit a budget. */
  readonly truncated: boolean;
}

function needsNthOfType(element: Element): boolean {
  const parent = element.parentElement;
  if (parent === null) {
    return false;
  }
  let sameTag = 0;
  for (const sibling of parent.children) {
    if (sibling.localName === element.localName) {
      sameTag += 1;
      if (sameTag > 1) {
        return true;
      }
    }
  }
  return false;
}

function nthOfType(element: Element): number {
  const parent = element.parentElement;
  if (parent === null) {
    return 1;
  }
  let position = 0;
  for (const sibling of parent.children) {
    if (sibling.localName === element.localName) {
      position += 1;
      if (sibling === element) {
        return position;
      }
    }
  }
  return position;
}

/**
 * Segment priority: approved `data-testid`, then approved id, then tag plus
 * approved classes. `:nth-of-type` is added only when the parent holds more
 * than one element with the same tag.
 */
function buildSegment(element: Element, options: ElementNamingOptions): string {
  const tag = readTag(element);
  const testId = element.getAttribute("data-testid");
  let segment: string;

  if (testId !== null && testId.trim().length > 0) {
    segment = `[data-testid="${escapeAttributeValue(testId.trim())}"]`;
  } else {
    const id = element.getAttribute("id");
    if (id !== null && id.trim().length > 0) {
      segment = `#${escapeIdentifier(id.trim())}`;
    } else {
      segment = escapeIdentifier(tag);
      for (const className of significantClasses(element, options)) {
        segment += `.${escapeIdentifier(className)}`;
      }
    }
  }

  if (needsNthOfType(element)) {
    segment += `:nth-of-type(${String(nthOfType(element))})`;
  }

  if (countCodePoints(segment) > BUDGETS.domPathSegmentCodePoints) {
    // Fall back to the structural minimum rather than emitting a clipped selector.
    return escapeIdentifier(tag);
  }
  return segment;
}

/**
 * Build a diagnostic path from `root` down to `element`.
 *
 * The path is relative to the innermost validated component host, or to
 * `document.body` when no host is available. It is not a stable test selector.
 */
export function buildDomPath(
  element: Element,
  root: Element | null,
  options: ElementNamingOptions = {},
): DomPathResult {
  const segments: string[] = [];
  let current: Element | null = element;
  let truncated = false;

  while (current !== null && current !== root) {
    segments.unshift(buildSegment(current, options));
    current = current.parentElement;
  }

  if (segments.length === 0) {
    return { path: "", truncated: false };
  }

  if (segments.length > BUDGETS.domPathSegments) {
    segments.splice(0, segments.length - BUDGETS.domPathSegments);
    truncated = true;
  }

  while (
    segments.length > 1 &&
    countCodePoints(segments.join(SEPARATOR)) > BUDGETS.domPathCodePoints
  ) {
    segments.shift();
    truncated = true;
  }

  return { path: segments.join(SEPARATOR), truncated };
}
