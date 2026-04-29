"use client";

import {
  ROOT_CONTEXT,
  SpanKind,
  SpanStatusCode,
  TraceFlags,
  context as otelContext,
  trace as otelTrace,
  type Span,
  type SpanContext,
} from "@opentelemetry/api";
import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { sectionFromPath } from "@/lib/app-config";
import {
  faro,
  getPageSpan,
  getRouteTracer,
  setPageSpan,
  setupFaro,
  syncFaroRoute,
  tryForceFlush,
} from "@/lib/faro";
import { eventTimingToRecord, navigationToRecord, resourceToRecord } from "@/lib/performance";
import { ensureObservabilityServiceWorker } from "@/lib/service-worker";
import {
  addErrorRecord,
  addEventTimingRecord,
  addNetworkRecord,
} from "@/lib/telemetry-store-core";

function buildRouteId(pathname: string, search: string) {
  return `${pathname}${search ? `?${search}` : ""}`;
}

const TRACE_PARENT_KEY = "faro.showcase.route_parent";
const TRACE_PARENT_TTL_MS = 30 * 60 * 1000;

type StoredTraceParent = {
  spanId: string;
  traceFlags?: number;
  traceId: string;
  ts: number;
};

function isValidSpanContext(value: SpanContext) {
  return (
    /^[\da-f]{32}$/i.test(value.traceId) &&
    value.traceId !== "00000000000000000000000000000000" &&
    /^[\da-f]{16}$/i.test(value.spanId) &&
    value.spanId !== "0000000000000000"
  );
}

