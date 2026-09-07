// @vitest-environment jsdom
import {
  clampPosition,
  createUiTargetPicker,
  defaultPosition,
  PANEL_MARGIN,
  type UiTargetPickerController,
  type UiTargetPickerOptions,
} from "@ui-target-picker/browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FIXED_CLOCK, mount } from "./dom.js";

const POINTER_ID = 9;

let picker: UiTargetPickerController | undefined;

function createPicker(options: UiTargetPickerOptions = {}): UiTargetPickerController {
  picker = createUiTargetPicker({
    now: FIXED_CLOCK,
    clipboard: { write: () => Promise.resolve() },
    ...options,
  });
  picker.enable();
  return picker;
}

function shadow(): ShadowRoot {
  const root = document.querySelector("[data-ui-target-picker]")?.shadowRoot;
  if (root === null || root === undefined) {
    throw new Error("picker surface is not mounted");
  }
  return root;
}

function find<T extends Element = HTMLElement>(selector: string): T {
  const element = shadow().querySelector<T>(selector);
  if (element === null) {
    throw new Error(`No panel element matches ${selector}`);
  }
  return element;
}

function findByText(selector: string, text: string): HTMLElement {
  for (const candidate of shadow().querySelectorAll<HTMLElement>(selector)) {
    if (candidate.textContent?.trim() === text) {
      return candidate;
    }
  }
  throw new Error(`No ${selector} with text ${text}`);
}

function capture(element: Element): void {
  document.body.dispatchEvent(
    new KeyboardEvent("keydown", { code: "AltLeft", altKey: true, bubbles: true }),
  );
  for (const type of ["pointerdown", "pointerup"]) {
    element.dispatchEvent(
      new PointerEvent(type, {
        pointerId: POINTER_ID,
        isPrimary: true,
        button: 0,
        bubbles: true,
        cancelable: true,
        composed: true,
      }),
    );
  }
  // The browser always follows with a click; the picker swallows it.
  element.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true, composed: true }),
  );
}

beforeEach(() => {
  window.history.replaceState({}, "", "/orders/import");
  window.localStorage.clear();
});

afterEach(() => {
  picker?.destroy();
  picker = undefined;
  window.localStorage.clear();
});

describe("panel structure", () => {
  it("names itself as a complementary region", () => {
    createPicker();

    const panel = find('[role="complementary"]');
    expect(panel.getAttribute("aria-label")).toBe("UI Target Picker");
    expect(find('[role="status"]').getAttribute("aria-live")).toBe("polite");
    expect(find('[role="alert"]')).not.toBeNull();
  });

  it("shows the empty state with a focusable title", () => {
    createPicker();

    const empty = find(".empty");
    expect(empty.textContent).toBe("Nessun target");
    expect(empty.tabIndex).toBe(-1);
    expect(find(".hint").textContent).toBe("Tieni premuto Alt e seleziona un elemento.");
    expect(find(".list").hidden).toBe(true);
  });

  it("reports selection mode and count in the header", () => {
    const query = mount("<button>Salva</button>");
    const controller = createPicker();

    expect(find(".header__status").textContent).toBe("Inattivo");
    expect(find(".header__count").textContent).toBe("0/20");

    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { code: "KeyE", ctrlKey: true, shiftKey: true, bubbles: true }),
    );
    expect(find(".header__status").textContent).toBe("Selezione continua attiva");

    capture(query("button"));
    expect(find(".header__count").textContent).toBe("1/20");
    expect(controller.getSession().targets).toHaveLength(1);
  });

  it("is never a capturable target, even from inside the shadow root", () => {
    const controller = createPicker();
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { code: "KeyE", ctrlKey: true, shiftKey: true, bubbles: true }),
    );

    capture(find(".cta"));

    expect(controller.getSession().targets).toEqual([]);
  });
});

