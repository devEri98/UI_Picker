import { InvalidConfigurationError } from "@ui-target-picker/core";

export interface KeyboardShortcut {
  readonly code: string;
  readonly alt?: boolean;
  readonly ctrl?: boolean;
  readonly shift?: boolean;
  readonly meta?: boolean;
}

export interface UiTargetPickerShortcuts {
  /** Held down to arm a single selection. */
  readonly temporarySelection: KeyboardShortcut;
  /** Toggles continuous selection. */
  readonly continuousSelection: KeyboardShortcut;
  /** Captures the element that currently has focus. */
  readonly captureFocused: KeyboardShortcut;
}

export const DEFAULT_SHORTCUTS: UiTargetPickerShortcuts = {
  temporarySelection: { code: "AltLeft" },
  continuousSelection: { code: "KeyE", ctrl: true, shift: true },
  captureFocused: { code: "Enter", ctrl: true, shift: true },
};

/** Key that exits continuous selection. Fixed, per the UX contract. */
export const EXIT_SELECTION_CODE = "Escape";

type ModifierName = "alt" | "ctrl" | "shift" | "meta";

/**
 * Modifier keys usable as a hold shortcut.
 *
 * Both physical sides map to the same modifier, so "hold Alt" works with either
 * Alt key even though the contract carries a single `code`.
 */
const MODIFIER_CODES = new Map<string, ModifierName>([
  ["AltLeft", "alt"],
  ["AltRight", "alt"],
  ["ControlLeft", "ctrl"],
  ["ControlRight", "ctrl"],
  ["ShiftLeft", "shift"],
  ["ShiftRight", "shift"],
  ["MetaLeft", "meta"],
  ["MetaRight", "meta"],
]);

export function modifierForCode(code: string): ModifierName | undefined {
  return MODIFIER_CODES.get(code);
}

const SHORTCUT_KEYS = ["temporarySelection", "continuousSelection", "captureFocused"] as const;

function signature(shortcut: KeyboardShortcut): string {
  const modifier = modifierForCode(shortcut.code);
  if (modifier !== undefined) {
    return `hold:${modifier}`;
  }
  return [
    shortcut.code,
    shortcut.alt === true ? "alt" : "",
    shortcut.ctrl === true ? "ctrl" : "",
    shortcut.shift === true ? "shift" : "",
    shortcut.meta === true ? "meta" : "",
  ].join("+");
}

function isKeyboardShortcut(value: unknown): value is KeyboardShortcut {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<KeyboardShortcut>;
  if (typeof candidate.code !== "string" || candidate.code.length === 0) {
    return false;
  }
  return (["alt", "ctrl", "shift", "meta"] as const).every(
    (flag) => candidate[flag] === undefined || typeof candidate[flag] === "boolean",
  );
}

/**
 * Validate and complete the shortcut configuration.
 *
 * An invalid or duplicated combination invalidates the initialisation instead
 * of being silently corrected.
 */
export function resolveShortcuts(
  input?: Partial<UiTargetPickerShortcuts>,
): UiTargetPickerShortcuts {
  const issues: string[] = [];
  const resolved: Record<string, KeyboardShortcut> = {};

  for (const key of SHORTCUT_KEYS) {
    const configured = input?.[key];
    if (configured === undefined) {
      resolved[key] = DEFAULT_SHORTCUTS[key];
      continue;
    }
    if (!isKeyboardShortcut(configured)) {
      issues.push(`shortcuts.${key} must be a { code, alt?, ctrl?, shift?, meta? } object`);
      continue;
    }
    if (key !== "temporarySelection" && modifierForCode(configured.code) !== undefined) {
      issues.push(`shortcuts.${key} cannot be a bare modifier key`);
      continue;
    }
    resolved[key] = configured;
  }

  const seen = new Map<string, string>();
  for (const key of SHORTCUT_KEYS) {
    const shortcut = resolved[key];
    if (shortcut === undefined) {
      continue;
    }
    const identity = signature(shortcut);
    const owner = seen.get(identity);
    if (owner !== undefined) {
      issues.push(`shortcuts.${key} duplicates shortcuts.${owner}`);
      continue;
    }
    seen.set(identity, key);
  }

  if (issues.length > 0) {
    throw new InvalidConfigurationError(issues);
  }

  return resolved as unknown as UiTargetPickerShortcuts;
}

const EDITABLE_TAGS = new Set(["input", "textarea", "select", "option"]);
const EDITABLE_ROLES = new Set(["textbox", "searchbox", "combobox", "spinbutton"]);

/**
 * True when the event comes from a control the user is typing into.
 *
 * Shortcuts must not fire there, otherwise the picker would steal keystrokes
 * from the host application.
 */
export function isEditableEventSource(target: EventTarget | null): boolean {
  if (target === null || typeof target !== "object" || !("nodeType" in target)) {
    return false;
  }
  const node = target as Node;
  const element = node.nodeType === 1 ? (node as Element) : node.parentElement;
  if (element === null) {
    return false;
  }
  if (EDITABLE_TAGS.has(element.localName.toLowerCase())) {
    return true;
  }
  if ((element as Partial<HTMLElement>).isContentEditable === true) {
    return true;
  }
  if (element.closest("[contenteditable]:not([contenteditable='false'])") !== null) {
    return true;
  }
  const role = element.getAttribute("role")?.trim().split(/\s+/u)[0];
  return role !== undefined && EDITABLE_ROLES.has(role);
}

/** True while an IME composition is in flight. */
export function isComposing(event: KeyboardEvent): boolean {
  return event.isComposing || event.keyCode === 229;
}

export function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  const modifier = modifierForCode(shortcut.code);
  if (modifier !== undefined) {
    return modifierForCode(event.code) === modifier;
  }
  return (
    event.code === shortcut.code &&
    event.altKey === (shortcut.alt ?? false) &&
    event.ctrlKey === (shortcut.ctrl ?? false) &&
    event.shiftKey === (shortcut.shift ?? false) &&
    event.metaKey === (shortcut.meta ?? false)
  );
}

/** True when the modifier behind a hold shortcut is no longer pressed. */
export function releasesHold(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  const modifier = modifierForCode(shortcut.code);
  if (modifier === undefined) {
    return event.code === shortcut.code;
  }
  if (modifierForCode(event.code) === modifier) {
    return true;
  }
  const stillPressed = {
    alt: event.altKey,
    ctrl: event.ctrlKey,
    shift: event.shiftKey,
    meta: event.metaKey,
  }[modifier];
  return !stillPressed;
}
