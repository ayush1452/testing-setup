export type VitalRecord = {
  id: string;
  name: string;
  value: number;
  delta: number;
  rating: string;
  navigationType: string;
  path: string;
  capturedAt: string;
};

export type NetworkRecord = {
  id: string;
  kind: "navigation" | "resource";
  name: string;
  initiatorType: string;
  duration: number;
  redirectMs: number;
  dnsLookupMs: number;
  tcpHandshakeMs: number;
  tlsNegotiationMs: number;
  serviceWorkerMs: number;
  requestStartGapMs: number;
  ttfbMs: number;
  responseDownloadMs: number;
  transferSizeKb: number;
  encodedBodySizeKb: number;
  decodedBodySizeKb: number;
  nextHopProtocol: string;
  deliveryType: string;
  serverTiming: string[];
  path: string;
  capturedAt: string;
};

export type EventTimingRecord = {
  id: string;
  name: string;
  duration: number;
  inputDelayMs: number;
  handlerDurationMs: number;
  presentationDelayMs: number;
  interactionId: number;
  path: string;
  capturedAt: string;
};

export type ErrorRecord = {
  id: string;
  kind: "console" | "handled" | "status" | "unhandled";
  message: string;
  path: string;
  status?: number;
  capturedAt: string;
};

export type TraceRunRecord = {
  id: string;
  traceId: string;
  serverTraceId?: string;
  httpStatus: number;
  propagationState: "matched" | "mismatched" | "missing";
  childSpans: string[];
  path: string;
  capturedAt: string;
};

export type TelemetryState = {
  vitals: VitalRecord[];
  network: NetworkRecord[];
  events: EventTimingRecord[];
  errors: ErrorRecord[];
  traces: TraceRunRecord[];
};

const initialTelemetryState: TelemetryState = {
  vitals: [],
  network: [],
  events: [],
  errors: [],
  traces: [],
};

let currentTelemetryState: TelemetryState = initialTelemetryState;

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function prepend<T extends { id: string }>(items: T[], value: T, limit: number) {
  const nextItems = [value, ...items.filter((item) => item.id !== value.id)];
  return nextItems.slice(0, limit);
}

export function subscribeTelemetry(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getTelemetryState() {
  return currentTelemetryState;
}

export function getTelemetryServerSnapshot() {
  return initialTelemetryState;
}

export function addWebVital(value: VitalRecord) {
  currentTelemetryState = {
    ...currentTelemetryState,
    vitals: prepend(currentTelemetryState.vitals, value, 24),
  };
  notify();
}

export function addNetworkRecord(value: NetworkRecord) {
  currentTelemetryState = {
    ...currentTelemetryState,
    network: prepend(currentTelemetryState.network, value, 40),
  };
  notify();
}

export function addEventTimingRecord(value: EventTimingRecord) {
  currentTelemetryState = {
    ...currentTelemetryState,
    events: prepend(currentTelemetryState.events, value, 40),
  };
  notify();
}

export function addErrorRecord(value: ErrorRecord) {
  currentTelemetryState = {
    ...currentTelemetryState,
    errors: prepend(currentTelemetryState.errors, value, 24),
  };
  notify();
}

export function addTraceRun(value: TraceRunRecord) {
  currentTelemetryState = {
    ...currentTelemetryState,
    traces: prepend(currentTelemetryState.traces, value, 16),
  };
  notify();
}
