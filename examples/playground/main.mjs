import { createUiTargetPicker } from "@ui-target-picker/browser";

/**
 * Selector-based stand-in for the Angular adapter.
 *
 * It reads only `data-component`, so it shows the resolver contract without
 * touching any framework internals.
 */
const resolver = {
  adapter: "playground",
  resolve(element) {
    const host = element.closest("[data-component]");
    if (host === null) {
      return { status: "unavailable", reason: "NO_COMPONENT" };
    }

    const ancestry = [];
    for (
      let current = host;
      current !== null;
      current = current.parentElement?.closest("[data-component]") ?? null
    ) {
      ancestry.unshift(current.dataset.component);
    }

    return {
      status: "resolved",
      value: {
        host,
        name: host.dataset.component,
        selector: `[data-component="${host.dataset.component}"]`,
        ancestry,
      },
    };
  },
};

const picker = createUiTargetPicker({ resolver, maxTargets: 20 });
picker.enable();

// Exposed on purpose: the playground is a manual verification harness.
globalThis.uiTargetPicker = picker;
