import { faro, getWebInstrumentations, initializeFaro } from "@grafana/faro-web-sdk";
import { TracingInstrumentation } from "@grafana/faro-web-tracing";
import {
  context as otelContext,
  trace as otelTrace,
  type Span,
  type Tracer,
} from "@opentelemetry/api";
import { appConfig, sectionFromPath } from "./app-config";

declare global {
  interface Window {
    __faroShowcaseInitialized__?: boolean;
    __faroShowcaseFetchWrapped__?: boolean;
    __faroShowcaseXhrWrapped__?: boolean;
  }
}

let currentPageSpan: Span | null = null;
let routeTracer: Tracer | null = null;

const ignoredUrlPatterns: RegExp[] = [
  /\/collect(?:$|[/?#])/,
  /\/_next\/webpack-hmr/,
];

function traceTargets() {
  return [
    window.location.origin,
    /^http:\/\/localhost:3001/,
    /^http:\/\/127\.0\.0\.1:3001/,
  ];
}

function shouldIgnoreUrl(input: RequestInfo | URL) {
  try {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    return ignoredUrlPatterns.some((pattern) => pattern.test(url));
  } catch {
    return false;
  }
}

function currentBrowserRoute() {
  if (typeof window === "undefined") {
    return "/";
  }

  return `${window.location.pathname}${window.location.search}`;
}

export function syncFaroRoute(routeId: string) {
  if (typeof window === "undefined") {
    return;
  }

  faro.api.setView({
    name: sectionFromPath(routeId),
  });
  faro.api.setPage({
    id: routeId,
    url: window.location.href,
    attributes: {
      section: sectionFromPath(routeId),
    },
  });
}

export function getRouteTracer() {
  if (!routeTracer) {
    routeTracer = otelTrace.getTracer("faro-showcase.route");
  }

  return routeTracer;
}

export function getPageSpan() {
  return currentPageSpan;
}

export function setPageSpan(span: Span | null) {
  currentPageSpan = span;
}

export function runWithPageSpan<T>(fn: () => T) {
  if (!currentPageSpan) {
    return fn();
  }

  return otelContext.with(
    otelTrace.setSpan(otelContext.active(), currentPageSpan),
    fn,
  );
}

export async function tryForceFlush() {
  try {
    const provider = otelTrace.getTracerProvider() as {
      forceFlush?: () => Promise<void> | void;
      _delegate?: { forceFlush?: () => Promise<void> | void };
      _activeSpanProcessor?: { forceFlush?: () => Promise<void> | void };
      activeSpanProcessor?: { forceFlush?: () => Promise<void> | void };
      spanProcessor?: { forceFlush?: () => Promise<void> | void };
    };

    if (typeof provider.forceFlush === "function") {
      await provider.forceFlush();
      return;
    }

    if (typeof provider._delegate?.forceFlush === "function") {
      await provider._delegate.forceFlush();
      return;
    }

    const processor =
      provider._activeSpanProcessor ??
      provider.activeSpanProcessor ??
      provider.spanProcessor;

    if (typeof processor?.forceFlush === "function") {
      await processor.forceFlush();
    }
  } catch {
    // Best effort only; Faro still flushes on its own schedule.
  }
}

function wrapFetchWithPageSpan() {
  if (typeof window === "undefined" || !window.fetch || window.__faroShowcaseFetchWrapped__) {
    return;
  }

  const originalFetch = window.fetch.bind(window);

  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (shouldIgnoreUrl(input)) {
      return originalFetch(input, init);
    }

    return runWithPageSpan(() => originalFetch(input, init));
  }) as typeof window.fetch;

  window.__faroShowcaseFetchWrapped__ = true;
}

function wrapXhrWithPageSpan() {
  if (
    typeof window === "undefined" ||
    !window.XMLHttpRequest ||
    window.__faroShowcaseXhrWrapped__
  ) {
    return;
  }

  const proto = window.XMLHttpRequest.prototype as XMLHttpRequest & {
    __faroShowcaseWrappedOpen__?: boolean;
  };

  if (proto.__faroShowcaseWrappedOpen__) {
    window.__faroShowcaseXhrWrapped__ = true;
    return;
  }

  const originalOpen = proto.open;

  const wrappedOpen = function (
    this: XMLHttpRequest,
    ...openArgs: [
      method: string,
      url: string | URL,
      async?: boolean,
      username?: string | null,
      password?: string | null,
    ]
  ) {
    const [, url] = openArgs;
    const invokeOriginal = () =>
      originalOpen.apply(this, openArgs as Parameters<XMLHttpRequest["open"]>);

    if (shouldIgnoreUrl(url)) {
      return invokeOriginal();
    }

    return runWithPageSpan(invokeOriginal);
  };

  proto.open = wrappedOpen as XMLHttpRequest["open"];

  proto.__faroShowcaseWrappedOpen__ = true;
  window.__faroShowcaseXhrWrapped__ = true;
}

export function setupFaro() {
  if (typeof window === "undefined" || window.__faroShowcaseInitialized__) {
    return faro;
  }

  initializeFaro({
    url: appConfig.collectorUrl,
    dedupe: false,
    trackResources: true,
    webVitalsInstrumentation: {
      reportAllChanges: true,
    },
    app: {
      name: appConfig.name,
      version: appConfig.version,
      environment: appConfig.environment,
    },
    ignoreUrls: [
      appConfig.collectorUrl,
      ...ignoredUrlPatterns,
    ],
    instrumentations: [
      ...getWebInstrumentations(),
      new TracingInstrumentation({
        instrumentationOptions: {
          propagateTraceHeaderCorsUrls: traceTargets(),
          fetchInstrumentationOptions: {
            ignoreNetworkEvents: false,
          },
          xhrInstrumentationOptions: {
            ignoreNetworkEvents: false,
          },
        },
      }),
    ],
  });

  window.__faroShowcaseInitialized__ = true;
  routeTracer = otelTrace.getTracer("faro-showcase.route");
  wrapFetchWithPageSpan();
  wrapXhrWithPageSpan();
  syncFaroRoute(currentBrowserRoute());
  faro.api.pushEvent(
    "app.ready",
    {
      collector: appConfig.collectorUrl,
      environment: appConfig.environment,
    },
    "setup",
  );

  return faro;
}

export { faro };
