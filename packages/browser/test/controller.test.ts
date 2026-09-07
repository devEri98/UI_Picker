// @vitest-environment jsdom
import {
  createUiTargetPicker,
  type UiTargetPickerController,
  type UiTargetPickerOptions,
  type UiTargetPickerState,
} from "@ui-target-picker/browser";
import { InvalidConfigurationError } from "@ui-target-picker/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FIXED_CLOCK, mount } from "./dom.js";

const POINTER_ID = 3;

let picker: UiTargetPickerController | undefined;

function createPicker(options: UiTargetPickerOptions = {}): UiTargetPickerController {
  picker = createUiTargetPicker({ now: FIXED_CLOCK, ...options });
  return picker;
}

function key(type: "keydown" | "keyup", code: string, modifiers: KeyboardEventInit = {}): boolean {
  return document.body.dispatchEvent(
    new KeyboardEvent(type, { code, bubbles: true, cancelable: true, ...modifiers }),
  );
}

function pointer(type: string, element: Element, overrides: PointerEventInit = {}): PointerEvent {
  const event = new PointerEvent(type, {
    pointerId: POINTER_ID,
    isPrimary: true,
    button: 0,
    bubbles: true,
    cancelable: true,
    composed: true,
    ...overrides,
  });
  element.dispatchEvent(event);
  return event;
}

function clickSequence(element: Element): MouseEvent {
  pointer("pointerdown", element);
  pointer("pointerup", element);
  const click = new MouseEvent("click", { bubbles: true, cancelable: true, composed: true });
  element.dispatchEvent(click);
  return click;
}

function setVisibility(state: "visible" | "hidden"): void {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  window.history.replaceState({}, "", "/orders/import");
});

afterEach(() => {
  picker?.destroy();
  picker = undefined;
  setVisibility("visible");
});

describe("lifecycle", () => {
  it("installs nothing before enable", () => {
    const controller = createPicker();

    expect(controller.getState()).toEqual({
      lifecycle: "created",
      selectionMode: "inactive",
      copyState: "idle",
      targetCount: 0,
      maxTargets: 20,
      outputFormat: "text",
      canUndo: false,
    });
    expect(document.querySelector("[data-ui-target-picker]")).toBeNull();
  });

  it("mounts the overlay and the panel in an open shadow root on enable", () => {
    const controller = createPicker();

    expect(controller.enable()).toEqual({ ok: true });

    const shadow = document.querySelector("[data-ui-target-picker]")?.shadowRoot;
    expect(shadow?.querySelector(".overlay-box")).not.toBeNull();
    expect(shadow?.querySelector('[role="complementary"]')?.getAttribute("aria-label")).toBe(
      "UI Target Picker",
    );
    expect(controller.getState().lifecycle).toBe("enabled");
  });

  it("can run without the panel", () => {
    const controller = createPicker({ panel: false });
    controller.enable();

    const shadow = document.querySelector("[data-ui-target-picker]")?.shadowRoot;
    expect(shadow?.querySelector(".overlay-box")).not.toBeNull();
    expect(shadow?.querySelector(".panel")).toBeNull();
  });

  it("is idempotent on enable, disable and destroy", () => {
    const controller = createPicker();

    expect(controller.enable()).toEqual({ ok: true });
    expect(controller.enable()).toEqual({ ok: true });
    expect(controller.disable()).toEqual({ ok: true });
    expect(controller.disable()).toEqual({ ok: true });
    expect(document.querySelector("[data-ui-target-picker]")).toBeNull();
    expect(controller.destroy()).toEqual({ ok: true });
  });

  it("refuses every lifecycle call after destroy", () => {
    const controller = createPicker();
    controller.enable();
    controller.destroy();

    const destroyed = {
      ok: false,
      error: { code: "CONTROLLER_DESTROYED", recoverable: false },
    };
    expect(controller.enable()).toEqual(destroyed);
    expect(controller.disable()).toEqual(destroyed);
    expect(controller.destroy()).toEqual(destroyed);
    expect(controller.getState().lifecycle).toBe("destroyed");
  });

  it("empties the session and stops listening after destroy", () => {
    const query = mount("<button>Salva</button>");
    const controller = createPicker();
    controller.enable();
    key("keydown", "AltLeft", { altKey: true });
    clickSequence(query("button"));
    expect(controller.getSession().targets).toHaveLength(1);

    controller.destroy();

    expect(controller.getSession().targets).toEqual([]);
    const applicationClick = vi.fn();
    query("button").addEventListener("click", applicationClick);
    clickSequence(query("button"));
    expect(applicationClick).toHaveBeenCalledTimes(1);
  });

  it("rejects an out of contract configuration", () => {
    expect(() => createUiTargetPicker({ maxTargets: 99 })).toThrow(InvalidConfigurationError);
    expect(() =>
      createUiTargetPicker({ shortcuts: { captureFocused: { code: "AltLeft" } } }),
    ).toThrow(InvalidConfigurationError);
    expect(() => createUiTargetPicker({ privacy: { maxTextLength: 999 } })).toThrow(
      InvalidConfigurationError,
    );
  });
});

