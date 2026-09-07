// @vitest-environment jsdom
import {
  collectVisibleText,
  isSelectableTarget,
  isSensitiveBoundary,
} from "@ui-target-picker/browser";
import { describe, expect, it } from "vitest";

import { mount } from "./dom.js";

describe("isSensitiveBoundary", () => {
  it.each(["input", "textarea", "select", "option", "script", "style", "template", "noscript"])(
    "treats <%s> as a boundary",
    (tag) => {
      const query = mount(`<div><${tag}></${tag}></div>`);

      expect(isSensitiveBoundary(query(tag))).toBe(true);
    },
  );

  it("treats editable hosts and text roles as boundaries", () => {
    const query = mount(
      '<div id="editable" contenteditable="true"></div>' +
        '<div id="textbox" role="textbox"></div>' +
        '<div id="searchbox" role="searchbox"></div>' +
        '<div id="plain" contenteditable="false"></div>',
    );

    expect(isSensitiveBoundary(query("#editable"))).toBe(true);
    expect(isSensitiveBoundary(query("#textbox"))).toBe(true);
    expect(isSensitiveBoundary(query("#searchbox"))).toBe(true);
    expect(isSensitiveBoundary(query("#plain"))).toBe(false);
  });

  it("accepts extra boundaries declared by the integrator", () => {
    const query = mount('<div class="secret"></div>');

    expect(isSensitiveBoundary(query(".secret"))).toBe(false);
    expect(isSensitiveBoundary(query(".secret"), { sensitiveSelectors: [".secret"] })).toBe(true);
  });

  it("ignores an invalid extra selector instead of throwing", () => {
    const query = mount("<div></div>");

    expect(isSensitiveBoundary(query("div"), { sensitiveSelectors: ["!!!"] })).toBe(false);
  });

  it("never treats a label as a boundary", () => {
    const query = mount('<label for="a">Nome</label>');

    expect(isSensitiveBoundary(query("label"))).toBe(false);
  });
});

describe("isSelectableTarget", () => {
  it("accepts html, body, SVG and disabled controls", () => {
    const query = mount("<svg><rect></rect></svg><button disabled>Salva</button>");

    expect(isSelectableTarget(document.documentElement)).toBe(true);
    expect(isSelectableTarget(document.body)).toBe(true);
    expect(isSelectableTarget(query("rect"))).toBe(true);
    expect(isSelectableTarget(query("button"))).toBe(true);
  });

  it("rejects a detached element", () => {
    const detached = document.createElement("div");

    expect(isSelectableTarget(detached)).toBe(false);
  });

  it("rejects the picker's own UI", () => {
    const query = mount('<div id="picker"><button id="copy">Copia</button></div>');
    const pickerRoot = query("#picker");

    expect(isSelectableTarget(query("#copy"), { pickerRoot })).toBe(false);
    expect(isSelectableTarget(pickerRoot, { pickerRoot })).toBe(false);
  });

  it("rejects an element from another document", () => {
    const query = mount("<div></div>");
    const other = document.implementation.createHTMLDocument("other");

    expect(isSelectableTarget(query("div"), { document: other })).toBe(false);
  });
});

describe("collectVisibleText", () => {
  it("reads only admitted text nodes, in document order", () => {
    const query = mount('<div id="card"><span>Brand</span> non <b>riconosciuto</b></div>');

    expect(collectVisibleText(query("#card")).replace(/\s+/gu, " ").trim()).toBe(
      "Brand non riconosciuto",
    );
  });

  it("skips the whole subtree of a nested sensitive boundary", () => {
    const query = mount(
      '<div id="row">Etichetta' +
        '<input value="CANARY_INPUT" placeholder="CANARY_PLACEHOLDER">' +
        "<textarea>CANARY_TEXTAREA</textarea>" +
        "<select><option>CANARY_OPTION</option></select>" +
        '<div contenteditable="true">CANARY_EDITABLE</div>' +
        "</div>",
    );

    const text = collectVisibleText(query("#row"));

    expect(text).toContain("Etichetta");
    expect(text).not.toContain("CANARY");
  });

  it("skips boundaries nested several levels deep", () => {
    const query = mount(
      '<div id="root"><section><div><p>Visibile</p>' +
        "<div><span><textarea>CANARY_DEEP</textarea></span></div>" +
        "</div></section></div>",
    );

    const text = collectVisibleText(query("#root"));

    expect(text).toContain("Visibile");
    expect(text).not.toContain("CANARY_DEEP");
  });

  it("skips hidden and aria-hidden subtrees", () => {
    const query = mount(
      '<div id="root">Visibile<span hidden>CANARY_HIDDEN</span>' +
        '<span aria-hidden="true">CANARY_ARIA</span></div>',
    );

    const text = collectVisibleText(query("#root"));

    expect(text).toContain("Visibile");
    expect(text).not.toContain("CANARY");
  });

  it("returns nothing when the root itself is sensitive", () => {
    const query = mount('<label>Nome<input value="CANARY"></label>');

    expect(collectVisibleText(query("input"))).toBe("");
    expect(collectVisibleText(query("label"))).toContain("Nome");
    expect(collectVisibleText(query("label"))).not.toContain("CANARY");
  });
});
