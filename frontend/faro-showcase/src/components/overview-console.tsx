"use client";

import { useState } from "react";
import { appConfig } from "@/lib/app-config";
import { faro } from "@/lib/faro";
import { ensureObservabilityServiceWorker } from "@/lib/service-worker";
import { useTelemetryStore } from "@/lib/use-telemetry-store";

export function OverviewConsole() {
  const summary = useTelemetryStore((state) => ({
    network: state.network.length,
    events: state.events.length,
    errors: state.errors.length,
    traces: state.traces.length,
    serviceWorkerHits: state.network.filter((entry) => entry.serviceWorkerMs > 0).length,
    lastTrace: state.traces[0],
  }));
  const [probeResult, setProbeResult] = useState("No quick probe yet.");
  const [busy, setBusy] = useState(false);

  const warmPath = async () => {
    setBusy(true);

    try {
      const response = await fetch(
        `/api/telemetry?latency=140&status=200&bytes=4096&label=overview-warm&run=${Date.now()}`,
        {
          cache: "no-store",
        },
      );
      const payload = (await response.json()) as { traceId?: string };

      faro.api.pushEvent(
        "overview.quick_probe.completed",
        {
          page: "/",
          status: String(response.status),
          trace_id: payload.traceId ?? "missing",
        },
        "demo",
      );

      setProbeResult(
        `Quick probe returned ${response.status} with trace ${payload.traceId ?? "missing"}.`,
      );
    } finally {
      setBusy(false);
    }
  };

  const warmServiceWorker = async () => {
    setBusy(true);

    try {
      const status = await ensureObservabilityServiceWorker();

      if (!status.supported || !status.controlled) {
        setProbeResult(
          status.errorMessage ??
            "Service worker did not take control yet. Reload once if this is the first registration.",
        );
        return;
      }

      const response = await fetch(
        `/api/telemetry?latency=180&status=200&bytes=12288&label=overview-sw&via=service-worker&run=${Date.now()}`,
        {
          cache: "no-store",
        },
      );

      setProbeResult(
        `Service worker warm path returned ${response.status}. Open the network page to inspect worker timing.`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="signal-grid">
      <section className="panel">
        <p className="eyebrow">Live signal counts</p>
        <div className="metric-grid">
          <div className="metric-tile">
            <p className="metric-label">Network samples</p>
            <p className="metric-value">{summary.network}</p>
          </div>
          <div className="metric-tile">
            <p className="metric-label">Event timings</p>
            <p className="metric-value">{summary.events}</p>
          </div>
          <div className="metric-tile">
            <p className="metric-label">Errors</p>
            <p className="metric-value">{summary.errors}</p>
          </div>
          <div className="metric-tile">
            <p className="metric-label">Trace runs</p>
            <p className="metric-value">{summary.traces}</p>
          </div>
          <div className="metric-tile">
            <p className="metric-label">SW hits</p>
            <p className="metric-value">{summary.serviceWorkerHits}</p>
          </div>
        </div>

        <div className="action-row">
          <button className="button" disabled={busy} onClick={warmPath} type="button">
            Quick API warm path
          </button>
          <button className="button button-ghost" disabled={busy} onClick={warmServiceWorker} type="button">
            Warm service worker
          </button>
          <a className="button button-ghost" href="/journeys">
            Open journey lab
          </a>
        </div>

        <p className="small-copy">{probeResult}</p>
      </section>

      <section className="panel">
        <p className="eyebrow">Endpoints</p>
        <ul className="endpoint-list">
          <li>
            <strong>App</strong>
            <span>{appConfig.appUrl}</span>
          </li>
          <li>
            <strong>Faro collector</strong>
            <span>{appConfig.collectorUrl}</span>
          </li>
          <li>
            <strong>Grafana</strong>
            <span>{appConfig.grafanaUrl}</span>
          </li>
          <li>
            <strong>Tempo OTLP</strong>
            <span>{appConfig.tempoOtlpUrl}</span>
          </li>
        </ul>

        <div className="soft-tile">
          <p className="soft-label">Coverage</p>
          <p className="small-copy">
            This build exercises vitals, event timing, auth journeys, JS error
            families, custom HTTP statuses, direct resource timing, service
            worker timing, and trace propagation.
          </p>
        </div>

        {summary.lastTrace ? (
          <div className="soft-tile">
            <p className="soft-label">Last trace run</p>
            <p className="small-copy mono">{summary.lastTrace.traceId}</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
