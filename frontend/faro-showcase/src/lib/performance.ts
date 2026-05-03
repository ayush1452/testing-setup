import type {
  EventTimingRecord,
  NetworkRecord,
} from "./telemetry-store-core";

function round(value: number) {
  return Number(value.toFixed(2));
}

function delta(end: number, start: number) {
  if (!Number.isFinite(end) || !Number.isFinite(start) || end < start) {
    return 0;
  }

  return round(end - start);
}

function kilobytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return round(value / 1024);
}

function shortName(value: string) {
  try {
    const url = new URL(value);
    return `${url.pathname}${url.search}`;
  } catch {
    return value;
  }
}

function max(value: number) {
  return value > 0 ? value : 0;
}

function getServerTiming(entry: PerformanceResourceTiming | PerformanceNavigationTiming) {
  return Array.from(entry.serverTiming ?? []).map((item) =>
    item.duration > 0 ? `${item.name}:${round(item.duration)}ms` : item.name,
  );
}

function getDeliveryType(entry: PerformanceResourceTiming | PerformanceNavigationTiming) {
  const candidate = entry as PerformanceResourceTiming & {
    deliveryType?: string;
  };

  return candidate.deliveryType ?? "network";
}

function createTimingRecordBase(
  entry: PerformanceResourceTiming | PerformanceNavigationTiming,
  path: string,
) {
  return {
    duration: round(entry.duration),
    redirectMs: delta(entry.redirectEnd, entry.redirectStart),
    dnsLookupMs: delta(entry.domainLookupEnd, entry.domainLookupStart),
    tcpHandshakeMs: delta(entry.connectEnd, entry.connectStart),
    tlsNegotiationMs:
      entry.secureConnectionStart > 0
        ? delta(entry.connectEnd, entry.secureConnectionStart)
        : 0,
    serviceWorkerMs:
      entry.workerStart > 0 ? delta(entry.fetchStart, entry.workerStart) : 0,
    requestStartGapMs: delta(entry.requestStart, entry.fetchStart),
    ttfbMs: delta(entry.responseStart, entry.requestStart || entry.startTime),
    responseDownloadMs: delta(entry.responseEnd, entry.responseStart),
    transferSizeKb: kilobytes(entry.transferSize),
    encodedBodySizeKb: kilobytes(entry.encodedBodySize),
    decodedBodySizeKb: kilobytes(entry.decodedBodySize),
    nextHopProtocol: entry.nextHopProtocol || "unknown",
    deliveryType: getDeliveryType(entry),
    serverTiming: getServerTiming(entry),
    path,
    capturedAt: new Date().toISOString(),
  };
}

export function navigationToRecord(
  entry: PerformanceNavigationTiming,
  path: string,
): NetworkRecord {
  return {
    id: `navigation:${path}:${entry.startTime}`,
    kind: "navigation",
    name: path,
    initiatorType: "navigation",
    ...createTimingRecordBase(entry, path),
  };
}

export function resourceToRecord(
  entry: PerformanceResourceTiming,
  path: string,
): NetworkRecord {
  return {
    id: `resource:${entry.name}:${entry.startTime}`,
    kind: "resource",
    name: shortName(entry.name),
    initiatorType: entry.initiatorType || "other",
    ...createTimingRecordBase(entry, path),
  };
}

export function formatMilliseconds(value: number) {
  return `${value.toFixed(0)} ms`;
}

export function formatKilobytes(value: number) {
  return `${value.toFixed(1)} KB`;
}

export function formatVitalValue(name: string, value: number) {
  if (name === "CLS") {
    return value.toFixed(3);
  }

  return formatMilliseconds(value);
}

export function isSyntheticProbe(record: NetworkRecord) {
  return record.name.includes("/api/telemetry");
}

export function isServiceWorkerProbe(record: NetworkRecord) {
  return record.name.includes("via=service-worker");
}

type EventTimingLike = PerformanceEntry & {
  interactionId?: number;
  processingStart?: number;
  processingEnd?: number;
};

export function eventTimingToRecord(
  entry: EventTimingLike,
  path: string,
): EventTimingRecord {
  const inputDelayMs = max((entry.processingStart ?? entry.startTime) - entry.startTime);
  const handlerDurationMs = max(
    (entry.processingEnd ?? entry.processingStart ?? entry.startTime) -
      (entry.processingStart ?? entry.startTime),
  );
  const presentationDelayMs = max(entry.duration - inputDelayMs - handlerDurationMs);

  return {
    id: `event:${entry.name}:${entry.startTime}:${entry.interactionId ?? 0}`,
    name: entry.name,
    duration: round(entry.duration),
    inputDelayMs: round(inputDelayMs),
    handlerDurationMs: round(handlerDurationMs),
    presentationDelayMs: round(presentationDelayMs),
    interactionId: entry.interactionId ?? 0,
    path,
    capturedAt: new Date().toISOString(),
  };
}

export function networkMeasurementValues(record: NetworkRecord) {
  return {
    duration_ms: record.duration,
    redirect_ms: record.redirectMs,
    dns_lookup_ms: record.dnsLookupMs,
    tcp_handshake_ms: record.tcpHandshakeMs,
    tls_negotiation_ms: record.tlsNegotiationMs,
    service_worker_ms: record.serviceWorkerMs,
    request_start_gap_ms: record.requestStartGapMs,
    ttfb_ms: record.ttfbMs,
    response_download_ms: record.responseDownloadMs,
    transfer_kb: record.transferSizeKb,
    encoded_body_kb: record.encodedBodySizeKb,
    decoded_body_kb: record.decodedBodySizeKb,
  };
}
