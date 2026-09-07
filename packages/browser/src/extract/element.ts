import { BUDGETS, clampCodePoints, type RedactionEngine } from "@ui-target-picker/core";

import { escapeIdentifier } from "../css.js";

/** Framework generated classes carry no meaning for a human reader. */
export const DEFAULT_EXCLUDED_CLASS_PREFIXES: readonly string[] = [
  "ng-",
  "cdk-",
  "_ngcontent",
  "_nghost",
];

export interface ElementNamingOptions {
  readonly excludedClassPrefixes?: readonly string[] | undefined;
}

/** Lowercase `localName`, clamped to the tag budget. */
export function readTag(element: Element): string {
  return clampCodePoints(element.localName.toLowerCase(), BUDGETS.tagCodePoints).value;
}

/**
 * Classes in DOM order, deduplicated, without framework prefixes.
 *
 * `limit` caps how many survive; the signature keeps two.
 */
export function significantClasses(
  element: Element,
  options: ElementNamingOptions = {},
  limit: number = BUDGETS.signatureClasses,
): readonly string[] {
  const excluded = options.excludedClassPrefixes ?? DEFAULT_EXCLUDED_CLASS_PREFIXES;
  const seen = new Set<string>();
  const result: string[] = [];

  for (const className of element.classList) {
    if (result.length >= limit) {
      break;
    }
    if (seen.has(className) || excluded.some((prefix) => className.startsWith(prefix))) {
      continue;
    }
    seen.add(className);
    result.push(className);
  }

  return result;
}

export interface ElementSignature {
  readonly tag: string;
  readonly signature: string;
}

/**
 * Build `tag#id.class1.class2`.
 *
 * The tag never reaches the custom redactor: it comes from `localName` and is
 * the minimum structural fallback. Id and classes are redacted first, and the
 * signature is rebuilt from the approved candidates only.
 */
export function buildSignature(
  element: Element,
  engine: RedactionEngine,
  options: ElementNamingOptions = {},
): ElementSignature {
  const tag = readTag(element);
  let signature = escapeIdentifier(tag);

  const rawId = element.getAttribute("id");
  if (rawId !== null) {
    const id = engine.apply("element.id", rawId);
    if (id.kind === "value") {
      signature += `#${escapeIdentifier(id.value)}`;
    }
  }

  for (const rawClass of significantClasses(element, options)) {
    const className = engine.apply("element.class", rawClass);
    if (className.kind === "value") {
      signature += `.${escapeIdentifier(className.value)}`;
    }
  }

  return { tag, signature };
}
