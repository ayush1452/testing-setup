"use client";

import { useSyncExternalStore } from "react";
import {
  getTelemetryServerSnapshot,
  getTelemetryState,
  subscribeTelemetry,
  type TelemetryState,
} from "./telemetry-store-core";

export function useTelemetryStore<T>(selector: (state: TelemetryState) => T) {
  const state = useSyncExternalStore(
    subscribeTelemetry,
    getTelemetryState,
    getTelemetryServerSnapshot,
  );

  return selector(state);
}
