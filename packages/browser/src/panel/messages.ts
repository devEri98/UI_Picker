import type { OutputFormat, PickerError } from "@ui-target-picker/core";

import type { SelectionMode } from "../controller-types.js";

/** Product microcopy. Italian, as approved in the UX design. */
export const FORMAT_LABELS: Record<OutputFormat, string> = {
  text: "Testo",
  json: "JSON",
};

export const SELECTION_LABELS: Record<SelectionMode, string> = {
  inactive: "Inattivo",
  temporary: "Selezione temporanea",
  continuous: "Selezione continua attiva",
};

export const EMPTY_TITLE = "Nessun target";
export const EMPTY_HINT = "Tieni premuto Alt e seleziona un elemento.";
export const POSITION_RESET = "Posizione del pannello ripristinata.";
export const REDACTED_NOTE = "Contiene valori redatti.";

export function targetAdded(index: number): string {
  return `Target ${String(index)} aggiunto.`;
}

export function targetRemoved(): string {
  return "Target rimosso.";
}

export function sessionCleared(count: number): string {
  return `Rimossi ${String(count)} target.`;
}

export function undone(): string {
  return "Rimozione annullata.";
}

export function copySucceeded(count: number, format: OutputFormat): string {
  return `Copiati ${String(count)} target in formato ${FORMAT_LABELS[format]}.`;
}

/**
 * User facing text for a recoverable error.
 *
 * Every message names a cause and a way out: no error is reported only in the
 * console.
 */
export function errorMessage(error: PickerError, maxTargets: number): string {
  switch (error.code) {
    case "TARGET_NOT_SELECTABLE":
      return "Questo elemento non può essere selezionato.";
    case "TARGET_LIMIT_REACHED":
      return `Limite di ${String(maxTargets)} target raggiunto. Rimuovine uno per continuare.`;
    case "TARGET_TOO_LARGE":
      return "Questo target è troppo grande per la sessione.";
    case "SESSION_SIZE_LIMIT_REACHED":
      return "Sessione piena. Rimuovi un target per continuare.";
    case "RESOLVER_FAILED":
      return "Componente non rilevato; target DOM salvato.";
    case "CLIPBOARD_DENIED":
      return "Accesso alla clipboard negato. Seleziona e copia manualmente l'output.";
    case "CLIPBOARD_UNAVAILABLE":
      return "Clipboard non disponibile in questo contesto.";
    case "COPY_IN_PROGRESS":
      return "Copia già in corso.";
    case "COPY_TIMEOUT":
      return "La copia non ha risposto. Riprova.";
    case "CONTROLLER_DESTROYED":
      return "Il picker è stato chiuso.";
    default:
      return "Errore non gestito.";
  }
}
