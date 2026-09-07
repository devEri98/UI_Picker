// @vitest-environment jsdom
import {
  buildDomPath,
  buildSignature,
  escapeAttributeValue,
  significantClasses,
} from "@ui-target-picker/browser";
import { createRedactionEngine, resolvePrivacyPolicy } from "@ui-target-picker/core";
import { describe, expect, it } from "vitest";

import { mount } from "./dom.js";

function engine(
  preset: "balanced" | "strict" = "balanced",
): ReturnType<typeof createRedactionEngine> {
  return createRedactionEngine(resolvePrivacyPolicy({ preset }));
}

describe("significantClasses", () => {
  it("keeps DOM order, deduplicates and drops framework prefixes", () => {
    const query = mount(
      '<div class="rail__group ng-star-inserted cdk-focused _nghost-abc rail__group rail__row"></div>',
    );

    expect(significantClasses(query("div"), {}, 5)).toEqual(["rail__group", "rail__row"]);
  });

  it("honours a custom prefix list", () => {
    const query = mount('<div class="js-hook rail__group"></div>');

    expect(significantClasses(query("div"), { excludedClassPrefixes: ["js-"] })).toEqual([
      "rail__group",
    ]);
  });
});

describe("buildSignature", () => {
  it("composes tag, id and the first two significant classes", () => {
    const query = mount('<button id="save" class="btn btn--primary btn--large"></button>');

    expect(buildSignature(query("button"), engine())).toEqual({
      tag: "button",
      signature: "button#save.btn.btn--primary",
    });
  });

  it("falls back to the tag alone under the strict preset", () => {
    const query = mount('<button id="user-42" class="btn"></button>');

    expect(buildSignature(query("button"), engine("strict")).signature).toBe("button");
  });

  it("escapes hostile identifiers", () => {
    const query = mount("<div></div>");
    const element = query("div");
    element.setAttribute("id", 'a"b\\c');

    expect(buildSignature(element, engine()).signature).toBe('div#a\\"b\\\\c');
  });
});

describe("buildDomPath", () => {
  it("prefers data-testid, then id, then tag and classes", () => {
    const query = mount(
      '<div id="root"><ul class="rail__grouplist ng-star-inserted">' +
        '<li data-testid="group"><span id="label"><em class="mark"></em></span></li>' +
        "</ul></div>",
    );

    expect(buildDomPath(query("em"), query("#root")).path).toBe(
      'ul.rail__grouplist > [data-testid="group"] > #label > em.mark',
    );
  });

  it("adds nth-of-type only when siblings share the tag", () => {
    const query = mount('<div id="root"><p>uno</p><p>due</p><section><b>solo</b></section></div>');

    expect(buildDomPath(query("section"), query("#root")).path).toBe("section");
    expect(buildDomPath(query("p:nth-of-type(2)"), query("#root")).path).toBe("p:nth-of-type(2)");
  });

  it("escapes quotes and backslashes inside a test id", () => {
    const query = mount('<div id="root"><span></span></div>');
    const span = query("span");
    span.setAttribute("data-testid", 'a"b\\c');

    expect(buildDomPath(span, query("#root")).path).toBe('[data-testid="a\\"b\\\\c"]');
    expect(escapeAttributeValue('a"b\\c')).toBe('a\\"b\\\\c');
  });

  it("keeps the innermost segments and reports truncation", () => {
    const depth = 20;
    let html = '<div id="root">';
    for (let level = 0; level < depth; level += 1) {
      html += `<div class="level${String(level)}">`;
    }
    html += '<span class="leaf"></span>';
    html += "</div>".repeat(depth + 1);
    const query = mount(html);

    const result = buildDomPath(query(".leaf"), query("#root"));

    expect(result.truncated).toBe(true);
    expect(result.path.split(" > ")).toHaveLength(12);
    expect(result.path.endsWith("span.leaf")).toBe(true);
    expect(result.path.startsWith("div.level9")).toBe(true);
  });

  it("returns an empty path when the element is the root", () => {
    const query = mount('<div id="root"></div>');

    expect(buildDomPath(query("#root"), query("#root"))).toEqual({ path: "", truncated: false });
  });
});
