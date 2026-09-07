export type ClipboardFailureReason = "denied" | "unavailable";

export class ClipboardWriteError extends Error {
  readonly reason: ClipboardFailureReason;

  constructor(reason: ClipboardFailureReason) {
    super(`Clipboard write failed: ${reason}`);
    this.name = "ClipboardWriteError";
    this.reason = reason;
  }
}

export interface ClipboardWriter {
  /** Rejects with a `ClipboardWriteError` when the text could not be written. */
  write(text: string): Promise<void>;
}

const DENIED_ERROR_NAMES = new Set(["NotAllowedError", "SecurityError"]);

function isDenial(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    DENIED_ERROR_NAMES.has(String(error.name))
  );
}

/**
 * Synchronous fallback for contexts where the async Clipboard API is missing or
 * refused.
 *
 * It copies exactly the same redacted text: the fallback never widens what was
 * collected. Focus is restored afterwards, because a successful copy must not
 * move it.
 */
function writeWithExecCommand(doc: Document, text: string): boolean {
  if (typeof doc.execCommand !== "function") {
    return false;
  }

  const previousFocus = doc.activeElement;
  const textarea = doc.createElement("textarea");
  textarea.setAttribute("data-ui-target-picker", "clipboard");
  textarea.setAttribute("aria-hidden", "true");
  textarea.setAttribute("readonly", "readonly");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  textarea.value = text;

  doc.body.append(textarea);
  try {
    textarea.select();
    return doc.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
    if (previousFocus !== null && typeof (previousFocus as HTMLElement).focus === "function") {
      (previousFocus as HTMLElement).focus();
    }
  }
}

/**
 * Clipboard writer: async Clipboard API first, synchronous command second.
 *
 * A refusal by the async API is still worth retrying through the fallback,
 * which some browsers allow inside a user gesture; when neither works the
 * original refusal is reported so the UI can explain what happened.
 */
export function createClipboardWriter(doc: Document): ClipboardWriter {
  return {
    async write(text) {
      const clipboard = doc.defaultView?.navigator.clipboard;
      let denied = false;

      if (typeof clipboard?.writeText === "function") {
        try {
          await clipboard.writeText(text);
          return;
        } catch (error) {
          denied = isDenial(error);
        }
      }

      if (writeWithExecCommand(doc, text)) {
        return;
      }
      throw new ClipboardWriteError(denied ? "denied" : "unavailable");
    },
  };
}
