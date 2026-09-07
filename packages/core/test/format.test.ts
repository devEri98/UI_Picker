import {
  createSessionStore,
  formatSession,
  formatSessionAsJson,
  formatSessionAsText,
  isUiTargetSessionV1,
  type UiTargetSessionV1,
} from "@ui-target-picker/core";
import { describe, expect, it } from "vitest";

import { makeTarget } from "./fixtures.js";

function sessionWith(...targets: ReturnType<typeof makeTarget>[]): UiTargetSessionV1 {
  const store = createSessionStore();
  for (const target of targets) {
    store.add(target);
  }
  return store.getSession();
}

describe("JSON formatter", () => {
  it("serialises properties in schema order with two-space indent and LF newlines", () => {
    const json = formatSessionAsJson(sessionWith(makeTarget()));

    expect(json).not.toContain("\r");
    expect(json.split("\n").slice(0, 3)).toEqual([
      "{",
      '  "schema": "ui-target-picker/session",',
      '  "schemaVersion": 1,',
    ]);
    expect(JSON.parse(json)).toEqual({
      schema: "ui-target-picker/session",
      schemaVersion: 1,
      targets: [
        {
          capturedAt: "2026-08-26T10:24:31.000Z",
          location: { pathname: "/orders/import" },
          component: {
            adapter: "angular",
            name: "ImportProblems",
            selector: "app-import-problems",
            ancestry: ["App", "Shell", "ImportPage", "ImportProblems"],
          },
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
            references: [{ name: "data-testid", value: "group-toggle" }],
          },
          geometry: {
            x: 413,
            y: 588,
            width: 353,
            height: 54,
            viewportWidth: 1920,
            viewportHeight: 945,
          },
        },
      ],
    });
  });

  it("omits optional fields instead of emitting null or empty strings", () => {
    const json = formatSessionAsJson(
      sessionWith(
        makeTarget({
          component: undefined,
          semantics: undefined,
          content: undefined,
          geometry: undefined,
        }),
      ),
    );

    expect(json).not.toContain("null");
    expect(json).not.toContain('""');
    expect(json).not.toContain("component");
  });

  it("produces identical bytes for the same sanitised model", () => {
    const first = formatSessionAsJson(sessionWith(makeTarget()));
    const second = formatSessionAsJson(sessionWith(makeTarget()));

    expect(first).toBe(second);
  });

  it("round-trips through the session guard", () => {
    const parsed: unknown = JSON.parse(formatSessionAsJson(sessionWith(makeTarget())));

    expect(isUiTargetSessionV1(parsed)).toBe(true);
    expect(isUiTargetSessionV1({ schema: "ui-target-picker/session", schemaVersion: 2 })).toBe(
      false,
    );
  });
});

describe("text formatter", () => {
  it("renders one aligned block per target", () => {
    const text = formatSessionAsText(sessionWith(makeTarget()));

    expect(text).toBe(
      [
        "[UI-TARGET 1]",
        "catturato:    10:24:31 UTC",
        "rotta:        /orders/import",
        "componenti:   App > Shell > ImportPage > ImportProblems",
        "selettore:    app-import-problems",
        "elemento:     button.rail__groupheader",
        'percorso DOM: [data-testid="group"] > [data-testid="group-toggle"]',
        "ruolo:        button",
        'stato:        type="button", aria-expanded="false"',
        'testo:        "Brand non riconosciuto"',
        'riferimenti:  data-testid="group-toggle"',
        "box:          353x54 px @ x:413, y:588 - viewport 1920x945",
      ].join("\n"),
    );
  });

  it("omits rows that have no value", () => {
    const text = formatSessionAsText(
      sessionWith(makeTarget({ component: undefined, semantics: undefined, content: undefined })),
    );

    expect(text).not.toContain("componenti");
    expect(text).not.toContain("ruolo");
    expect(text).not.toContain("testo");
  });

  it("separates targets with a blank line and numbers them from one", () => {
    const text = formatSessionAsText(sessionWith(makeTarget(), makeTarget()));

    expect(text).toContain("[UI-TARGET 1]");
    expect(text).toContain("[UI-TARGET 2]");
    expect(text.split("\n\n")).toHaveLength(2);
  });

  it("renders the clock in UTC, independent of the machine locale", () => {
    const text = formatSessionAsText(
      sessionWith(makeTarget({ capturedAt: "2026-01-02T23:04:05.000Z" })),
    );

    expect(text).toContain("catturato:    23:04:05 UTC");
  });

  it("flags truncated text and boolean states", () => {
    const text = formatSessionAsText(
      sessionWith(
        makeTarget({
          semantics: { states: [{ name: "disabled", value: true }] },
          content: { text: "Brand", textTruncated: true },
        }),
      ),
    );

    expect(text).toContain('testo:        "Brand" (troncato)');
    expect(text).toContain("stato:        disabled");
  });
});

describe("formatSession", () => {
  it("dispatches on the requested format", () => {
    const session = sessionWith(makeTarget());

    expect(formatSession(session, "json")).toBe(formatSessionAsJson(session));
    expect(formatSession(session, "text")).toBe(formatSessionAsText(session));
  });
});
