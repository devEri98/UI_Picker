import {
  BUDGETS,
  createRedactionEngine,
  resolvePrivacyPolicy,
  resolverFailed,
  TARGET_NOT_SELECTABLE,
  type PickerError,
  type PrivacyPolicy,
  type RedactionEngine,
  type UiComponentV1,
  type UiContentV1,
  type UiElementV1,
  type UiLocationV1,
  type UiNameValueV1,
  type UiSemanticsV1,
  type UiTargetV1,
} from "@ui-target-picker/core";

import { isSelectableTarget, isSensitiveBoundary } from "../boundaries.js";
import { runResolver, isValidAdapterName, type ComponentResolver } from "../resolver.js";
import { buildDomPath } from "./dom-path.js";
import { buildSignature } from "./element.js";
import { readGeometry } from "./geometry.js";
import { readReferences, readRole, readStates } from "./semantics.js";
import { collectVisibleText } from "./visible-text.js";

export interface ExtractionOptions {
  readonly privacy?: Partial<PrivacyPolicy>;
  readonly resolver?: ComponentResolver;
  /** Injectable clock; tests pass a fixed one to get reproducible captures. */
  readonly now?: () => Date;
  /** Subtree owned by the picker UI: never a target and never read. */
  readonly pickerRoot?: Node;
  readonly excludedClassPrefixes?: readonly string[];
  readonly sensitiveSelectors?: readonly string[];
  readonly includeGeometry?: boolean;
}

export interface ExtractionSuccess {
  readonly ok: true;
  readonly value: UiTargetV1;
  /** Recoverable problems that did not prevent the DOM capture. */
  readonly warnings: readonly PickerError[];
  /** Set when a resolver reported a typed reason for having no component. */
  readonly resolverUnavailableReason?: string;
}

export type ExtractionResult =
  ExtractionSuccess | { readonly ok: false; readonly error: PickerError };

export interface TargetExtractor {
  readonly policy: PrivacyPolicy;
  extract(element: Element): ExtractionResult;
}

function buildLocation(engine: RedactionEngine, location: Location): UiLocationV1 {
  const pathname = engine.apply("location.pathname", location.pathname);
  const search = engine.apply("location.search", location.search);
  const hash = engine.apply("location.hash", location.hash);

  return {
    pathname: pathname.kind === "value" ? pathname.value : "/",
    ...(search.kind === "value" ? { search: search.value } : {}),
    ...(hash.kind === "value" ? { hash: hash.value } : {}),
  };
}

interface ComponentOutcome {
  readonly component?: UiComponentV1;
  readonly host?: Element;
  readonly warning?: PickerError;
  readonly unavailableReason?: string;
}

function buildComponent(
  engine: RedactionEngine,
  resolver: ComponentResolver | undefined,
  element: Element,
): ComponentOutcome {
  if (resolver === undefined) {
    return {};
  }
  if (!isValidAdapterName(resolver.adapter)) {
    return { warning: resolverFailed("invalid") };
  }

  const outcome = runResolver(resolver, element);
  if (outcome.status === "failed") {
    return { warning: resolverFailed(resolver.adapter) };
  }
  if (outcome.status === "unavailable") {
    return { unavailableReason: outcome.reason };
  }

  const name = engine.apply("component.name", outcome.value.name);
  if (name.kind !== "value") {
    // Without a name the component block carries no meaning.
    return { host: outcome.value.host };
  }

  const rawSelector = outcome.value.selector;
  const selector =
    rawSelector === undefined ? undefined : engine.apply("component.selector", rawSelector);

  const ancestry: string[] = [];
  for (const rawName of (outcome.value.ancestry ?? []).slice(0, BUDGETS.ancestryNames)) {
    const entry = engine.apply("component.ancestry", rawName);
    if (entry.kind === "value") {
      ancestry.push(entry.value);
    }
  }

  return {
    host: outcome.value.host,
    component: {
      adapter: resolver.adapter,
      name: name.value,
      ...(selector?.kind === "value" ? { selector: selector.value } : {}),
      ...(ancestry.length > 0 ? { ancestry } : {}),
    },
  };
}

function buildSemantics(engine: RedactionEngine, element: Element): UiSemanticsV1 | undefined {
  const rawRole = readRole(element);
  const role = rawRole === undefined ? undefined : engine.apply("semantics.role", rawRole);

  const states: UiNameValueV1[] = [];
  for (const state of readStates(element).slice(0, BUDGETS.states)) {
    if (typeof state.value === "boolean") {
      states.push({ name: state.name, value: state.value });
      continue;
    }
    const value = engine.apply("semantics.state", state.value);
    if (value.kind === "value") {
      states.push({ name: state.name, value: value.value });
    }
  }

  const semantics: UiSemanticsV1 = {
    ...(role?.kind === "value" ? { role: role.value } : {}),
    ...(states.length > 0 ? { states } : {}),
  };

  return semantics.role === undefined && semantics.states === undefined ? undefined : semantics;
}