describe("session cards", () => {
  it("renders one numbered card per target, newest last", () => {
    const query = mount('<button class="btn">Salva</button><span>Altro</span>');
    createPicker();
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { code: "KeyE", ctrlKey: true, shiftKey: true, bubbles: true }),
    );

    capture(query("button"));
    capture(query("span"));

    const cards = shadow().querySelectorAll(".card");
    expect(cards).toHaveLength(2);
    expect(cards[0]?.querySelector(".card__index")?.textContent).toBe("1");
    expect(cards[1]?.querySelector(".card__name")?.textContent).toBe("span");
  });

  it("expands a card into its full detail", () => {
    const query = mount('<button class="btn">Salva</button>');
    createPicker();
    capture(query("button"));

    const toggle = find<HTMLButtonElement>(".card__toggle");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    toggle.click();

    expect(find(".card__toggle").getAttribute("aria-expanded")).toBe("true");
    expect(find(".card__detail").textContent).toContain("button.btn");
  });

  it("gives the remove control an accessible name", () => {
    const query = mount('<button class="btn">Salva</button>');
    createPicker();
    capture(query("button"));

    expect(find(".card__remove").getAttribute("aria-label")).toBe(
      "Rimuovi il target 1: button.btn",
    );
  });

  it("flags a card that carries redactions", () => {
    window.history.replaceState({}, "", "/orders/import?job=2");
    const query = mount("<button>Salva</button>");
    createPicker();
    capture(query("button"));

    expect(find(".card").textContent).toContain("Contiene valori redatti.");
  });
});

describe("session actions", () => {
  it("removes a target, renumbers and offers undo", () => {
    const query = mount("<button>Salva</button><span>Altro</span>");
    const controller = createPicker();
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { code: "KeyE", ctrlKey: true, shiftKey: true, bubbles: true }),
    );
    capture(query("button"));
    capture(query("span"));

    find<HTMLButtonElement>(".card__remove").click();

    expect(controller.getSession().targets).toHaveLength(1);
    expect(find(".card__index").textContent).toBe("1");
    expect(find(".card__name").textContent).toBe("span");
    expect(findByText("button", "Annulla").hidden).toBe(false);
    expect(find('[role="status"]').textContent).toBe("Target rimosso.");
  });

  it("moves focus to the next remove control after a removal", () => {
    const query = mount("<button>Salva</button><span>Altro</span>");
    createPicker();
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { code: "KeyE", ctrlKey: true, shiftKey: true, bubbles: true }),
    );
    capture(query("button"));
    capture(query("span"));

    find<HTMLButtonElement>(".card__remove").click();

    expect(shadow().activeElement).toBe(find(".card__remove"));
  });

  it("focuses the empty title when the last target goes away", () => {
    const query = mount("<button>Salva</button>");
    createPicker();
    capture(query("button"));

    find<HTMLButtonElement>(".card__remove").click();

    expect(shadow().activeElement).toBe(find(".empty"));
  });

  it("clears the session, says how many went and can undo", () => {
    const query = mount("<button>Salva</button><span>Altro</span>");
    const controller = createPicker();
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { code: "KeyE", ctrlKey: true, shiftKey: true, bubbles: true }),
    );
    capture(query("button"));
    capture(query("span"));

    findByText("button", "Svuota sessione").click();

    expect(controller.getSession().targets).toEqual([]);
    expect(find('[role="status"]').textContent).toBe("Rimossi 2 target.");
    expect(shadow().activeElement).toBe(find(".empty"));

    findByText("button", "Annulla").click();
    expect(controller.getSession().targets).toHaveLength(2);
    expect(findByText("button", "Annulla").hidden).toBe(true);
  });

  it("leaving continuous selection keeps the session", () => {
    const query = mount("<button>Salva</button>");
    const controller = createPicker();
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { code: "KeyE", ctrlKey: true, shiftKey: true, bubbles: true }),
    );
    capture(query("button"));

    document.body.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape", bubbles: true }));

    expect(controller.getSession().targets).toHaveLength(1);
    expect(find(".header__status").textContent).toBe("Inattivo");
  });
});

