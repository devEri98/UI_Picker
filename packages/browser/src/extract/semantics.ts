const TEXT_INPUT_TYPES = new Set(["text", "email", "tel", "url", "password"]);
const BUTTON_INPUT_TYPES = new Set(["button", "submit", "reset"]);

/**
 * Explicit `role` first, then a deliberately small HTML fallback.
 *
 * This is not the browser's full accessible role computation and does not
 * pretend to be.
 */
export function readRole(element: Element): string | undefined {
  const explicit = element.getAttribute("role")?.trim().split(/\s+/u)[0];
  if (explicit !== undefined && explicit.length > 0) {
    return explicit;
  }

  switch (element.localName.toLowerCase()) {
    case "button":
      return "button";
    case "a":
      return element.hasAttribute("href") ? "link" : undefined;
    case "select":
      return "combobox";
    case "textarea":
      return "textbox";
    case "input":
      return inputRole(element.getAttribute("type")?.toLowerCase() ?? "text");
    default:
      return undefined;
  }
}

function inputRole(type: string): string | undefined {
  if (type === "search") {
    return "searchbox";
  }
  if (TEXT_INPUT_TYPES.has(type)) {
    return "textbox";
  }
  if (type === "checkbox") {
    return "checkbox";
  }
  if (type === "radio") {
    return "radio";
  }
  if (BUTTON_INPUT_TYPES.has(type)) {
    return "button";
  }
  return undefined;
}

export interface RawState {
  readonly name: string;
  readonly value: string | boolean;
}

const STRING_STATES: readonly string[] = ["type", "name"];
const BOOLEAN_STATES: readonly string[] = ["disabled", "required", "readonly"];
const ARIA_STATES: readonly string[] = [
  "aria-checked",
  "aria-expanded",
  "aria-pressed",
  "aria-selected",
];

/**
 * Interactive state at capture time, in the fixed order defined by the schema.
 *
 * The current value of a control is never read: `value` and `defaultValue` stay
 * out of the model by contract.
 */
export function readStates(element: Element): readonly RawState[] {
  const states: RawState[] = [];

  for (const name of STRING_STATES) {
    const value = element.getAttribute(name);
    if (value !== null && value.trim().length > 0) {
      states.push({ name, value });
    }
  }
  for (const name of BOOLEAN_STATES) {
    if (element.hasAttribute(name)) {
      states.push({ name, value: true });
    }
  }
  for (const name of ARIA_STATES) {
    const value = element.getAttribute(name);
    if (value !== null && value.trim().length > 0) {
      states.push({ name, value });
    }
  }

  return states;
}

/** Attributes that help a human recognise the element again. */
export const REFERENCE_ATTRIBUTES: readonly string[] = [
  "aria-label",
  "title",
  "placeholder",
  "data-testid",
];

export function readReferences(element: Element): readonly RawState[] {
  const references: RawState[] = [];

  for (const name of REFERENCE_ATTRIBUTES) {
    const value = element.getAttribute(name);
    if (value !== null && value.trim().length > 0) {
      references.push({ name, value });
    }
  }

  return references;
}
