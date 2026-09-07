import { BUDGETS } from "./budgets.js";
import { sessionJsonBytes, targetJsonBytes } from "./canonical.js";
import {
  fail,
  ok,
  SESSION_SIZE_LIMIT_REACHED,
  TARGET_LIMIT_REACHED,
  TARGET_TOO_LARGE,
  type PickerError,
  type Result,
} from "./errors.js";
import { InvalidConfigurationError } from "./privacy.js";
import { mergeRedactions } from "./redaction-records.js";
import {
  deepFreeze,
  SESSION_SCHEMA,
  SESSION_SCHEMA_VERSION,
  type UiContentV1,
  type UiRedactionV1,
  type UiTargetSessionV1,
  type UiTargetV1,
} from "./schema.js";

const DOM_PATH_SEPARATOR = " > ";

function withRedactions(target: UiTargetV1, additions: readonly UiRedactionV1[]): UiTargetV1 {
  return { ...target, redactions: mergeRedactions(target.redactions, additions) };
}

function replaceContent(target: UiTargetV1, content: UiContentV1 | undefined): UiTargetV1 {
  const { content: _existing, ...rest } = target;
  return content === undefined ? rest : { ...rest, content };
}

function withoutText(target: UiTargetV1): UiTargetV1 | undefined {
  const content = target.content;
  if (content?.text === undefined) {
    return undefined;
  }
  const { text: _text, textTruncated: _textTruncated, ...rest } = content;
  const nextContent = rest.references === undefined ? undefined : rest;
  return withRedactions(replaceContent(target, nextContent), [
    { field: "content.text", action: "omitted", reason: "length-limit" },
  ]);
}

function withShorterAncestry(target: UiTargetV1): UiTargetV1 | undefined {
  const ancestry = target.component?.ancestry;
  if (target.component === undefined || ancestry === undefined || ancestry.length <= 1) {
    return undefined;
  }
  return withRedactions(
    { ...target, component: { ...target.component, ancestry: ancestry.slice(1) } },
    [{ field: "component.ancestry", action: "truncated", reason: "length-limit" }],
  );
}

function withShorterDomPath(target: UiTargetV1): UiTargetV1 | undefined {
  const domPath = target.element.domPath;
  if (domPath === undefined) {
    return undefined;
  }
  const segments = domPath.split(DOM_PATH_SEPARATOR);
  if (segments.length <= 1) {
    const { domPath: _domPath, ...element } = target.element;
    return withRedactions({ ...target, element }, [
      { field: "element.domPath", action: "omitted", reason: "length-limit" },
    ]);
  }
  return withRedactions(
    {
      ...target,
      element: { ...target.element, domPath: segments.slice(1).join(DOM_PATH_SEPARATOR) },
    },
    [{ field: "element.domPath", action: "truncated", reason: "length-limit" }],
  );
}

function withoutReferences(target: UiTargetV1): UiTargetV1 | undefined {
  const content = target.content;
  if (content?.references === undefined) {
    return undefined;
  }
  const { references: _references, ...rest } = content;
  const nextContent = rest.text === undefined ? undefined : rest;
  return withRedactions(replaceContent(target, nextContent), [
    { field: "content.reference", action: "omitted", reason: "length-limit" },
  ]);
}

/**
 * Deterministic reduction ladder applied before rejecting an oversized target.
 *
 * Order is normative: text, outer ancestry, outer DOM path, optional references.
 */
const REDUCTIONS: readonly ((target: UiTargetV1) => UiTargetV1 | undefined)[] = [
  withoutText,
  withShorterAncestry,
  withShorterDomPath,
  withoutReferences,
];

export function reduceTargetToBudget(
  target: UiTargetV1,
  maxBytes: number = BUDGETS.targetJsonBytes,
): UiTargetV1 | undefined {
  let current = target;
  if (targetJsonBytes(current) <= maxBytes) {
    return current;
  }
  for (const reduce of REDUCTIONS) {
    let next = reduce(current);
    while (next !== undefined) {
      current = next;
      if (targetJsonBytes(current) <= maxBytes) {
        return current;
      }
      next = reduce(current);
    }
  }
  return undefined;
}

export interface SessionStoreOptions {
  readonly maxTargets?: number;
}

export interface AddedTarget {
  readonly target: UiTargetV1;
  readonly index: number;
}

export interface UiTargetSessionStore {
  readonly maxTargets: number;
  size(): number;
  canUndo(): boolean;
  /** Deeply immutable snapshot of the sanitised session. */
  getSession(): UiTargetSessionV1;
  add(target: UiTargetV1): Result<AddedTarget, PickerError>;
  /** Returns the removed target, or `undefined` when the index does not exist. */
  removeAt(index: number): UiTargetV1 | undefined;
  /** Empties the session and returns how many targets were removed. */
  clear(): number;
  /** Restores the single undo snapshot; false when there is nothing to restore. */
  undo(): boolean;
}

function buildSession(targets: readonly UiTargetV1[]): UiTargetSessionV1 {
  return deepFreeze({
    schema: SESSION_SCHEMA,
    schemaVersion: SESSION_SCHEMA_VERSION,
    targets: [...targets],
  });
}

export function createSessionStore(options?: SessionStoreOptions): UiTargetSessionStore {
  const maxTargets = options?.maxTargets ?? BUDGETS.maxTargetsPerSession;

  if (
    !Number.isInteger(maxTargets) ||
    maxTargets < BUDGETS.maxTargetsLowerBound ||
    maxTargets > BUDGETS.maxTargetsUpperBound
  ) {
    throw new InvalidConfigurationError([
      `maxTargets must be an integer between ${BUDGETS.maxTargetsLowerBound} and ${BUDGETS.maxTargetsUpperBound}`,
    ]);
  }

  let targets: readonly UiTargetV1[] = [];
  let undoSnapshot: readonly UiTargetV1[] | undefined;
  let snapshot: UiTargetSessionV1 = buildSession(targets);

  function commit(next: readonly UiTargetV1[]): void {
    targets = next;
    snapshot = buildSession(targets);
  }

  return {
    maxTargets,

    size() {
      return targets.length;
    },

    canUndo() {
      return undoSnapshot !== undefined;
    },

    getSession() {
      return snapshot;
    },

    add(target) {
      if (targets.length >= maxTargets) {
        return fail(TARGET_LIMIT_REACHED);
      }

      const reduced = reduceTargetToBudget(target);
      if (reduced === undefined) {
        return fail(TARGET_TOO_LARGE);
      }

      const next = [...targets, deepFreeze(reduced)];
      if (sessionJsonBytes(buildSession(next)) > BUDGETS.sessionJsonBytes) {
        return fail(SESSION_SIZE_LIMIT_REACHED);
      }

      // A capture invalidates the pending undo snapshot.
      undoSnapshot = undefined;
      commit(next);
      return ok({ target: reduced, index: next.length - 1 });
    },

    removeAt(index) {
      const removed = targets[index];
      if (removed === undefined) {
        return undefined;
      }
      undoSnapshot = targets;
      commit(targets.filter((_target, position) => position !== index));
      return removed;
    },

    clear() {
      const removedCount = targets.length;
      if (removedCount === 0) {
        return 0;
      }
      undoSnapshot = targets;
      commit([]);
      return removedCount;
    },

    undo() {
      if (undoSnapshot === undefined) {
        return false;
      }
      commit(undoSnapshot);
      undoSnapshot = undefined;
      return true;
    },
  };
}