describe("copy and format", () => {
  it("switches format and exposes the choice semantically", () => {
    const controller = createPicker();

    findByText('[role="radio"]', "JSON").click();

    expect(controller.getState().outputFormat).toBe("json");
    expect(findByText('[role="radio"]', "JSON").getAttribute("aria-checked")).toBe("true");
    expect(findByText('[role="radio"]', "Testo").getAttribute("aria-checked")).toBe("false");
  });

  it("disables the primary action while the session is empty", () => {
    const query = mount("<button>Salva</button>");
    createPicker();

    expect(find<HTMLButtonElement>(".cta").disabled).toBe(true);

    capture(query("button"));
    expect(find<HTMLButtonElement>(".cta").disabled).toBe(false);
  });

  it("announces a successful copy", async () => {
    const query = mount("<button>Salva</button>");
    const controller = createPicker();
    capture(query("button"));

    await controller.copy();

    expect(find('[role="status"]').textContent).toBe("Copiati 1 target in formato Testo.");
  });

  it("announces a refused clipboard as an alert", async () => {
    const query = mount("<button>Salva</button>");
    const controller = createPicker({
      clipboard: {
        write: () => Promise.reject(Object.assign(new Error("no"), { reason: "denied" })),
      },
    });
    capture(query("button"));

    await controller.copy();

    expect(find('[role="alert"]').textContent).toContain("Clipboard non disponibile");
  });

  it("reports the target limit without capturing", () => {
    const query = mount("<button>Salva</button>");
    createPicker({ maxTargets: 1 });
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { code: "KeyE", ctrlKey: true, shiftKey: true, bubbles: true }),
    );

    capture(query("button"));
    capture(query("button"));

    expect(find('[role="alert"]').textContent).toBe(
      "Limite di 1 target raggiunto. Rimuovine uno per continuare.",
    );
  });
});

describe("panel position", () => {
  it("clamps a position back inside the viewport", () => {
    const clamped = clampPosition(
      { x: 5000, y: -400 },
      { width: 340, height: 300 },
      { width: 1024, height: 768 },
    );

    expect(clamped).toEqual({ x: 1024 - 340 - PANEL_MARGIN, y: PANEL_MARGIN });
  });

  it("starts in the bottom right corner", () => {
    expect(defaultPosition({ width: 340, height: 300 }, { width: 1024, height: 768 })).toEqual({
      x: 1024 - 340 - PANEL_MARGIN,
      y: 768 - 300 - PANEL_MARGIN,
    });
  });

  it("moves with the arrow keys and remembers where it landed", () => {
    createPicker();
    const header = find(".header");

    header.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    header.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowUp", shiftKey: true, bubbles: true }),
    );

    const stored: unknown = JSON.parse(
      window.localStorage.getItem("ui-target-picker:panel-position") ?? "null",
    );
    expect(stored).toMatchObject({ version: 1 });
  });

  it("collapses to the header and keeps focus on the toggle", () => {
    createPicker();
    const collapse = find<HTMLButtonElement>(".icon-button");

    collapse.click();

    expect(collapse.getAttribute("aria-expanded")).toBe("false");
    expect(find(".body").hidden).toBe(true);
    expect(shadow().activeElement).toBe(collapse);

    collapse.click();
    expect(find(".body").hidden).toBe(false);
  });

  it("restores the initial corner on request", () => {
    const controller = createPicker();
    window.localStorage.setItem(
      "ui-target-picker:panel-position",
      JSON.stringify({ version: 1, x: 40, y: 40 }),
    );

    controller.resetPanelPosition();

    expect(window.localStorage.getItem("ui-target-picker:panel-position")).toBeNull();
    expect(find('[role="status"]').textContent).toBe("Posizione del pannello ripristinata.");
  });

  it("survives storage that throws", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => createPicker()).not.toThrow();

    getItem.mockRestore();
  });
});