function readStoredTraceParent() {
  try {
    const raw = sessionStorage.getItem(TRACE_PARENT_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as StoredTraceParent;

    if (Date.now() - parsed.ts > TRACE_PARENT_TTL_MS) {
      return null;
    }

    const candidate: SpanContext = {
      traceId: parsed.traceId,
      spanId: parsed.spanId,
      traceFlags:
        typeof parsed.traceFlags === "number"
          ? parsed.traceFlags
          : TraceFlags.SAMPLED,
      isRemote: true,
    };

    return isValidSpanContext(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function persistTraceParent(spanContext: SpanContext) {
  try {
    const payload: StoredTraceParent = {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      traceFlags: spanContext.traceFlags,
      ts: Date.now(),
    };

    sessionStorage.setItem(TRACE_PARENT_KEY, JSON.stringify(payload));
  } catch {
    // Storage can be blocked; tracing should continue for the current page.
  }
}

function routeName(pathname: string) {
  return pathname === "/" ? "overview" : pathname.replace(/^\//, "") || "overview";
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

export function FaroRouteSpan() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const routeId = buildRouteId(pathname, search);
  const routeRef = useRef(routeId);
  const routeSpanRef = useRef<Span | null>(null);
  const seenEntriesRef = useRef(new Set<string>());
  const seenEventTimingsRef = useRef(new Set<string>());

  useEffect(() => {
    setupFaro();
  }, []);

  useEffect(() => {
    routeRef.current = routeId;
  }, [routeId]);

  useEffect(() => {
    const flushOnPageExit = () => {
      void tryForceFlush();
    };

    window.addEventListener("pagehide", flushOnPageExit);
    document.addEventListener("visibilitychange", flushOnPageExit);

    return () => {
      window.removeEventListener("pagehide", flushOnPageExit);
      document.removeEventListener("visibilitychange", flushOnPageExit);

      const activeSpan = routeSpanRef.current;

      if (activeSpan) {
        activeSpan.setAttribute("faro.route.end_reason", "unmount");
        activeSpan.setStatus({ code: SpanStatusCode.OK });
        activeSpan.end();
        routeSpanRef.current = null;
        setPageSpan(null);
        void tryForceFlush();
      }
    };
  }, []);

  useEffect(() => {
    setupFaro();

    const rememberNetworkRecord = (
      record: ReturnType<typeof navigationToRecord> | ReturnType<typeof resourceToRecord>,
    ) => {
      if (seenEntriesRef.current.has(record.id)) {
        return;
      }

      seenEntriesRef.current.add(record.id);
      addNetworkRecord(record);
    };

    const rememberEventTiming = (
      entry: PerformanceEntry & {
        interactionId?: number;
        processingStart?: number;
        processingEnd?: number;
      },
    ) => {
      const record = eventTimingToRecord(entry, routeRef.current);

      if (seenEventTimingsRef.current.has(record.id)) {
        return;
      }

      seenEventTimingsRef.current.add(record.id);
      addEventTimingRecord(record);

      faro.api.pushMeasurement(
        {
          type: "demo.performance.event_timing",
          values: {
            duration_ms: record.duration,
            input_delay_ms: record.inputDelayMs,
            handler_duration_ms: record.handlerDurationMs,
            presentation_delay_ms: record.presentationDelayMs,
          },
        },
        {
          context: {
            interaction_id: String(record.interactionId),
            name: record.name,
            page: record.path,
            section: sectionFromPath(record.path),
          },
        },
      );
    };

    const collectBufferedEntries = () => {
      for (const entry of performance.getEntriesByType("navigation") as PerformanceNavigationTiming[]) {
        rememberNetworkRecord(navigationToRecord(entry, routeRef.current));
      }

      for (const entry of performance.getEntriesByType("resource") as PerformanceResourceTiming[]) {
        rememberNetworkRecord(resourceToRecord(entry, routeRef.current));
      }
    };

    const onWindowError = (event: ErrorEvent) => {
      addErrorRecord({
        id: `error:${event.message}:${Date.now()}`,
        kind: "unhandled",
        message: event.error instanceof Error ? event.error.message : event.message,
        path: routeRef.current,
        capturedAt: new Date().toISOString(),
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      addErrorRecord({
        id: `rejection:${Date.now()}`,
        kind: "unhandled",
        message: getRejectionMessage(event.reason),
        path: routeRef.current,
        capturedAt: new Date().toISOString(),
      });
    };

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

    let navigationObserver: PerformanceObserver | null = null;
    let resourceObserver: PerformanceObserver | null = null;
    let eventObserver: PerformanceObserver | null = null;

    if ("PerformanceObserver" in window) {
      navigationObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as PerformanceNavigationTiming[]) {
          rememberNetworkRecord(navigationToRecord(entry, routeRef.current));
        }
      });

      resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
          rememberNetworkRecord(resourceToRecord(entry, routeRef.current));
        }
      });

      navigationObserver.observe({ type: "navigation", buffered: true });
      resourceObserver.observe({ type: "resource", buffered: true });

      if (PerformanceObserver.supportedEntryTypes?.includes("event")) {
        eventObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            rememberEventTiming(
              entry as PerformanceEntry & {
                interactionId?: number;
                processingEnd?: number;
                processingStart?: number;
              },
            );
          }
        });

        eventObserver.observe({
          type: "event",
          buffered: true,
          durationThreshold: 16,
        } as PerformanceObserverInit & { durationThreshold: number });
      }
    }

    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      navigationObserver?.disconnect();
      resourceObserver?.disconnect();
      eventObserver?.disconnect();
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    setupFaro();
    syncFaroRoute(routeId);

    const oldSpan = getPageSpan() ?? routeSpanRef.current;
    const parentContext = (() => {
      if (oldSpan) {
        return otelTrace.setSpan(ROOT_CONTEXT, oldSpan);
      }

      const stored = readStoredTraceParent();

      if (stored) {
        return otelTrace.setSpan(
          ROOT_CONTEXT,
          otelTrace.wrapSpanContext(stored),
        );
      }

      return otelContext.active();
    })();
    const span = getRouteTracer().startSpan(
      `route:${routeName(pathname)}`,
      {
        kind: SpanKind.CLIENT,
        attributes: {
          "app.page.route": routeId,
          "app.page.section": sectionFromPath(routeId),
          "app.page.url": window.location.href,
        },
      },
      parentContext,
    );

    routeSpanRef.current = span;
    setPageSpan(span);
    persistTraceParent(span.spanContext());

    faro.api.pushEvent(
      "route.active",
      {
        path: routeId,
        section: sectionFromPath(routeId),
      },
      "navigation",
      {
        spanContext: span.spanContext(),
      },
    );

    if (oldSpan) {
      oldSpan.setAttribute("faro.route.end_reason", "route_change");
      oldSpan.setStatus({ code: SpanStatusCode.OK });
      oldSpan.end();
      void tryForceFlush();
    }
  }, [pathname, routeId]);

  return null;
}