describe("selection modes", () => {
  it("arms temporary selection while the modifier is held", () => {
    const controller = createPicker();
    controller.enable();

    key("keydown", "AltLeft", { altKey: true });
    expect(controller.getState().selectionMode).toBe("temporary");

    key("keyup", "AltLeft");
    expect(controller.getState().selectionMode).toBe("inactive");
  });

  it("toggles continuous selection and leaves it with Escape", () => {
    const controller = createPicker();
    controller.enable();

    key("keydown", "KeyE", { ctrlKey: true, shiftKey: true });
    expect(controller.getState().selectionMode).toBe("continuous");

    key("keydown", "KeyE", { ctrlKey: true, shiftKey: true });
    expect(controller.getState().selectionMode).toBe("inactive");

    key("keydown", "KeyE", { ctrlKey: true, shiftKey: true });
    key("keydown", "Escape");
    expect(controller.getState().selectionMode).toBe("inactive");
  });

  it("keeps the session when leaving continuous selection", () => {
    const query = mount("<button>Salva</button>");
    const controller = createPicker();
    controller.enable();

    key("keydown", "KeyE", { ctrlKey: true, shiftKey: true });
    clickSequence(query("button"));
    key("keydown", "Escape");

    expect(controller.getSession().targets).toHaveLength(1);
  });

  it.each([
    ["the window loses focus", () => window.dispatchEvent(new Event("blur"))],
    ["the document becomes hidden", () => setVisibility("hidden")],
  ])("falls back to inactive when %s and never re-arms", (_label, trigger) => {
    const controller = createPicker();
    controller.enable();
    key("keydown", "AltLeft", { altKey: true });

    trigger();

    expect(controller.getState().selectionMode).toBe("inactive");
  });

  it("ignores shortcuts coming from an editable control", () => {
    const query = mount('<input id="field">');
    const controller = createPicker();
    controller.enable();

    query("#field").dispatchEvent(
      new KeyboardEvent("keydown", { code: "AltLeft", altKey: true, bubbles: true }),
    );

    expect(controller.getState().selectionMode).toBe("inactive");
  });

  it("ignores shortcuts during an IME composition", () => {
    const controller = createPicker();
    controller.enable();

    key("keydown", "AltLeft", { altKey: true, isComposing: true });

    expect(controller.getState().selectionMode).toBe("inactive");
  });
});

