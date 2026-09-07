// @vitest-environment jsdom
import {
  ClipboardWriteError,
  createClipboardWriter,
  createUiTargetPicker,
  type ClipboardWriter,
  type UiTargetPickerController,
  type UiTargetPickerOptions,
} from "@ui-target-picker/browser";
import { formatSession } from "@ui-target-picker/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FIXED_CLOCK, mount } from "./dom.js";

const POINTER_ID = 5;

let picker: UiTargetPickerController | undefined;

function createPicker(options: UiTargetPickerOptions = {}): UiTargetPickerController {
  picker = createUiTargetPicker({ now: FIXED_CLOCK, ...options });
  return picker;
}

function captureOne(controller: UiTargetPickerController, element: Element): void {
  document.body.dispatchEvent(
    new KeyboardEvent("keydown", { code: "AltLeft", altKey: true, bubbles: true }),
  );
  for (const type of ["pointerdown", "pointerup"]) {
    element.dispatchEvent(
      new PointerEvent(type, {
        pointerId: POINTER_ID,
        isPrimary: true,
        button: 0,
        bubbles: true,
        cancelable: true,
        composed: true,
      }),
    );
  }
  if (controller.getSession().targets.length === 0) {
    throw new Error("capture did not happen");
  }
}

function deferredWriter(): {
  readonly writer: ClipboardWriter;
  readonly written: string[];
  resolve(): void;
  reject(error: unknown): void;
} {
  const written: string[] = [];
  let settle: { resolve: () => void; reject: (error: unknown) => void } | undefined;
  return {
    written,
    writer: {
      write(text) {
        written.push(text);
        return new Promise<void>((resolve, reject) => {
          settle = { resolve, reject };
        });
      },
    },
    resolve: () => settle?.resolve(),
    reject: (error) => settle?.reject(error),
  };
}

beforeEach(() => {
  window.history.replaceState({}, "", "/orders/import");
});

afterEach(() => {
  picker?.destroy();
  picker = undefined;
  vi.useRealTimers();
});

describe("createClipboardWriter", () => {
  it("uses the async Clipboard API when it is available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    await createClipboardWriter(document).write("testo");

    expect(writeText).toHaveBeenCalledWith("testo");
  });

  it("falls back to the synchronous command when the API refuses", async () => {
    const denial = Object.assign(new Error("nope"), { name: "NotAllowedError" });
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(denial) },
      configurable: true,
    });
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", { value: execCommand, configurable: true });

    await createClipboardWriter(document).write("testo");

    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("reports a denial when neither path works", async () => {
    const denial = Object.assign(new Error("nope"), { name: "NotAllowedError" });
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(denial) },
      configurable: true,
    });
    Object.defineProperty(document, "execCommand", {
      value: vi.fn().mockReturnValue(false),
      configurable: true,
    });

    await expect(createClipboardWriter(document).write("testo")).rejects.toMatchObject({
      reason: "denied",
    });
  });

  it("reports unavailable when no method exists at all", async () => {
    Object.defineProperty(window.navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(document, "execCommand", { value: undefined, configurable: true });

    await expect(createClipboardWriter(document).write("testo")).rejects.toBeInstanceOf(
      ClipboardWriteError,
    );
  });

  it("restores focus after the fallback", async () => {
    Object.defineProperty(window.navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(document, "execCommand", {
      value: vi.fn().mockReturnValue(true),
      configurable: true,
    });
    const query = mount('<button id="copy">Copia</button>');
    const button = query("#copy") as HTMLElement;
    button.focus();

    await createClipboardWriter(document).write("testo");

    expect(document.activeElement).toBe(button);
  });
});

