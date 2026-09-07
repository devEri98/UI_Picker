import { createUiTargetPicker } from "@ui-target-picker/browser";
import { formatSession } from "@ui-target-picker/core";

const EMPTY_HINT = "Nessun target. Tieni premuto Alt e seleziona un elemento.";
const FORMAT_LABELS = { text: "Testo", json: "JSON" };

const output = document.querySelector("[data-output]");
const feedback = document.querySelector("[data-feedback]");
const toggleButton = document.querySelector('[data-action="toggle"]');
const copyButton = document.querySelector('[data-action="copy"]');

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

function selectedFormat() {
  return document.querySelector('input[name="format"]:checked')?.value ?? "text";
}

function say(message, tone = "info") {
  feedback.textContent = message;
  feedback.dataset.tone = tone;
}

function render(state) {
  for (const [key, value] of Object.entries({
    lifecycle: state.lifecycle,
    selectionMode: state.selectionMode,
    copyState: state.copyState,
    targetCount: `${String(state.targetCount)}/${String(state.maxTargets)}`,
  })) {
    const cell = document.querySelector(`[data-state="${key}"]`);
    if (cell !== null) {
      cell.textContent = value;
    }
  }

  toggleButton.textContent = state.lifecycle === "enabled" ? "Disattiva picker" : "Attiva picker";
  copyButton.disabled = state.copyState === "pending" || state.targetCount === 0;

  const session = picker.getSession();
  output.textContent =
    session.targets.length === 0 ? EMPTY_HINT : formatSession(session, selectedFormat());

  if (state.lastError !== undefined) {
    say(`Errore: ${state.lastError.code}`, state.lastError.recoverable ? "warn" : "error");
  }
}

picker.subscribe(render);

toggleButton.addEventListener("click", () => {
  if (picker.getState().lifecycle === "enabled") {
    picker.disable();
    say("Picker disattivato. Nessun listener sull'applicazione.");
  } else {
    picker.enable();
    say("Picker attivo.");
  }
});

copyButton.addEventListener("click", () => {
  const format = selectedFormat();
  void picker.copy(format).then((result) => {
    if (result.ok) {
      say(
        `Copiati ${String(result.targetCount)} target in formato ${FORMAT_LABELS[result.format]}.`,
      );
      return;
    }
    say(`Copia non riuscita: ${result.error.code}`, "error");
  });
});

for (const radio of document.querySelectorAll('input[name="format"]')) {
  radio.addEventListener("change", () => {
    picker.setOutputFormat(selectedFormat());
    render(picker.getState());
  });
}

picker.enable();
render(picker.getState());
say("Picker attivo.");

// Exposed on purpose: the playground is a manual verification harness.
globalThis.uiTargetPicker = picker;
