import {
  BUDGETS,
  createSessionStore,
  InvalidConfigurationError,
  reduceTargetToBudget,
  sessionJsonBytes,
  targetJsonBytes,
  type UiTargetV1,
} from "@ui-target-picker/core";
import { describe, expect, it } from "vitest";

import { makeTarget } from "./fixtures.js";

/** A target whose reducible parts are large enough to make byte budgets bite. */
function bulkyTarget(): UiTargetV1 {
  return makeTarget({
    component: {
      adapter: "angular",
      name: "ImportProblems",
      ancestry: Array.from({ length: 16 }, (_entry, index) =>
        `Ancestor${String(index)}`.padEnd(128, "a"),
      ),
    },
    element: {
      tag: "button",
      signature: "button.rail",
      domPath: Array.from({ length: 12 }, (_segment, index) =>
        `div.level${String(index)}`.padEnd(256, "b"),
      ).join(" > "),
    },
  });
}

describe("createSessionStore", () => {
  it("starts empty and exposes a valid session", () => {
    const store = createSessionStore();

    expect(store.size()).toBe(0);
    expect(store.getSession()).toEqual({
      schema: "ui-target-picker/session",
      schemaVersion: 1,
      targets: [],
    });
  });

  it.each([0, 21, 2.5])("rejects maxTargets %s", (maxTargets) => {
    expect(() => createSessionStore({ maxTargets })).toThrow(InvalidConfigurationError);
  });

  it("appends targets in capture order", () => {
    const store = createSessionStore();

    const first = store.add(makeTarget({ capturedAt: "2026-08-26T10:00:00.000Z" }));
    const second = store.add(makeTarget({ capturedAt: "2026-08-26T10:00:01.000Z" }));

    expect(first.ok && first.value.index).toBe(0);
    expect(second.ok && second.value.index).toBe(1);
    expect(store.getSession().targets.map((target) => target.capturedAt)).toEqual([
      "2026-08-26T10:00:00.000Z",
      "2026-08-26T10:00:01.000Z",
    ]);
  });

  it("refuses captures past the configured limit", () => {
    const store = createSessionStore({ maxTargets: 1 });
    store.add(makeTarget());

    const result = store.add(makeTarget());

    expect(result).toEqual({
      ok: false,
      error: { code: "TARGET_LIMIT_REACHED", recoverable: true },
    });
    expect(store.size()).toBe(1);
  });

  it("returns deeply immutable snapshots", () => {
    const store = createSessionStore();
    store.add(makeTarget());
    const session = store.getSession();

    expect(Object.isFrozen(session)).toBe(true);
    expect(Object.isFrozen(session.targets)).toBe(true);
    expect(Object.isFrozen(session.targets[0])).toBe(true);
    expect(() => {
      (session.targets as unknown[]).push({});
    }).toThrow();
  });

  it("keeps a single undo level for removal", () => {
    const store = createSessionStore();
    store.add(makeTarget({ capturedAt: "2026-08-26T10:00:00.000Z" }));
    store.add(makeTarget({ capturedAt: "2026-08-26T10:00:01.000Z" }));

    const removed = store.removeAt(0);

    expect(removed?.capturedAt).toBe("2026-08-26T10:00:00.000Z");
    expect(store.size()).toBe(1);
    expect(store.canUndo()).toBe(true);
    expect(store.undo()).toBe(true);
    expect(store.size()).toBe(2);
    expect(store.canUndo()).toBe(false);
    expect(store.undo()).toBe(false);
  });

  it("reports how many targets a clear removed and can undo it", () => {
    const store = createSessionStore();
    store.add(makeTarget());
    store.add(makeTarget());

    expect(store.clear()).toBe(2);
    expect(store.size()).toBe(0);
    expect(store.undo()).toBe(true);
    expect(store.size()).toBe(2);
  });

  it("invalidates the undo snapshot on the next capture", () => {
    const store = createSessionStore();
    store.add(makeTarget());
    store.clear();

    store.add(makeTarget());

    expect(store.canUndo()).toBe(false);
  });

  it("ignores a removal outside the session", () => {
    const store = createSessionStore();

    expect(store.removeAt(3)).toBeUndefined();
    expect(store.canUndo()).toBe(false);
  });
});

describe("target budget", () => {
  it("leaves a target that already fits untouched", () => {
    const target = makeTarget();

    expect(reduceTargetToBudget(target, BUDGETS.targetJsonBytes)).toBe(target);
  });

  it("drops text and outer ancestry before touching the DOM path", () => {
    const target = bulkyTarget();

    const reduced = reduceTargetToBudget(target, 5000);

    expect(reduced).toBeDefined();
    expect(targetJsonBytes(reduced as UiTargetV1)).toBeLessThanOrEqual(5000);
    expect(reduced?.content?.text).toBeUndefined();
    expect(reduced?.component?.ancestry?.length).toBeLessThan(16);
    expect(reduced?.element.domPath).toBe(target.element.domPath);
    expect(reduced?.redactions).toEqual([
      { field: "component.ancestry", action: "truncated", reason: "length-limit" },
      { field: "content.text", action: "omitted", reason: "length-limit" },
    ]);
  });

  it("shortens the DOM path from the outermost segment once ancestry is exhausted", () => {
    const target = bulkyTarget();

    const reduced = reduceTargetToBudget(target, 2000);

    expect(reduced).toBeDefined();
    expect(targetJsonBytes(reduced as UiTargetV1)).toBeLessThanOrEqual(2000);
    expect(reduced?.component?.ancestry).toHaveLength(1);
    expect(reduced?.element.domPath?.split(" > ").length).toBeLessThan(12);
    expect(reduced?.element.domPath?.endsWith("bbb")).toBe(true);
  });

  it("gives up when no reduction is enough", () => {
    expect(reduceTargetToBudget(makeTarget(), 10)).toBeUndefined();
  });

  it("rejects a target that stays over the per-target budget", () => {
    const store = createSessionStore();
    const oversized = makeTarget({
      element: {
        tag: "button",
        signature: `button#${"a".repeat(BUDGETS.targetJsonBytes)}`,
      },
    });

    expect(store.add(oversized)).toEqual({
      ok: false,
      error: { code: "TARGET_TOO_LARGE", recoverable: true },
    });
  });

  it("rejects a capture that would push the session over its byte budget", () => {
    const store = createSessionStore();
    const heavy = makeTarget({
      element: { tag: "button", signature: `button#${"a".repeat(7000)}` },
    });

    let lastResult = store.add(heavy);
    let guard = 0;
    while (lastResult.ok && guard < BUDGETS.maxTargetsPerSession) {
      lastResult = store.add(heavy);
      guard += 1;
    }

    expect(lastResult).toEqual({
      ok: false,
      error: { code: "SESSION_SIZE_LIMIT_REACHED", recoverable: true },
    });
    expect(sessionJsonBytes(store.getSession())).toBeLessThanOrEqual(BUDGETS.sessionJsonBytes);
  });
});
