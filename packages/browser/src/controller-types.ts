import type { CopyError, OutputFormat, PickerError } from "@ui-target-picker/core";

export type Lifecycle = "created" | "enabled" | "disabled" | "destroyed";
export type SelectionMode = "inactive" | "temporary" | "continuous";
export type CopyState = "idle" | "pending";

export interface UiTargetPickerState {
  readonly lifecycle: Lifecycle;
  readonly selectionMode: SelectionMode;
  readonly copyState: CopyState;
  readonly targetCount: number;
  readonly maxTargets: number;
  readonly outputFormat: OutputFormat;
  /** True while the single removal snapshot can still be restored. */
  readonly canUndo: boolean;
  readonly lastError?: PickerError;
}

export type ControllerDestroyedError = {
  readonly code: "CONTROLLER_DESTROYED";
  readonly recoverable: false;
};

export type LifecycleResult =
  { readonly ok: true } | { readonly ok: false; readonly error: ControllerDestroyedError };

export type CopyResult =
  | { readonly ok: true; readonly format: OutputFormat; readonly targetCount: number }
  | { readonly ok: false; readonly error: CopyError };

export type StateListener = (state: Readonly<UiTargetPickerState>) => void;
export type Unsubscribe = () => void;
