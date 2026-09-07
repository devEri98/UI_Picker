const WHITESPACE = /\s+/gu;

const encoder = new TextEncoder();

const C0_END = 0x1f;
const DELETE = 0x7f;
const C1_END = 0x9f;

/**
 * Remove C0 and C1 control characters.
 *
 * Whitespace controls are collapsed before this runs, so what is left is never
 * meaningful text. Format characters such as ZWJ are preserved on purpose, so
 * that emoji sequences survive normalisation intact.
 */
function stripControlCharacters(value: string): string {
  let result = "";
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= C0_END || (codePoint >= DELETE && codePoint <= C1_END)) {
      continue;
    }
    result += character;
  }
  return result;
}

/**
 * Normalise a raw string that was already collected from the DOM.
 *
 * Internal whitespace collapses to a single space, control characters are
 * dropped and the result is normalised to Unicode NFC.
 */
export function normalizeString(value: string): string {
  return stripControlCharacters(value.replace(WHITESPACE, " ")).trim().normalize("NFC");
}

/** Split into Unicode code points; budgets count code points, not UTF-16 units. */
export function toCodePoints(value: string): readonly string[] {
  return Array.from(value);
}

export function countCodePoints(value: string): number {
  let count = 0;
  for (const _codePoint of value) {
    count += 1;
  }
  return count;
}

export interface ClampResult {
  readonly value: string;
  readonly truncated: boolean;
}

/**
 * Cut a string down to `maxCodePoints` without splitting a surrogate pair.
 *
 * `truncated` is true only when the limit actually removed something.
 */
export function clampCodePoints(value: string, maxCodePoints: number): ClampResult {
  if (maxCodePoints <= 0) {
    return { value: "", truncated: value.length > 0 };
  }
  const codePoints = toCodePoints(value);
  if (codePoints.length <= maxCodePoints) {
    return { value, truncated: false };
  }
  return { value: codePoints.slice(0, maxCodePoints).join(""), truncated: true };
}

/** UTF-8 byte length, used by every byte budget. */
export function utf8ByteLength(value: string): number {
  return encoder.encode(value).length;
}
