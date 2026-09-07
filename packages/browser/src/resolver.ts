import { BUDGETS, countCodePoints } from "@ui-target-picker/core";

export interface ComponentResolution {
  readonly host: Element;
  readonly name: string;
  readonly selector?: string;
  readonly ancestry?: readonly string[];
}

export type ComponentResolutionResult =
  | { readonly status: "resolved"; readonly value: ComponentResolution }
  | {
      readonly status: "unavailable";
      readonly reason: "DEBUG_GLOBALS_MISSING" | "NO_COMPONENT" | "UNSUPPORTED_VERSION";
    };

/**
 * Component resolver contract.
 *
 * Trust boundary: a resolver is privileged consumer code because it receives an
 * `Element` and can read the DOM. Its output is still treated as untrusted and
 * is validated, limited, redacted and escaped before storage.
 */
export interface ComponentResolver {
  readonly adapter: string;
  resolve(element: Element): ComponentResolutionResult;
}

const ASCII_IDENTIFIER = /^[\x20-\x7e]+$/u;

export function isValidAdapterName(adapter: unknown): adapter is string {
  return (
    typeof adapter === "string" &&
    adapter.length > 0 &&
    countCodePoints(adapter) <= BUDGETS.adapterCodePoints &&
    ASCII_IDENTIFIER.test(adapter)
  );
}

function isValidHost(host: unknown, element: Element): host is Element {
  if (typeof host !== "object" || host === null || !("nodeType" in host)) {
    return false;
  }
  const candidate = host as Element;
  return (
    candidate.nodeType === 1 &&
    candidate.isConnected &&
    candidate.ownerDocument === element.ownerDocument &&
    candidate.contains(element)
  );
}

export type ValidatedResolution =
  | { readonly status: "resolved"; readonly value: ComponentResolution }
  | { readonly status: "unavailable"; readonly reason: string }
  | { readonly status: "failed" };

/**
 * Run a resolver defensively.
 *
 * A throw, an invalid shape, a detached host, a cross-document host or a host
 * that is not an ancestor of the target all degrade to a failure: the component
 * is omitted and the DOM capture continues.
 */
export function runResolver(resolver: ComponentResolver, element: Element): ValidatedResolution {
  let outcome: ComponentResolutionResult;
  try {
    outcome = resolver.resolve(element);
  } catch {
    return { status: "failed" };
  }

  if (typeof outcome !== "object" || outcome === null) {
    return { status: "failed" };
  }
  if (outcome.status === "unavailable") {
    return typeof outcome.reason === "string"
      ? { status: "unavailable", reason: outcome.reason }
      : { status: "failed" };
  }
  if (outcome.status !== "resolved") {
    return { status: "failed" };
  }

  const value: unknown = outcome.value;
  if (typeof value !== "object" || value === null) {
    return { status: "failed" };
  }

  const resolution = value as Partial<ComponentResolution>;
  if (typeof resolution.name !== "string" || resolution.name.trim().length === 0) {
    return { status: "failed" };
  }
  if (!isValidHost(resolution.host, element)) {
    return { status: "failed" };
  }
  if (resolution.selector !== undefined && typeof resolution.selector !== "string") {
    return { status: "failed" };
  }
  if (
    resolution.ancestry !== undefined &&
    (!Array.isArray(resolution.ancestry) ||
      resolution.ancestry.some((entry) => typeof entry !== "string"))
  ) {
    return { status: "failed" };
  }

  return { status: "resolved", value: resolution as ComponentResolution };
}
