const HEX_RADIX = 16;
const NULL_REPLACEMENT = "�";
const LOW_CONTROL_END = 0x1f;
const DELETE = 0x7f;
const DIGIT_ZERO = 0x30;
const DIGIT_NINE = 0x39;
const DASH = 0x2d;
const UNDERSCORE = 0x5f;
const UPPER_A = 0x41;
const UPPER_Z = 0x5a;
const LOWER_A = 0x61;
const LOWER_Z = 0x7a;
const NON_ASCII_START = 0x80;

function isAsciiDigit(codePoint: number): boolean {
  return codePoint >= DIGIT_ZERO && codePoint <= DIGIT_NINE;
}

function isNameCodePoint(codePoint: number): boolean {
  return (
    isAsciiDigit(codePoint) ||
    (codePoint >= UPPER_A && codePoint <= UPPER_Z) ||
    (codePoint >= LOWER_A && codePoint <= LOWER_Z) ||
    codePoint === DASH ||
    codePoint === UNDERSCORE ||
    codePoint >= NON_ASCII_START
  );
}

/**
 * Spec-compliant `CSS.escape` fallback.
 *
 * The native implementation is preferred when present; both follow the same
 * CSSOM algorithm, so the escaped output is identical.
 */
export function escapeIdentifier(value: string): string {
  // Called through `CSS` on purpose: the native method rejects a detached receiver.
  const css = (globalThis as { CSS?: { escape?: (input: string) => string } }).CSS;
  if (typeof css?.escape === "function") {
    return css.escape(value);
  }

  let result = "";
  const characters = Array.from(value);

  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index] ?? "";
    const codePoint = character.codePointAt(0) ?? 0;

    if (codePoint === 0) {
      result += NULL_REPLACEMENT;
      continue;
    }
    if (
      codePoint <= LOW_CONTROL_END ||
      codePoint === DELETE ||
      (index === 0 && isAsciiDigit(codePoint)) ||
      (index === 1 && isAsciiDigit(codePoint) && characters[0] === "-")
    ) {
      result += `\\${codePoint.toString(HEX_RADIX)} `;
      continue;
    }
    if (index === 0 && codePoint === DASH && characters.length === 1) {
      result += `\\${character}`;
      continue;
    }
    if (isNameCodePoint(codePoint)) {
      result += character;
      continue;
    }
    result += `\\${character}`;
  }

  return result;
}

/**
 * Escape a value used inside a double quoted attribute selector.
 *
 * Values reaching this function are already normalised, so only the quote and
 * the backslash still need escaping.
 */
export function escapeAttributeValue(value: string): string {
  return value.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"');
}
