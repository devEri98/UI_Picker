// @vitest-environment jsdom
import {
  DEFAULT_SHORTCUTS,
  isComposing,
  isEditableEventSource,
  matchesShortcut,
  releasesHold,
  resolveShortcuts,
} from "@ui-target-picker/browser";
import { InvalidConfigurationError } from "@ui-target-picker/core";
import { describe, expect, it } from "vitest";

import { mount } from "./dom.js";

describe("resolveShortcuts", () => {
  it("falls back to the documented defaults", () => {
    expect(resolveShortcuts()).toEqual({
      temporarySelection: { code: "AltLeft" },
      continuousSelection: { code: "KeyE", ctrl: true, shift: true },
      captureFocused: { code: "Enter", ctrl: true, shift: true },
    });
  });

  it("accepts a replacement combination", () => {
    const shortcuts = resolveShortcuts({ continuousSelection: { code: "KeyK", ctrl: true } });

    expect(shortcuts.continuousSelection).toEqual({ code: "KeyK", ctrl: true });
    expect(shortcuts.captureFocused).toEqual(DEFAULT_SHORTCUTS.captureFocused);
  });

  it.each([
    ["a missing code", { continuousSelection: {} as { code: string } }],
    ["a non object", { continuousSelection: "ctrl+e" as unknown as { code: string } }],
    ["a bare modifier for a toggle", { continuousSelection: { code: "ControlLeft" } }],
  ])("rejects %s", (_label, input) => {
    expect(() => resolveShortcuts(input)).toThrow(InvalidConfigurationError);
  });

  it("rejects two actions bound to the same combination", () => {
    expect(() =>
      resolveShortcuts({
        continuousSelection: { code: "KeyE", ctrl: true, shift: true },
        captureFocused: { code: "KeyE", ctrl: true, shift: true },
      }),
    ).toThrow(InvalidConfigurationError);
  });
});

describe("matchesShortcut", () => {
  it("matches a combination only with the exact modifiers", () => {
    const shortcut = { code: "KeyE", ctrl: true, shift: true };

    expect(
      matchesShortcut(
        new KeyboardEvent("keydown", { code: "KeyE", ctrlKey: true, shiftKey: true }),
        shortcut,
      ),
    ).toBe(true);
    expect(
      matchesShortcut(new KeyboardEvent("keydown", { code: "KeyE", ctrlKey: true }), shortcut),
    ).toBe(false);
    expect(
      matchesShortcut(
        new KeyboardEvent("keydown", { code: "KeyE", ctrlKey: true, shiftKey: true, altKey: true }),
        shortcut,
      ),
    ).toBe(false);
  });

  it("treats a hold shortcut as either physical modifier key", () => {
    const shortcut = { code: "AltLeft" };

    expect(matchesShortcut(new KeyboardEvent("keydown", { code: "AltLeft" }), shortcut)).toBe(true);
    expect(matchesShortcut(new KeyboardEvent("keydown", { code: "AltRight" }), shortcut)).toBe(
      true,
    );
    expect(matchesShortcut(new KeyboardEvent("keydown", { code: "KeyE" }), shortcut)).toBe(false);
  });
});

describe("releasesHold", () => {
  it("releases on the modifier keyup", () => {
    expect(
      releasesHold(new KeyboardEvent("keyup", { code: "AltRight" }), { code: "AltLeft" }),
    ).toBe(true);
  });

  it("releases when another keyup reports the modifier is no longer down", () => {
    expect(releasesHold(new KeyboardEvent("keyup", { code: "KeyA" }), { code: "AltLeft" })).toBe(
      true,
    );
    expect(
      releasesHold(new KeyboardEvent("keyup", { code: "KeyA", altKey: true }), { code: "AltLeft" }),
    ).toBe(false);
  });
});

describe("isEditableEventSource", () => {
  it("recognises controls the user types into", () => {
    const query = mount(
      '<input id="text"><textarea id="area"></textarea><select id="select"></select>' +
        '<div id="editable" contenteditable="true"><span id="inside">x</span></div>' +
        '<div id="role" role="textbox"></div><button id="button">Salva</button>',
    );

    for (const selector of ["#text", "#area", "#select", "#editable", "#inside", "#role"]) {
      expect(isEditableEventSource(query(selector))).toBe(true);
    }
    expect(isEditableEventSource(query("#button"))).toBe(false);
    expect(isEditableEventSource(null)).toBe(false);
  });
});

describe("isComposing", () => {
  it("detects an in-flight IME composition", () => {
    expect(isComposing(new KeyboardEvent("keydown", { code: "KeyE" }))).toBe(false);
    expect(isComposing(new KeyboardEvent("keydown", { code: "KeyE", isComposing: true }))).toBe(
      true,
    );
  });
});
