import type { UiTargetV1 } from "@ui-target-picker/core";

/** Overrides may explicitly set a property to `undefined` to drop it. */
type TargetOverrides = { [Key in keyof UiTargetV1]?: UiTargetV1[Key] | undefined };

export function makeTarget(overrides: TargetOverrides = {}): UiTargetV1 {
  const target: Record<string, unknown> = {
    capturedAt: "2026-08-26T10:24:31.000Z",
    location: { pathname: "/orders/import" },
    component: {
      adapter: "angular",
      name: "ImportProblems",
      selector: "app-import-problems",
      ancestry: ["App", "Shell", "ImportPage", "ImportProblems"],
    },
    element: {
      tag: "button",
      signature: "button.rail__groupheader",
      domPath: '[data-testid="group"] > [data-testid="group-toggle"]',
    },
    semantics: {
      role: "button",
      states: [
        { name: "type", value: "button" },
        { name: "aria-expanded", value: "false" },
      ],
    },
    content: {
      text: "Brand non riconosciuto",
      references: [{ name: "data-testid", value: "group-toggle" }],
    },
    geometry: {
      x: 413,
      y: 588,
      width: 353,
      height: 54,
      viewportWidth: 1920,
      viewportHeight: 945,
    },
  };

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete target[key];
    } else {
      target[key] = value;
    }
  }

  return target as unknown as UiTargetV1;
}