function buildContent(
  engine: RedactionEngine,
  element: Element,
  options: ExtractionOptions,
): UiContentV1 | undefined {
  const boundaryOptions = {
    pickerRoot: options.pickerRoot,
    sensitiveSelectors: options.sensitiveSelectors,
  };

  let text: string | undefined;
  let truncated = false;

  if (isSensitiveBoundary(element, boundaryOptions)) {
    // The target itself can hold user input, so no text is collected at all.
    engine.omitSensitive("content.text");
  } else {
    const collected = collectVisibleText(element, boundaryOptions);
    const redacted = engine.apply("content.text", collected);
    if (redacted.kind === "value") {
      text = redacted.value;
      truncated = redacted.truncated;
    }
  }

  const references: UiNameValueV1[] = [];
  for (const reference of readReferences(element).slice(0, BUDGETS.references)) {
    const value = engine.apply("content.reference", String(reference.value));
    if (value.kind === "value") {
      references.push({ name: reference.name, value: value.value });
    }
  }

  if (text === undefined && references.length === 0) {
    return undefined;
  }

  return {
    ...(text === undefined ? {} : { text }),
    ...(references.length > 0 ? { references } : {}),
    ...(truncated ? { textTruncated: true as const } : {}),
  };
}

/**
 * Create a reusable extractor.
 *
 * The privacy policy is validated once here: an option outside the contract
 * makes the initialisation fail instead of being silently corrected.
 */
export function createTargetExtractor(options: ExtractionOptions = {}): TargetExtractor {
  const policy = resolvePrivacyPolicy(options.privacy);
  const now = options.now ?? ((): Date => new Date());

  return {
    policy,

    extract(element: Element): ExtractionResult {
      if (
        !isSelectableTarget(element, {
          pickerRoot: options.pickerRoot,
          sensitiveSelectors: options.sensitiveSelectors,
        })
      ) {
        return { ok: false, error: TARGET_NOT_SELECTABLE };
      }

      const view = element.ownerDocument.defaultView;
      if (view === null) {
        return { ok: false, error: TARGET_NOT_SELECTABLE };
      }

      const engine = createRedactionEngine(policy);
      const warnings: PickerError[] = [];

      const location = buildLocation(engine, view.location);
      const componentOutcome = buildComponent(engine, options.resolver, element);
      if (componentOutcome.warning !== undefined) {
        warnings.push(componentOutcome.warning);
      }

      const signature = buildSignature(element, engine, {
        excludedClassPrefixes: options.excludedClassPrefixes,
      });

      const root = componentOutcome.host ?? element.ownerDocument.body;
      const domPath = buildDomPath(element, root, {
        excludedClassPrefixes: options.excludedClassPrefixes,
      });
      if (domPath.truncated) {
        engine.recordLengthLimit("element.domPath", "truncated");
      }
      const redactedPath =
        domPath.path.length === 0 ? undefined : engine.apply("element.domPath", domPath.path);

      const elementModel: UiElementV1 = {
        tag: signature.tag,
        signature: signature.signature,
        ...(redactedPath?.kind === "value" ? { domPath: redactedPath.value } : {}),
      };

      const semantics = buildSemantics(engine, element);
      const content = buildContent(engine, element, options);
      const geometry = options.includeGeometry === false ? undefined : readGeometry(element, view);
      const redactions = engine.records();

      const value: UiTargetV1 = {
        capturedAt: now().toISOString(),
        location,
        ...(componentOutcome.component === undefined
          ? {}
          : { component: componentOutcome.component }),
        element: elementModel,
        ...(semantics === undefined ? {} : { semantics }),
        ...(content === undefined ? {} : { content }),
        ...(geometry === undefined ? {} : { geometry }),
        ...(redactions.length > 0 ? { redactions } : {}),
      };

      return {
        ok: true,
        value,
        warnings,
        ...(componentOutcome.unavailableReason === undefined
          ? {}
          : { resolverUnavailableReason: componentOutcome.unavailableReason }),
      };
    },
  };
}

/** One-shot extraction; prefer `createTargetExtractor` when capturing repeatedly. */
export function extractUiTarget(
  element: Element,
  options: ExtractionOptions = {},
): ExtractionResult {
  return createTargetExtractor(options).extract(element);
}
