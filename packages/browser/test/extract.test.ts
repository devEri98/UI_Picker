// @vitest-environment jsdom
import {
  createTargetExtractor,
  extractUiTarget,
  type ComponentResolver,
  type ExtractionOptions,
  type ExtractionSuccess,
} from "@ui-target-picker/browser";
import {
  createSessionStore,
  formatSessionAsJson,
  formatSessionAsText,
  InvalidConfigurationError,
  type UiTargetV1,
} from "@ui-target-picker/core";
import { beforeEach, describe, expect, it } from "vitest";

import { FIXED_CLOCK, mount } from "./dom.js";

function capture(element: Element, options: ExtractionOptions = {}): UiTargetV1 {
  const result = extractUiTarget(element, { now: FIXED_CLOCK, ...options });
  if (!result.ok) {
    throw new Error(`Extraction failed: ${result.error.code}`);
  }
  return result.value;
}

function captureResult(element: Element, options: ExtractionOptions = {}): ExtractionSuccess {
  const result = extractUiTarget(element, { now: FIXED_CLOCK, ...options });
  if (!result.ok) {
    throw new Error(`Extraction failed: ${result.error.code}`);
  }
  return result;
}

beforeEach(() => {
  window.history.replaceState({}, "", "/orders/import");
});

describe("extractUiTarget", () => {
  it("captures a complete target from a plain element", () => {
    const query = mount(
      '<div data-testid="group">' +
        '<button data-testid="group-toggle" class="rail__groupheader ng-star-inserted" ' +
        'type="button" aria-expanded="false" aria-label="Apri gruppo">' +
        "Brand non riconosciuto" +
        "</button></div>",
    );

    const target = capture(query("button"));

    expect(target).toEqual({
      capturedAt: "2026-08-26T10:24:31.000Z",
      location: { pathname: "/orders/import" },
      element: {
        tag: "button",
        signature: "button.rail__groupheader",
        domPath: '[data-testid="group"] > [data-testid="group-toggle"]',
      },
      semantics: {
        role: "button",
        states: [
          { name: "type", value: "button" },
          { name: "aria-expanded", value: "false" },
        ],
      },
      content: {
        text: "Brand non riconosciuto",
        references: [
          { name: "aria-label", value: "Apri gruppo" },
          { name: "data-testid", value: "group-toggle" },
        ],
      },
      geometry: {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        viewportWidth: 1024,
        viewportHeight: 768,
      },
    });
  });

  it("rejects an element that cannot be selected", () => {
    const detached = document.createElement("div");

    expect(extractUiTarget(detached)).toEqual({
      ok: false,
      error: { code: "TARGET_NOT_SELECTABLE", recoverable: true },
    });
  });

  it("produces identical bytes for the same DOM, config and clock", () => {
    const query = mount('<button id="save" class="btn">Salva</button>');

    const first = capture(query("button"));
    const second = capture(query("button"));

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("rejects an out of contract configuration at initialisation", () => {
    expect(() => createTargetExtractor({ privacy: { maxTextLength: 999 } })).toThrow(
      InvalidConfigurationError,
    );
  });
});

describe("privacy invariants", () => {
  const canaryMarkup =
    '<section id="panel">' +
    '<label>Password<input type="password" name="password" value="CANARY_PASSWORD"></label>' +
    '<textarea name="note">CANARY_TEXTAREA</textarea>' +
    '<select name="brand"><option value="CANARY_OPTION">CANARY_OPTION_LABEL</option></select>' +
    '<div contenteditable="true">CANARY_EDITABLE</div>' +
    "<p>Testo consentito</p>" +
    "</section>";

  it("never leaks a control value, even capturing a common ancestor", () => {
    const query = mount(canaryMarkup);

    const target = capture(query("#panel"));
    const store = createSessionStore();
    store.add(target);
    const session = store.getSession();

    for (const rendered of [
      JSON.stringify(target),
      formatSessionAsJson(session),
      formatSessionAsText(session),
    ]) {
      expect(rendered).not.toContain("CANARY");
    }
    // The static text of a label is admitted; only the control below it is skipped.
    expect(target.content?.text).toBe("Password Testo consentito");
  });

  it("collects nothing but records the reason when the target is a control", () => {
    const query = mount(canaryMarkup);

    const target = capture(query("input"));

    expect(target.content?.text).toBeUndefined();
    expect(target.redactions).toContainEqual({
      field: "content.text",
      action: "omitted",
      reason: "sensitive-element",
    });
    expect(JSON.stringify(target)).not.toContain("CANARY");
  });

  it("keeps the placeholder of a control but never its value", () => {
    const query = mount('<input type="text" placeholder="Cerca un ordine" value="CANARY_VALUE">');

    const target = capture(query("input"));

    expect(target.content?.references).toEqual([{ name: "placeholder", value: "Cerca un ordine" }]);
    expect(JSON.stringify(target)).not.toContain("CANARY");
  });

  it("excludes query and hash unless the consumer opts in", () => {
    window.history.replaceState({}, "", "/orders/import?job=2#problems");
    const query = mount("<button>Salva</button>");

    const withoutOptIn = capture(query("button"));
    const withOptIn = capture(query("button"), {
      privacy: { includeSearch: true, includeHash: true },
    });

    expect(withoutOptIn.location).toEqual({ pathname: "/orders/import" });
    expect(withoutOptIn.redactions).toEqual([
      { field: "location.hash", action: "omitted", reason: "default-policy" },
      { field: "location.search", action: "omitted", reason: "default-policy" },
    ]);
    expect(withOptIn.location).toEqual({
      pathname: "/orders/import",
      search: "?job=2",
      hash: "#problems",
    });
  });

  it("reduces the model to structure only under the strict preset", () => {
    const query = mount(
      '<div data-testid="group"><button id="user-42" class="btn" ' +
        'aria-label="Apri">Testo</button></div>',
    );

    const target = capture(query("button"), { privacy: { preset: "strict" } });

    expect(target.location.pathname).toBe("[redacted]");
    expect(target.element).toEqual({ tag: "button", signature: "button" });
    expect(target.content).toBeUndefined();
    expect(target.semantics?.role).toBe("button");
    expect(target.geometry).toBeDefined();
  });

  it("truncates long text and flags it", () => {
    const query = mount(`<p>${"a".repeat(200)}</p>`);

    const target = capture(query("p"), { privacy: { maxTextLength: 10 } });

    expect(target.content?.text).toBe("a".repeat(10));
    expect(target.content?.textTruncated).toBe(true);
    expect(target.redactions).toContainEqual({
      field: "content.text",
      action: "truncated",
      reason: "length-limit",
    });
  });

  it("routes every string through the custom redactor", () => {
    const query = mount('<button id="save" class="btn">Salva</button>');
    const fields: string[] = [];

    capture(query("button"), {
      privacy: {
        redact: (candidate) => {
          fields.push(candidate.field);
          return { action: "keep" };
        },
      },
    });

    expect(fields).toContain("location.pathname");
    expect(fields).toContain("element.id");
    expect(fields).toContain("element.class");
    expect(fields).toContain("element.domPath");
    expect(fields).toContain("content.text");
  });

  it("never reads the picker's own UI", () => {
    const query = mount('<div id="host">Applicazione<div id="picker">CANARY_PANEL</div></div>');

    const target = capture(query("#host"), { pickerRoot: query("#picker") });

    expect(target.content?.text).toBe("Applicazione");
    expect(JSON.stringify(target)).not.toContain("CANARY");
  });
});

describe("component resolution", () => {
  function resolver(result: unknown): ComponentResolver {
    return {
      adapter: "angular",
      resolve: () => result as ReturnType<ComponentResolver["resolve"]>,
    };
  }

  it("uses the resolved host as the DOM path root", () => {
    const query = mount(
      '<app-shell><app-import-problems id="host"><div class="rail">' +
        '<button class="btn">Salva</button></div></app-import-problems></app-shell>',
    );
    const host = query("#host");

    const target = capture(query("button"), {
      resolver: resolver({
        status: "resolved",
        value: {
          host,
          name: "ImportProblems",
          selector: "app-import-problems",
          ancestry: ["App", "Shell", "ImportProblems"],
        },
      }),
    });

    expect(target.component).toEqual({
      adapter: "angular",
      name: "ImportProblems",
      selector: "app-import-problems",
      ancestry: ["App", "Shell", "ImportProblems"],
    });
    expect(target.element.domPath).toBe("div.rail > button.btn");
  });

  it("captures the DOM target when the resolver reports it has no component", () => {
    const query = mount("<button>Salva</button>");

    const result = captureResult(query("button"), {
      resolver: resolver({ status: "unavailable", reason: "DEBUG_GLOBALS_MISSING" }),
    });

    expect(result.value.component).toBeUndefined();
    expect(result.warnings).toEqual([]);
    expect(result.resolverUnavailableReason).toBe("DEBUG_GLOBALS_MISSING");
  });

  it.each<[string, unknown]>([
    ["a host that is not an ancestor", { status: "resolved", value: { host: null, name: "X" } }],
    ["a missing name", { status: "resolved", value: { name: "" } }],
    ["a hostile ancestry", { status: "resolved", value: { name: "X", ancestry: [{}] } }],
    ["an unknown status", { status: "whatever" }],
    ["a non object", "nope"],
  ])("omits the component and warns on %s", (_label, outcome) => {
    const query = mount("<button>Salva</button>");

    const result = captureResult(query("button"), { resolver: resolver(outcome) });

    expect(result.value.component).toBeUndefined();
    expect(result.warnings).toEqual([
      { code: "RESOLVER_FAILED", recoverable: true, adapter: "angular" },
    ]);
  });

  it("survives a resolver that throws", () => {
    const query = mount("<button>Salva</button>");

    const result = captureResult(query("button"), {
      resolver: {
        adapter: "angular",
        resolve: () => {
          throw new Error("boom");
        },
      },
    });

    expect(result.value.element.signature).toBe("button");
    expect(result.warnings).toEqual([
      { code: "RESOLVER_FAILED", recoverable: true, adapter: "angular" },
    ]);
  });

  it("rejects an adapter name outside the contract", () => {
    const query = mount("<button>Salva</button>");

    const result = captureResult(query("button"), {
      resolver: {
        adapter: "x".repeat(200),
        resolve: () => ({ status: "unavailable", reason: "NO_COMPONENT" }),
      },
    });

    expect(result.warnings).toEqual([
      { code: "RESOLVER_FAILED", recoverable: true, adapter: "invalid" },
    ]);
  });
});
