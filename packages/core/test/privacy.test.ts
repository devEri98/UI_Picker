import {
  createRedactionEngine,
  InvalidConfigurationError,
  REDACTED_PLACEHOLDER,
  resolvePrivacyPolicy,
  type RedactionDecision,
  type TrustedRedactor,
} from "@ui-target-picker/core";
import { describe, expect, it } from "vitest";

describe("resolvePrivacyPolicy", () => {
  it("defaults to the balanced preset", () => {
    expect(resolvePrivacyPolicy()).toEqual({
      preset: "balanced",
      includeSearch: false,
      includeHash: false,
      maxTextLength: 80,
    });
  });

  it("defaults the strict preset to no text at all", () => {
    expect(resolvePrivacyPolicy({ preset: "strict" }).maxTextLength).toBe(0);
  });

  it.each([
    ["maxTextLength above the budget", { maxTextLength: 81 }],
    ["fractional maxTextLength", { maxTextLength: 1.5 }],
    ["negative maxTextLength", { maxTextLength: -1 }],
    ["unknown preset", { preset: "loose" as "strict" }],
    ["non boolean includeSearch", { includeSearch: "yes" as unknown as boolean }],
  ])("rejects %s instead of correcting it", (_label, input) => {
    expect(() => resolvePrivacyPolicy(input)).toThrow(InvalidConfigurationError);
  });
});

describe("built-in redaction", () => {
  it("keeps balanced values and omits query and hash without opt-in", () => {
    const engine = createRedactionEngine(resolvePrivacyPolicy());

    expect(engine.apply("location.pathname", "/orders/import")).toEqual({
      kind: "value",
      value: "/orders/import",
      truncated: false,
    });
    expect(engine.apply("location.search", "?job=2")).toEqual({ kind: "omitted" });
    expect(engine.records()).toEqual([
      { field: "location.search", action: "omitted", reason: "default-policy" },
    ]);
  });

  it("keeps query and hash once the consumer opts in", () => {
    const engine = createRedactionEngine(
      resolvePrivacyPolicy({ includeSearch: true, includeHash: true }),
    );

    expect(engine.apply("location.search", "?job=2")).toMatchObject({ value: "?job=2" });
    expect(engine.apply("location.hash", "#problems")).toMatchObject({ value: "#problems" });
    expect(engine.records()).toEqual([]);
  });

  it("replaces the pathname and drops identifiers under the strict preset", () => {
    const engine = createRedactionEngine(resolvePrivacyPolicy({ preset: "strict" }));

    expect(engine.apply("location.pathname", "/orders/import")).toMatchObject({
      value: REDACTED_PLACEHOLDER,
    });
    expect(engine.apply("element.id", "user-42")).toEqual({ kind: "omitted" });
    expect(engine.apply("element.class", "rail__group")).toEqual({ kind: "omitted" });
    expect(engine.apply("element.domPath", 'div > [data-testid="x"]')).toEqual({
      kind: "omitted",
    });
    expect(engine.apply("content.text", "Brand")).toEqual({ kind: "omitted" });
    expect(engine.apply("content.reference", "group-toggle")).toEqual({ kind: "omitted" });
    expect(engine.apply("component.name", "ImportProblems")).toMatchObject({
      value: "ImportProblems",
    });
  });

  it("records a truncation only when the limit actually cut the value", () => {
    const engine = createRedactionEngine(resolvePrivacyPolicy({ maxTextLength: 5 }));

    expect(engine.apply("content.text", "abcdefgh")).toEqual({
      kind: "value",
      value: "abcde",
      truncated: true,
    });
    expect(engine.records()).toEqual([
      { field: "content.text", action: "truncated", reason: "length-limit" },
    ]);
  });

  it("does not record anything for a value that was empty to begin with", () => {
    const engine = createRedactionEngine(resolvePrivacyPolicy());

    expect(engine.apply("location.search", "   ")).toEqual({ kind: "omitted" });
    expect(engine.records()).toEqual([]);
  });
});

describe("custom redactor", () => {
  it("runs after the built-in policy and can omit a value", () => {
    const redact: TrustedRedactor = (candidate) =>
      candidate.field === "content.text" ? { action: "omit" } : { action: "keep" };
    const engine = createRedactionEngine(resolvePrivacyPolicy({ redact }));

    expect(engine.apply("content.text", "secret")).toEqual({ kind: "omitted" });
    expect(engine.records()).toEqual([
      { field: "content.text", action: "omitted", reason: "custom-policy" },
    ]);
  });

  it("applies a valid replacement", () => {
    const engine = createRedactionEngine(
      resolvePrivacyPolicy({ redact: () => ({ action: "replace", value: "masked" }) }),
    );

    expect(engine.apply("element.id", "user-42")).toMatchObject({ value: "masked" });
    expect(engine.records()).toEqual([
      { field: "element.id", action: "replaced", reason: "custom-policy" },
    ]);
  });

  it.each<[string, TrustedRedactor]>([
    [
      "throws",
      () => {
        throw new Error("boom");
      },
    ],
    ["returns a non conforming value", () => "nope" as unknown as RedactionDecision],
    ["returns an empty replacement", () => ({ action: "replace", value: "   " })],
    ["returns a replacement over budget", () => ({ action: "replace", value: "x".repeat(1000) })],
  ])("fails closed when the callback %s", (_label, redact) => {
    const engine = createRedactionEngine(resolvePrivacyPolicy({ redact }));

    expect(engine.apply("element.id", "user-42")).toEqual({ kind: "omitted" });
    expect(engine.records()).toEqual([
      { field: "element.id", action: "omitted", reason: "custom-policy" },
    ]);
  });

  it("keeps a usable pathname when the callback omits or fails", () => {
    const engine = createRedactionEngine(
      resolvePrivacyPolicy({ redact: () => ({ action: "omit" }) }),
    );

    expect(engine.apply("location.pathname", "/orders/import")).toEqual({
      kind: "value",
      value: REDACTED_PLACEHOLDER,
      truncated: false,
    });
    expect(engine.records()).toEqual([
      { field: "location.pathname", action: "replaced", reason: "custom-policy" },
    ]);
  });

  it("cannot re-enable a value the built-in policy removed", () => {
    const engine = createRedactionEngine(
      resolvePrivacyPolicy({ preset: "strict", redact: () => ({ action: "keep" }) }),
    );

    expect(engine.apply("content.text", "secret")).toEqual({ kind: "omitted" });
  });

  it("never receives an element or window handle", () => {
    const seen: unknown[] = [];
    const engine = createRedactionEngine(
      resolvePrivacyPolicy({
        redact: (candidate) => {
          seen.push(candidate);
          return { action: "keep" };
        },
      }),
    );

    engine.apply("element.id", "user-42");

    expect(seen).toEqual([{ field: "element.id", value: "user-42" }]);
  });
});

describe("redaction records", () => {
  it("deduplicates and sorts by field then action", () => {
    const engine = createRedactionEngine(resolvePrivacyPolicy({ preset: "strict" }));

    engine.apply("content.text", "one");
    engine.apply("content.text", "two");
    engine.apply("element.id", "user-42");
    engine.omitSensitive("content.text");

    expect(engine.records()).toEqual([
      { field: "content.text", action: "omitted", reason: "default-policy" },
      { field: "content.text", action: "omitted", reason: "sensitive-element" },
      { field: "element.id", action: "omitted", reason: "default-policy" },
    ]);
  });
});
