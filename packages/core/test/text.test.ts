import {
  clampCodePoints,
  countCodePoints,
  normalizeString,
  utf8ByteLength,
} from "@ui-target-picker/core";
import { describe, expect, it } from "vitest";

describe("normalizeString", () => {
  it("collapses internal whitespace and trims", () => {
    expect(normalizeString("  Brand \n\t non   riconosciuto  ")).toBe("Brand non riconosciuto");
  });

  it("removes control characters", () => {
    const raw = `bell${String.fromCharCode(7)}text${String.fromCharCode(0)}`;
    expect(normalizeString(raw)).toBe("belltext");
  });

  it("normalises to Unicode NFC so equivalent inputs compare equal", () => {
    const composed = "caffé";
    const decomposed = "caffé";

    expect(decomposed).not.toBe(composed);
    expect(normalizeString(decomposed)).toBe(normalizeString(composed));
  });

  it("keeps zero width joiners so emoji sequences survive", () => {
    const family = "\u{1f468}‍\u{1f469}‍\u{1f467}";
    expect(normalizeString(family)).toBe(family);
  });
});

describe("clampCodePoints", () => {
  it("reports no truncation when the value fits", () => {
    expect(clampCodePoints("abc", 3)).toEqual({ value: "abc", truncated: false });
  });

  it("never splits an astral code point", () => {
    const result = clampCodePoints("\u{1f600}\u{1f601}\u{1f602}", 2);

    expect(result.truncated).toBe(true);
    expect(result.value).toBe("\u{1f600}\u{1f601}");
    expect(countCodePoints(result.value)).toBe(2);
  });

  it("drops everything when the limit is zero", () => {
    expect(clampCodePoints("abc", 0)).toEqual({ value: "", truncated: true });
    expect(clampCodePoints("", 0)).toEqual({ value: "", truncated: false });
  });
});

describe("utf8ByteLength", () => {
  it("counts UTF-8 bytes, not UTF-16 units", () => {
    expect(utf8ByteLength("abc")).toBe(3);
    expect(utf8ByteLength("é")).toBe(2);
    expect(utf8ByteLength("\u{1f600}")).toBe(4);
  });
});
