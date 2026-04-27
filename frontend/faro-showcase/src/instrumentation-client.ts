import { sectionFromPath } from "@/lib/app-config";
import { faro, setupFaro } from "@/lib/faro";
import {
  addEventTimingRecord,
  addErrorRecord,
  addNetworkRecord,
  type NetworkRecord,
} from "@/lib/telemetry-store-core";
import {
  eventTimingToRecord,
  isSyntheticProbe,
  navigationToRecord,
  networkMeasurementValues,
  resourceToRecord,
} from "@/lib/performance";
import { ensureObservabilityServiceWorker } from "@/lib/service-worker";

declare global {
  interface Window {
    __faroShowcaseObserversInstalled__?: boolean;
  }
}

setupFaro();

const seenEntries = new Set<string>();
const seenEventTimings = new Set<string>();

function rememberRecord(record: NetworkRecord) {
  if (seenEntries.has(record.id)) {
    return;
  }

  seenEntries.add(record.id);
  addNetworkRecord(record);

  if (record.kind === "navigation") {
    faro.api.pushMeasurement(
      {
        type: "browser.navigation.timings",
        values: networkMeasurementValues(record),
      },
      {
        context: {
          page: record.path,
          section: sectionFromPath(record.path),
        },
      },
    );
  }

  if (record.kind === "resource" && isSyntheticProbe(record)) {
    faro.api.pushMeasurement(
      {
        type: "browser.resource.timings",
        values: networkMeasurementValues(record),
      },
      {
        context: {
          page: record.path,
          resource: record.name,
          initiator: record.initiatorType,
        },
      },
    );
  }
}

function rememberEventTiming(entry: PerformanceEntry) {
  const record = eventTimingToRecord(
    entry as PerformanceEntry & {
      interactionId?: number;
      processingStart?: number;
      processingEnd?: number;
    },
    window.location.pathname,
  );

  if (seenEventTimings.has(record.id)) {
    return;
  }

  seenEventTimings.add(record.id);
  addEventTimingRecord(record);

  faro.api.pushMeasurement(
    {
      type: "browser.event.timings",
      values: {
        duration_ms: record.duration,
        input_delay_ms: record.inputDelayMs,
        handler_duration_ms: record.handlerDurationMs,
        presentation_delay_ms: record.presentationDelayMs,
      },
    },
    {
      context: {
        page: record.path,
        name: record.name,
        interaction_id: String(record.interactionId),
      },
    },
  );
}

function collectBufferedEntries() {
  for (const entry of performance.getEntriesByType("navigation") as PerformanceNavigationTiming[]) {
    rememberRecord(navigationToRecord(entry, window.location.pathname));
  }

  for (const entry of performance.getEntriesByType("resource") as PerformanceResourceTiming[]) {
    rememberRecord(resourceToRecord(entry, window.location.pathname));
  }
}

function getRejectionMessage(reason: unknown) {
  if (reason instanceof Error) {
    return reason.message;
  }

  if (typeof reason === "string") {
    return reason;
  }

  return "Unhandled rejection";
}

if (typeof window !== "undefined" && !window.__faroShowcaseObserversInstalled__) {
  window.__faroShowcaseObserversInstalled__ = true;

  collectBufferedEntries();
  void ensureObservabilityServiceWorker().then((status) => {
    if (status.controlled) {
      faro.api.pushEvent(
        "service_worker.ready",
        {
          scope: status.scope ?? "/",
        },
        "service-worker",
      );
    }
  });

  if ("PerformanceObserver" in window) {
    const navigationObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as PerformanceNavigationTiming[]) {
        rememberRecord(navigationToRecord(entry, window.location.pathname));
      }
    });

    const resourceObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
        rememberRecord(resourceToRecord(entry, window.location.pathname));
      }
    });

    navigationObserver.observe({ type: "navigation", buffered: true });
    resourceObserver.observe({ type: "resource", buffered: true });

    if (PerformanceObserver.supportedEntryTypes?.includes("event")) {
      const eventObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          rememberEventTiming(entry);
        }
      });

      eventObserver.observe({
        type: "event",
        buffered: true,
        durationThreshold: 16,
      } as PerformanceObserverInit & { durationThreshold: number });
    }
  }

  window.addEventListener("error", (event) => {
    addErrorRecord({
      id: `error:${event.message}:${Date.now()}`,
      kind: "unhandled",
      message: event.error instanceof Error ? event.error.message : event.message,
      path: window.location.pathname,
      capturedAt: new Date().toISOString(),
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    addErrorRecord({
      id: `rejection:${Date.now()}`,
      kind: "unhandled",
      message: getRejectionMessage(event.reason),
      path: window.location.pathname,
      capturedAt: new Date().toISOString(),
    });
  });
}

export function onRouterTransitionStart(
  url: string,
  navigationType: "push" | "replace" | "traverse",
) {
  faro.api.pushEvent(
    "router.transition.start",
    {
      url,
      navigation_type: navigationType,
    },
    "navigation",
  );
}
