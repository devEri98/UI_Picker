// @vitest-environment jsdom
import { installPointerCapture, type PointerCapture } from "@ui-target-picker/browser";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mount } from "./dom.js";

const POINTER_ID = 7;

function pointerEvent(type: string, overrides: PointerEventInit = {}): PointerEvent {
  return new PointerEvent(type, {
    pointerId: POINTER_ID,
    isPrimary: true,
    button: 0,
    bubbles: true,
    cancelable: true,
    composed: true,
    ...overrides,
  });
}

function mouseEvent(type: string): MouseEvent {
  return new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, button: 0 });
}

interface Harness {
  readonly capture: PointerCapture;
  readonly captured: Element[];
  readonly hovered: (Element | null)[];
  disarm(): void;
}

let active: PointerCapture | undefined;

function install(
  pickerRoot?: Node,
  isSelectable: (element: Element) => boolean = () => true,
): Harness {
  const captured: Element[] = [];
  const hovered: (Element | null)[] = [];
  let armed = true;
  const capture = installPointerCapture(window, pickerRoot, {
    isArmed: () => armed,
    isSelectable,
    onHover: (element) => hovered.push(element),
    onCapture: (element) => captured.push(element),
  });
  active = capture;
  return {
    capture,
    captured,
    hovered,
    disarm: () => {
      armed = false;
    },
  };
}

afterEach(() => {
  active?.dispose();
  active = undefined;
});

describe("installPointerCapture", () => {
  it("captures once at the end of a complete sequence", () => {
    const query = mount("<button>Salva</button>");
    const button = query("button");
    const harness = install();

    const down = pointerEvent("pointerdown");
    button.dispatchEvent(down);

    expect(down.defaultPrevented).toBe(true);
    expect(harness.captured).toEqual([]);

    const up = pointerEvent("pointerup");
    button.dispatchEvent(up);

    expect(up.defaultPrevented).toBe(true);
    expect(harness.captured).toEqual([button]);
  });

  it("never lets the application click through", () => {
    const query = mount("<button>Salva</button>");
    const button = query("button");
    const applicationClick = vi.fn();
    button.addEventListener("click", applicationClick);
    const harness = install();

    button.dispatchEvent(pointerEvent("pointerdown"));
    button.dispatchEvent(pointerEvent("pointerup"));
    const click = mouseEvent("click");
    button.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
    expect(applicationClick).not.toHaveBeenCalled();
    expect(harness.captured).toHaveLength(1);
  });

  it("suppresses the compatibility mouse events of the sequence", () => {
    const query = mount("<button>Salva</button>");
    const button = query("button");
    install();

    button.dispatchEvent(pointerEvent("pointerdown"));
    for (const type of ["mousedown", "mouseup", "dblclick", "auxclick", "contextmenu"]) {
      const event = mouseEvent(type);
      button.dispatchEvent(event);
      expect(event.defaultPrevented, type).toBe(true);
    }
  });

  it("does not capture when the pointer is released on another element", () => {
    const query = mount("<button>Salva</button><span>Altro</span>");
    const harness = install();

    query("button").dispatchEvent(pointerEvent("pointerdown"));
    query("span").dispatchEvent(pointerEvent("pointerup"));

    expect(harness.captured).toEqual([]);

    const click = mouseEvent("click");
    query("span").dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
  });

  it("cancels the sequence on pointercancel", () => {
    const query = mount("<button>Salva</button>");
    const button = query("button");
    const harness = install();

    button.dispatchEvent(pointerEvent("pointerdown"));
    button.dispatchEvent(pointerEvent("pointercancel"));
    button.dispatchEvent(pointerEvent("pointerup"));

    expect(harness.captured).toEqual([]);
  });

  it("ignores a pointerup from a different pointer", () => {
    const query = mount("<button>Salva</button>");
    const button = query("button");
    const harness = install();

    button.dispatchEvent(pointerEvent("pointerdown"));
    button.dispatchEvent(pointerEvent("pointerup", { pointerId: POINTER_ID + 1 }));

    expect(harness.captured).toEqual([]);
  });

  it.each([
    ["a secondary button", { button: 2 }],
    ["a non primary pointer", { isPrimary: false }],
  ])("leaves the application alone for %s", (_label, overrides) => {
    const query = mount("<button>Salva</button>");
    const harness = install();

    const down = pointerEvent("pointerdown", overrides);
    query("button").dispatchEvent(down);

    expect(down.defaultPrevented).toBe(false);
    expect(harness.captured).toEqual([]);
  });

  it("never targets the picker's own UI", () => {
    const query = mount('<div id="picker"><button id="copy">Copia</button></div>');
    const pickerRoot = query("#picker");
    const harness = install(pickerRoot);

    const down = pointerEvent("pointerdown");
    query("#copy").dispatchEvent(down);

    expect(down.defaultPrevented).toBe(false);
    expect(harness.captured).toEqual([]);
  });

  it("leaves a non selectable target untouched", () => {
    const query = mount("<button>Salva</button>");
    const harness = install(undefined, () => false);

    const down = pointerEvent("pointerdown");
    query("button").dispatchEvent(down);

    expect(down.defaultPrevented).toBe(false);
    expect(harness.captured).toEqual([]);
  });

  it("reports hover and clears it outside a selectable target", () => {
    const query = mount("<button>Salva</button>");
    const button = query("button");
    let selectable = true;
    const harness = install(undefined, () => selectable);

    button.dispatchEvent(pointerEvent("pointermove"));
    selectable = false;
    button.dispatchEvent(pointerEvent("pointermove"));

    expect(harness.hovered).toEqual([button, null]);
  });

  it("ignores a new sequence once disarmed but still swallows the pending click", () => {
    const query = mount("<button>Salva</button>");
    const button = query("button");
    const applicationClick = vi.fn();
    button.addEventListener("click", applicationClick);
    const harness = install();

    button.dispatchEvent(pointerEvent("pointerdown"));
    button.dispatchEvent(pointerEvent("pointerup"));
    // A temporary selection disarms the picker as soon as it captures.
    harness.disarm();
    const click = mouseEvent("click");
    button.dispatchEvent(click);

    expect(harness.captured).toHaveLength(1);
    expect(click.defaultPrevented).toBe(true);
    expect(applicationClick).not.toHaveBeenCalled();

    const nextDown = pointerEvent("pointerdown");
    button.dispatchEvent(nextDown);
    expect(nextDown.defaultPrevented).toBe(false);
  });

  it("releases a stale suppression when a new sequence starts disarmed", () => {
    const query = mount("<button>Salva</button>");
    const button = query("button");
    const applicationClick = vi.fn();
    button.addEventListener("click", applicationClick);
    const harness = install();

    // A sequence that captured but whose click never arrived.
    button.dispatchEvent(pointerEvent("pointerdown"));
    button.dispatchEvent(pointerEvent("pointerup"));
    harness.disarm();

    button.dispatchEvent(pointerEvent("pointerdown"));
    const click = mouseEvent("click");
    button.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(false);
    expect(applicationClick).toHaveBeenCalledTimes(1);
  });

  it("stops intercepting after dispose", () => {
    const query = mount("<button>Salva</button>");
    const button = query("button");
    const applicationClick = vi.fn();
    button.addEventListener("click", applicationClick);
    const harness = install();

    harness.capture.dispose();
    active = undefined;

    const down = pointerEvent("pointerdown");
    button.dispatchEvent(down);
    button.dispatchEvent(mouseEvent("click"));

    expect(down.defaultPrevented).toBe(false);
    expect(applicationClick).toHaveBeenCalledTimes(1);
    expect(harness.captured).toEqual([]);
  });
});
