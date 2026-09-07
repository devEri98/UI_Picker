/** Tags whose whole subtree is skipped because it can hold user input. */
const SENSITIVE_TAGS = new Set(["input", "textarea", "select", "option"]);

/** Tags whose content is never user visible text. */
const NON_CONTENT_TAGS = new Set(["script", "style", "template", "noscript"]);

/** Roles that behave like a text field even without a form control. */
const SENSITIVE_ROLES = new Set(["textbox", "searchbox"]);

export interface BoundaryOptions {
  /** Subtree owned by the picker itself; never a target and never read. */
  readonly pickerRoot?: Node | undefined;
  /** Extra selectors the integrator declares as sensitive. */
  readonly sensitiveSelectors?: readonly string[] | undefined;
}

function matchesSafely(element: Element, selector: string): boolean {
  try {
    return element.matches(selector);
  } catch {
    return false;
  }
}

/**
 * Editable host detection.
 *
 * `isContentEditable` is preferred, with the attribute as a fallback for
 * environments that do not implement the property. An inherited editable state
 * is covered because every ancestor between the target and the editable host is
 * itself inside that host's subtree.
 */
function isContentEditable(element: Element): boolean {
  if ((element as Partial<HTMLElement>).isContentEditable === true) {
    return true;
  }
  const attribute = element.getAttribute("contenteditable");
  return attribute !== null && attribute !== "false";
}

/** True when the element belongs to the picker's own UI. */
export function isPickerNode(node: Node, pickerRoot: Node | undefined): boolean {
  return pickerRoot !== undefined && (pickerRoot === node || pickerRoot.contains(node));
}

/**
 * A sensitive boundary stops the traversal for the element and everything below
 * it, even when the captured target is a plain ancestor of the boundary.
 */
export function isSensitiveBoundary(element: Element, options: BoundaryOptions = {}): boolean {
  const tag = element.localName.toLowerCase();

  if (SENSITIVE_TAGS.has(tag) || NON_CONTENT_TAGS.has(tag)) {
    return true;
  }
  if (isContentEditable(element)) {
    return true;
  }
  const role = element.getAttribute("role")?.trim().split(/\s+/u)[0];
  if (role !== undefined && SENSITIVE_ROLES.has(role)) {
    return true;
  }
  if (isPickerNode(element, options.pickerRoot)) {
    return true;
  }
  if (element.shadowRoot !== null) {
    // The application's own shadow tree is out of scope for the MVP.
    return true;
  }
  return (options.sensitiveSelectors ?? []).some((selector) => matchesSafely(element, selector));
}

/** True when the node is hidden and therefore contributes no visible text. */
export function isHidden(element: Element): boolean {
  return element.hasAttribute("hidden") || element.getAttribute("aria-hidden") === "true";
}

export interface SelectabilityOptions extends BoundaryOptions {
  /** Document the picker is allowed to read; defaults to the element's own. */
  readonly document?: Document | undefined;
}

/**
 * A pointer target is selectable when it is connected, belongs to the allowed
 * document and does not belong to the picker's own UI.
 *
 * `html`, `body`, SVG nodes and disabled controls stay selectable: the browser
 * produces events for them and their context is still useful.
 */
export function isSelectableTarget(element: Element, options: SelectabilityOptions = {}): boolean {
  if (!element.isConnected) {
    return false;
  }
  const owner = element.ownerDocument;
  const expected = options.document ?? owner;
  if (owner !== expected) {
    return false;
  }
  return !isPickerNode(element, options.pickerRoot);
}
