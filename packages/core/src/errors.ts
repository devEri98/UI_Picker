export type CopyError =
  | { readonly code: "COPY_IN_PROGRESS"; readonly recoverable: true }
  | { readonly code: "COPY_TIMEOUT"; readonly recoverable: true }
  | { readonly code: "CLIPBOARD_DENIED"; readonly recoverable: true }
  | { readonly code: "CLIPBOARD_UNAVAILABLE"; readonly recoverable: true }
  | { readonly code: "CONTROLLER_DESTROYED"; readonly recoverable: false };

export type PickerError =
  | CopyError
  | { readonly code: "TARGET_NOT_SELECTABLE"; readonly recoverable: true }
  | { readonly code: "TARGET_LIMIT_REACHED"; readonly recoverable: true }
  | { readonly code: "TARGET_TOO_LARGE"; readonly recoverable: true }
  | { readonly code: "SESSION_SIZE_LIMIT_REACHED"; readonly recoverable: true }
  | { readonly code: "RESOLVER_FAILED"; readonly recoverable: true; readonly adapter: string };

export type PickerErrorCode = PickerError["code"];

/** Discriminated result used by every fallible public operation. */
export type Result<TValue, TError> =
  { readonly ok: true; readonly value: TValue } | { readonly ok: false; readonly error: TError };

export function ok<TValue>(value: TValue): { readonly ok: true; readonly value: TValue } {
  return { ok: true, value };
}

export function fail<TError>(error: TError): { readonly ok: false; readonly error: TError } {
  return { ok: false, error };
}

export const TARGET_NOT_SELECTABLE: PickerError = {
  code: "TARGET_NOT_SELECTABLE",
  recoverable: true,
};

export const TARGET_LIMIT_REACHED: PickerError = {
  code: "TARGET_LIMIT_REACHED",
  recoverable: true,
};

export const TARGET_TOO_LARGE: PickerError = { code: "TARGET_TOO_LARGE", recoverable: true };

export const SESSION_SIZE_LIMIT_REACHED: PickerError = {
  code: "SESSION_SIZE_LIMIT_REACHED",
  recoverable: true,
};

export function resolverFailed(adapter: string): PickerError {
  return { code: "RESOLVER_FAILED", recoverable: true, adapter };
}
