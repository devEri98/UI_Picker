import type {
  UiGeometryV1,
  UiNameValueV1,
  UiRedactionV1,
  UiTargetSessionV1,
  UiTargetV1,
} from "../schema.js";

/**
 * Human readable formatter.
 *
 * Labels are the Italian microcopy of the product; the rendering itself is
 * locale independent, so the same sanitised model always produces the same
 * bytes on any machine.
 */
const LABEL_WIDTH = 14;

function line(label: string, value: string | undefined): string | undefined {
  if (value === undefined || value.length === 0) {
    return undefined;
  }
  return `${`${label}:`.padEnd(LABEL_WIDTH, " ")}${value}`;
}

function formatClock(capturedAt: string): string {
  const parsed = new Date(capturedAt);
  if (Number.isNaN(parsed.getTime())) {
    return capturedAt;
  }
  return `${parsed.toISOString().slice(11, 19)} UTC`;
}

function formatRoute(target: UiTargetV1): string {
  return `${target.location.pathname}${target.location.search ?? ""}${target.location.hash ?? ""}`;
}

function formatComponents(target: UiTargetV1): string | undefined {
  const component = target.component;
  if (component === undefined) {
    return undefined;
  }
  const ancestry = component.ancestry;
  return ancestry === undefined || ancestry.length === 0 ? component.name : ancestry.join(" > ");
}

function formatPairs(pairs: readonly UiNameValueV1[] | undefined): string | undefined {
  if (pairs === undefined || pairs.length === 0) {
    return undefined;
  }
  return pairs
    .map((pair) => (pair.value === true ? pair.name : `${pair.name}="${String(pair.value)}"`))
    .join(", ");
}

function formatGeometry(geometry: UiGeometryV1 | undefined): string | undefined {
  if (geometry === undefined) {
    return undefined;
  }
  const box = `${String(geometry.width)}x${String(geometry.height)} px @ x:${String(geometry.x)}, y:${String(geometry.y)}`;
  const viewport = `viewport ${String(geometry.viewportWidth)}x${String(geometry.viewportHeight)}`;
  const scroll =
    geometry.scrollX === undefined && geometry.scrollY === undefined
      ? undefined
      : `scroll x:${String(geometry.scrollX ?? 0)}, y:${String(geometry.scrollY ?? 0)}`;
  return [box, viewport, scroll].filter((part) => part !== undefined).join(" - ");
}

function formatRedactions(redactions: readonly UiRedactionV1[] | undefined): string | undefined {
  if (redactions === undefined || redactions.length === 0) {
    return undefined;
  }
  return redactions
    .map((redaction) => `${redaction.field} ${redaction.action} (${redaction.reason})`)
    .join(", ");
}

function formatText(target: UiTargetV1): string | undefined {
  const text = target.content?.text;
  if (text === undefined) {
    return undefined;
  }
  return target.content?.textTruncated === true ? `"${text}" (troncato)` : `"${text}"`;
}

export function formatTargetAsText(target: UiTargetV1, index: number): string {
  const rows = [
    `[UI-TARGET ${String(index + 1)}]`,
    line("catturato", formatClock(target.capturedAt)),
    line("rotta", formatRoute(target)),
    line("componenti", formatComponents(target)),
    line("selettore", target.component?.selector),
    line("elemento", target.element.signature),
    line("percorso DOM", target.element.domPath),
    line("ruolo", target.semantics?.role),
    line("stato", formatPairs(target.semantics?.states)),
    line("testo", formatText(target)),
    line("riferimenti", formatPairs(target.content?.references)),
    line("box", formatGeometry(target.geometry)),
    line("redazioni", formatRedactions(target.redactions)),
  ];

  return rows.filter((row) => row !== undefined).join("\n");
}

/** Blocks are separated by one blank line; rows without a value are omitted. */
export function formatSessionAsText(session: UiTargetSessionV1): string {
  return session.targets.map((target, index) => formatTargetAsText(target, index)).join("\n\n");
}