describe("controller copy", () => {
  it("copies the formatted session and reports what it copied", async () => {
    const query = mount("<button>Salva</button>");
    const written: string[] = [];
    const controller = createPicker({
      clipboard: {
        write: (text) => {
          written.push(text);
          return Promise.resolve();
        },
      },
    });
    controller.enable();
    captureOne(controller, query("button"));

    const result = await controller.copy();

    expect(result).toEqual({ ok: true, format: "text", targetCount: 1 });
    expect(written).toEqual([formatSession(controller.getSession(), "text")]);
    expect(controller.getState().copyState).toBe("idle");
  });

  it("honours an explicit format without touching the targets", async () => {
    const query = mount("<button>Salva</button>");
    const written: string[] = [];
    const controller = createPicker({
      clipboard: {
        write: (text) => {
          written.push(text);
          return Promise.resolve();
        },
      },
    });
    controller.enable();
    captureOne(controller, query("button"));

    const result = await controller.copy("json");

    expect(result).toMatchObject({ ok: true, format: "json" });
    expect(written[0]).toBe(formatSession(controller.getSession(), "json"));
    expect(controller.getState().outputFormat).toBe("text");
    expect(controller.getSession().targets).toHaveLength(1);
  });

  it("switches the default format on request", async () => {
    const query = mount("<button>Salva</button>");
    const written: string[] = [];
    const controller = createPicker({
      clipboard: {
        write: (text) => {
          written.push(text);
          return Promise.resolve();
        },
      },
    });
    controller.enable();
    captureOne(controller, query("button"));

    controller.setOutputFormat("json");
    await controller.copy();

    expect(controller.getState().outputFormat).toBe("json");
    expect(written[0]).toBe(formatSession(controller.getSession(), "json"));
  });

  it("leaves the clipboard alone when the session is empty", async () => {
    const write = vi.fn();
    const controller = createPicker({ clipboard: { write } });
    controller.enable();

    expect(await controller.copy()).toEqual({ ok: true, format: "text", targetCount: 0 });
    expect(write).not.toHaveBeenCalled();
  });

  it("allows a single copy in flight", async () => {
    const query = mount("<button>Salva</button>");
    const deferred = deferredWriter();
    const controller = createPicker({ clipboard: deferred.writer });
    controller.enable();
    captureOne(controller, query("button"));

    const first = controller.copy();
    expect(controller.getState().copyState).toBe("pending");

    expect(await controller.copy()).toEqual({
      ok: false,
      error: { code: "COPY_IN_PROGRESS", recoverable: true },
    });

    deferred.resolve();
    expect(await first).toMatchObject({ ok: true });
    expect(controller.getState().copyState).toBe("idle");
  });

  it("copies the snapshot taken when the command started", async () => {
    const query = mount("<button>Salva</button><span>Altro</span>");
    const deferred = deferredWriter();
    const controller = createPicker({ clipboard: deferred.writer });
    controller.enable();
    captureOne(controller, query("button"));

    const pending = controller.copy();
    captureOne(controller, query("span"));
    deferred.resolve();

    expect(await pending).toMatchObject({ targetCount: 1 });
    expect(deferred.written[0]).not.toContain("span");
    expect(controller.getSession().targets).toHaveLength(2);
  });

  it("returns to idle when the write rejects", async () => {
    const query = mount("<button>Salva</button>");
    const denial = new ClipboardWriteError("denied");
    const controller = createPicker({ clipboard: { write: () => Promise.reject(denial) } });
    controller.enable();
    captureOne(controller, query("button"));

    const result = await controller.copy();

    expect(result).toEqual({
      ok: false,
      error: { code: "CLIPBOARD_DENIED", recoverable: true },
    });
    expect(controller.getState().copyState).toBe("idle");
    expect(controller.getState().lastError).toEqual({
      code: "CLIPBOARD_DENIED",
      recoverable: true,
    });
  });

  it("reports an unavailable clipboard", async () => {
    const query = mount("<button>Salva</button>");
    const controller = createPicker({
      clipboard: { write: () => Promise.reject(new ClipboardWriteError("unavailable")) },
    });
    controller.enable();
    captureOne(controller, query("button"));

    expect(await controller.copy()).toEqual({
      ok: false,
      error: { code: "CLIPBOARD_UNAVAILABLE", recoverable: true },
    });
  });

  it("gives up after the timeout and ignores the late outcome", async () => {
    vi.useFakeTimers();
    const query = mount("<button>Salva</button>");
    const deferred = deferredWriter();
    const controller = createPicker({ clipboard: deferred.writer });
    controller.enable();
    captureOne(controller, query("button"));

    const pending = controller.copy();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(await pending).toEqual({
      ok: false,
      error: { code: "COPY_TIMEOUT", recoverable: true },
    });
    expect(controller.getState().copyState).toBe("idle");

    const stateAfterTimeout = controller.getState();
    deferred.resolve();
    await Promise.resolve();
    expect(controller.getState()).toBe(stateAfterTimeout);
  });

  it("refuses to copy once destroyed", async () => {
    const controller = createPicker();
    controller.destroy();

    expect(await controller.copy()).toEqual({
      ok: false,
      error: { code: "CONTROLLER_DESTROYED", recoverable: false },
    });
  });

  it("does not report into a destroyed controller", async () => {
    const query = mount("<button>Salva</button>");
    const deferred = deferredWriter();
    const controller = createPicker({ clipboard: deferred.writer });
    controller.enable();
    captureOne(controller, query("button"));
    const listener = vi.fn();
    controller.subscribe(listener);

    const pending = controller.copy();
    controller.destroy();
    listener.mockClear();
    deferred.resolve();
    await pending;

    expect(listener).not.toHaveBeenCalled();
    expect(controller.getState().lifecycle).toBe("destroyed");
  });
});