describe("capture", () => {
  it("captures a target and disarms after a temporary selection", () => {
    const query = mount('<button class="btn">Salva</button>');
    const controller = createPicker();
    controller.enable();
    key("keydown", "AltLeft", { altKey: true });

    const click = clickSequence(query("button"));

    expect(click.defaultPrevented).toBe(true);
    expect(controller.getSession().targets).toHaveLength(1);
    expect(controller.getSession().targets[0]?.element.signature).toBe("button.btn");
    expect(controller.getState().selectionMode).toBe("inactive");
  });

  it("keeps capturing in continuous selection", () => {
    const query = mount("<button>Salva</button><span>Altro</span>");
    const controller = createPicker();
    controller.enable();
    key("keydown", "KeyE", { ctrlKey: true, shiftKey: true });

    clickSequence(query("button"));
    clickSequence(query("span"));

    expect(controller.getSession().targets.map((target) => target.element.tag)).toEqual([
      "button",
      "span",
    ]);
    expect(controller.getState().selectionMode).toBe("continuous");
  });

  it("does not capture while the picker is not armed", () => {
    const query = mount("<button>Salva</button>");
    const applicationClick = vi.fn();
    query("button").addEventListener("click", applicationClick);
    const controller = createPicker();
    controller.enable();

    clickSequence(query("button"));

    expect(controller.getSession().targets).toEqual([]);
    expect(applicationClick).toHaveBeenCalledTimes(1);
  });

  it("captures the focused element from the keyboard", () => {
    const query = mount('<button id="save">Salva</button>');
    const controller = createPicker();
    controller.enable();
    (query("#save") as HTMLElement).focus();

    key("keydown", "Enter", { ctrlKey: true, shiftKey: true });

    expect(controller.getSession().targets).toHaveLength(1);
    expect(controller.getState().selectionMode).toBe("inactive");
  });

  it("reports the limit instead of capturing past it", () => {
    const query = mount("<button>Salva</button>");
    const controller = createPicker({ maxTargets: 1 });
    controller.enable();
    key("keydown", "KeyE", { ctrlKey: true, shiftKey: true });

    clickSequence(query("button"));
    clickSequence(query("button"));

    expect(controller.getSession().targets).toHaveLength(1);
    expect(controller.getState().lastError).toEqual({
      code: "TARGET_LIMIT_REACHED",
      recoverable: true,
    });
  });

  it("never captures the picker's own overlay", () => {
    const controller = createPicker();
    controller.enable();
    key("keydown", "KeyE", { ctrlKey: true, shiftKey: true });
    const root = document.querySelector("[data-ui-target-picker]");

    clickSequence(root as Element);

    expect(controller.getSession().targets).toEqual([]);
  });
});

describe("overlay feedback", () => {
  it("shows the highlight on hover and hides it when disarmed", () => {
    const query = mount('<button class="btn rail__item">Salva</button>');
    const controller = createPicker();
    controller.enable();
    key("keydown", "AltLeft", { altKey: true });
    const shadow = document.querySelector("[data-ui-target-picker]")?.shadowRoot;

    pointer("pointermove", query("button"));

    expect(shadow?.querySelector(".overlay-box")?.hasAttribute("hidden")).toBe(false);
    expect(shadow?.querySelector(".overlay-label")?.textContent).toBe("button.btn.rail__item");

    key("keyup", "AltLeft");
    expect(shadow?.querySelector(".overlay-box")?.hasAttribute("hidden")).toBe(true);
  });

  it("shows only the tag under the strict preset", () => {
    const query = mount('<button id="user-42" class="btn">Salva</button>');
    const controller = createPicker({ privacy: { preset: "strict" } });
    controller.enable();
    key("keydown", "AltLeft", { altKey: true });

    pointer("pointermove", query("button"));

    expect(
      document.querySelector("[data-ui-target-picker]")?.shadowRoot?.querySelector(".overlay-label")
        ?.textContent,
    ).toBe("button");
  });
});

describe("subscribe", () => {
  it("emits sanitised snapshots on every change", () => {
    const query = mount("<button>Salva</button>");
    const controller = createPicker();
    const seen: UiTargetPickerState[] = [];
    controller.subscribe((next) => seen.push(next));

    controller.enable();
    key("keydown", "AltLeft", { altKey: true });
    clickSequence(query("button"));

    expect(seen.map((entry) => entry.lifecycle)).toContain("enabled");
    expect(seen.map((entry) => entry.selectionMode)).toContain("temporary");
    expect(seen.at(-1)?.targetCount).toBe(1);
    expect(Object.isFrozen(seen.at(-1))).toBe(true);
  });

  it("has an idempotent unsubscribe", () => {
    const controller = createPicker();
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);

    unsubscribe();
    unsubscribe();
    controller.enable();

    expect(listener).not.toHaveBeenCalled();
  });

  it("drops every subscriber on destroy", () => {
    const controller = createPicker();
    const listener = vi.fn();
    controller.enable();
    controller.subscribe(listener);
    listener.mockClear();

    controller.destroy();
    key("keydown", "AltLeft", { altKey: true });

    expect(listener).not.toHaveBeenCalled();
  });
});
