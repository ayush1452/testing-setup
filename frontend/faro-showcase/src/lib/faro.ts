import { faro, getWebInstrumentations, initializeFaro } from "@grafana/faro-web-sdk";
import { TracingInstrumentation } from "@grafana/faro-web-tracing";
import { appConfig, sectionFromPath } from "./app-config";

declare global {
  interface Window {
    __faroShowcaseInitialized__?: boolean;
  }
}

function traceTargets() {
  return [
    window.location.origin,
    /^http:\/\/localhost:3001/,
    /^http:\/\/127\.0\.0\.1:3001/,
  ];
}

export function syncFaroRoute(pathname: string) {
  if (typeof window === "undefined") {
    return;
  }

  faro.api.setView({
    name: sectionFromPath(pathname),
  });
  faro.api.setPage({
    id: pathname,
    url: window.location.href,
    attributes: {
      section: sectionFromPath(pathname),
    },
  });
}

export function setupFaro() {
  if (typeof window === "undefined" || window.__faroShowcaseInitialized__) {
    return faro;
  }

  initializeFaro({
    url: appConfig.collectorUrl,
    app: {
      name: appConfig.name,
      version: appConfig.version,
      environment: appConfig.environment,
    },
    ignoreUrls: [appConfig.collectorUrl, /\/collect\//, /\/_next\/webpack-hmr/],
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
  syncFaroRoute(window.location.pathname);
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
