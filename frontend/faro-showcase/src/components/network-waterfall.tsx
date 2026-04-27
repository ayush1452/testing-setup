"use client";

import { useState } from "react";
import { faro } from "@/lib/faro";
import {
  formatKilobytes,
  formatMilliseconds,
  isServiceWorkerProbe,
  isSyntheticProbe,
} from "@/lib/performance";
import { ensureObservabilityServiceWorker } from "@/lib/service-worker";
import { useTelemetryStore } from "@/lib/use-telemetry-store";

type ProbeConfig = {
  bytes: number;
  label: string;
  latency: number;
  status?: number;
  useAlternateOrigin?: boolean;
  via?: "direct" | "service-worker";
};

function buildProbeUrl({
  bytes,
  label,
  latency,
  status = 200,
  useAlternateOrigin = false,
  via = "direct",
}: ProbeConfig) {
  const params = new URLSearchParams({
    bytes: String(bytes),
    label,
    latency: String(latency),
    run: String(Date.now()),
    status: String(status),
    via,
  });

  if (!useAlternateOrigin) {
    return `/api/telemetry?${params.toString()}`;
  }

  const url = new URL(window.location.href);

  url.pathname = "/api/telemetry";
  url.search = params.toString();
  url.hostname = url.hostname === "127.0.0.1" ? "localhost" : "127.0.0.1";
  return url.toString();
}

export function HttpLab() {
  const entries = useTelemetryStore((state) => state.network);
  const [busyLabel, setBusyLabel] = useState("");
  const [probeMessage, setProbeMessage] = useState("No probe fired yet.");

  const latestNavigation = entries.find((entry) => entry.kind === "navigation");
  const recentEntries = entries.slice(0, 10);
  const maxDuration = Math.max(1, ...recentEntries.map((entry) => entry.duration));
  const latestProbe = entries.find(
    (entry) => entry.kind === "resource" && isSyntheticProbe(entry),
  );
  const latestServiceWorkerProbe = entries.find(
    (entry) => entry.kind === "resource" && isServiceWorkerProbe(entry),
  );
  const latestResource = latestServiceWorkerProbe ?? latestProbe;

  const runProbe = async ({
    bytes,
    label,
    latency,
    status = 200,
    useAlternateOrigin = false,
    via = "direct",
  }: ProbeConfig) => {
    setBusyLabel(label);

    try {
      if (via === "service-worker") {
        const serviceWorker = await ensureObservabilityServiceWorker();

        if (!serviceWorker.supported || !serviceWorker.controlled) {
          setProbeMessage(
            serviceWorker.errorMessage ??
              "Service worker did not take control yet. Reload once if this is the first registration.",
          );
          return;
        }
      }

      const response = await fetch(buildProbeUrl({
        bytes,
        label,
        latency,
        status,
        useAlternateOrigin,
        via,
      }), {
        cache: "no-store",
        mode: useAlternateOrigin ? "cors" : "same-origin",
      });
      const payload = (await response.json()) as {
        bytes?: number;
        traceId?: string;
        via?: string;
      };

      faro.api.pushMeasurement(
        {
          type: "network.probe.summary",
          values: {
            bytes,
            latency_ms: latency,
            status_code: response.status,
            via_service_worker: via === "service-worker" ? 1 : 0,
          },
        },
        {
          context: {
            page: "/http-lab",
            label,
            probe_origin: useAlternateOrigin ? "alternate-host" : "same-host",
          },
        },
      );

      faro.api.pushEvent(
        "network.probe.completed",
        {
          page: "/http-lab",
          status: String(response.status),
          trace_id: payload.traceId ?? "missing",
          via: payload.via ?? via,
          label,
        },
        "network",
      );

      setProbeMessage(
        `${label} returned ${response.status} with ${payload.bytes ?? bytes} bytes via ${payload.via ?? via}${useAlternateOrigin ? " on the alternate host" : ""}.`,
      );
    } finally {
      setBusyLabel("");
    }
  };

  return (
    <div className="page-stack">
      <section className="panel">
        <p className="eyebrow">Latest navigation timing</p>
        {latestNavigation ? (
          <div className="metric-grid">
            <div className="metric-tile">
              <p className="metric-label">Redirect</p>
              <p className="metric-value">{formatMilliseconds(latestNavigation.redirectMs)}</p>
              <p className="metric-caption">{latestNavigation.deliveryType}</p>
            </div>
            <div className="metric-tile">
              <p className="metric-label">DNS</p>
              <p className="metric-value">{formatMilliseconds(latestNavigation.dnsLookupMs)}</p>
              <p className="metric-caption">Lookup duration for the page navigation.</p>
            </div>
            <div className="metric-tile">
              <p className="metric-label">TCP handshake</p>
              <p className="metric-value">{formatMilliseconds(latestNavigation.tcpHandshakeMs)}</p>
              <p className="metric-caption">Socket connection setup.</p>
            </div>
            <div className="metric-tile">
              <p className="metric-label">TLS</p>
              <p className="metric-value">{formatMilliseconds(latestNavigation.tlsNegotiationMs)}</p>
              <p className="metric-caption">{latestNavigation.nextHopProtocol}</p>
            </div>
            <div className="metric-tile">
              <p className="metric-label">Service worker</p>
              <p className="metric-value">{formatMilliseconds(latestNavigation.serviceWorkerMs)}</p>
              <p className="metric-caption">Usually zero until a worker handles fetch.</p>
            </div>
            <div className="metric-tile">
              <p className="metric-label">Request gap</p>
              <p className="metric-value">{formatMilliseconds(latestNavigation.requestStartGapMs)}</p>
              <p className="metric-caption">Fetch start to request dispatch.</p>
            </div>
            <div className="metric-tile">
              <p className="metric-label">TTFB</p>
              <p className="metric-value">{formatMilliseconds(latestNavigation.ttfbMs)}</p>
              <p className="metric-caption">Request start to first byte.</p>
            </div>
            <div className="metric-tile">
              <p className="metric-label">Download</p>
              <p className="metric-value">{formatMilliseconds(latestNavigation.responseDownloadMs)}</p>
              <p className="metric-caption">First byte to response end.</p>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            Reload this page once to capture a navigation entry, then inspect the
            matching measurements in Grafana Explore.
          </div>
        )}
      </section>

      <div className="signal-grid">
        <section className="panel">
          <p className="eyebrow">Probe launcher</p>
          <div className="scenario-grid">
            <div className="scenario-card">
              <span className="badge good">Baseline</span>
              <h2>Direct resource timing</h2>
              <p>Small payload with low latency for a clean control sample.</p>
              <button
                className="button"
                disabled={Boolean(busyLabel)}
                onClick={() =>
                  runProbe({
                    label: "direct-fast",
                    latency: 120,
                    bytes: 4096,
                  })
                }
                type="button"
              >
                {busyLabel === "direct-fast" ? "Running baseline..." : "Trigger baseline probe"}
              </button>
            </div>
            <div className="scenario-card">
              <span className="badge good">TTFB</span>
              <h2>Server-wait probe</h2>
              <p>Small payload with a longer server delay to stretch request start and first byte.</p>
              <button
                className="button button-ghost"
                disabled={Boolean(busyLabel)}
                onClick={() =>
                  runProbe({
                    label: "ttfb-focus",
                    latency: 1120,
                    bytes: 2048,
                  })
                }
                type="button"
              >
                {busyLabel === "ttfb-focus" ? "Running TTFB probe..." : "Trigger TTFB probe"}
              </button>
            </div>
            <div className="scenario-card">
              <span className="badge good">Transfer</span>
              <h2>Large download probe</h2>
              <p>Low latency with a heavier body to surface response duration and transfer size.</p>
              <button
                className="button button-ghost"
                disabled={Boolean(busyLabel)}
                onClick={() =>
                  runProbe({
                    label: "download-focus",
                    latency: 160,
                    bytes: 98304,
                  })
                }
                type="button"
              >
                {busyLabel === "download-focus" ? "Running download probe..." : "Trigger download probe"}
              </button>
            </div>
            <div className="scenario-card">
              <span className="badge warn">DNS + TCP</span>
              <h2>Alternate-host handshake</h2>
              <p>Swaps `localhost` and `127.0.0.1` to encourage a fresh lookup and socket connection.</p>
              <button
                className="button button-ghost"
                disabled={Boolean(busyLabel)}
                onClick={() =>
                  runProbe({
                    label: "handshake-focus",
                    latency: 240,
                    bytes: 6144,
                    useAlternateOrigin: true,
                  })
                }
                type="button"
              >
                {busyLabel === "handshake-focus" ? "Running handshake probe..." : "Trigger handshake probe"}
              </button>
            </div>
            <div className="scenario-card">
              <span className="badge warn">Service Worker</span>
              <h2>Worker-controlled fetch</h2>
              <p>Routes the probe through the registered service worker and exposes worker timing.</p>
              <button
                className="button button-ghost"
                disabled={Boolean(busyLabel)}
                onClick={() =>
                  runProbe({
                    label: "service-worker",
                    latency: 220,
                    bytes: 12288,
                    via: "service-worker",
                  })
                }
                type="button"
              >
                {busyLabel === "service-worker" ? "Running SW probe..." : "Trigger SW probe"}
              </button>
            </div>
          </div>

          <div className="mini-grid">
            <div className="soft-tile">
              <p className="soft-label">What this page proves</p>
              <p className="small-copy">
                Redirect, DNS, TCP, TLS, request gap, TTFB, response download,
                payload sizes, server timing headers, and service worker fetch
                control.
              </p>
            </div>
            <div className="soft-tile">
              <p className="soft-label">Latest probe message</p>
              <p className="small-copy">{probeMessage}</p>
            </div>
            <div className="soft-tile">
              <p className="soft-label">Handshake note</p>
              <p className="small-copy">
                DNS and TCP can still read as zero if the browser reuses a warm
                socket. The alternate-host probe improves the odds of a visible handshake sample.
              </p>
            </div>
          </div>
        </section>

        <section className="panel">
          <p className="eyebrow">Latest resource detail</p>
          {latestResource ? (
            <div className="mini-grid">
              <div className="soft-tile">
                <p className="soft-label">Resource</p>
                <p className="small-copy mono">{latestResource.name}</p>
              </div>
              <div className="soft-tile">
                <p className="soft-label">Transfer</p>
                <p className="trace-strong">{formatKilobytes(latestResource.transferSizeKb)}</p>
              </div>
              <div className="soft-tile">
                <p className="soft-label">Decoded</p>
                <p className="trace-strong">{formatKilobytes(latestResource.decodedBodySizeKb)}</p>
              </div>
              <div className="soft-tile">
                <p className="soft-label">Protocol</p>
                <p className="trace-strong">{latestResource.nextHopProtocol}</p>
              </div>
              <div className="soft-tile">
                <p className="soft-label">Worker</p>
                <p className="trace-strong">{formatMilliseconds(latestResource.serviceWorkerMs)}</p>
              </div>
              <div className="soft-tile">
                <p className="soft-label">Download</p>
                <p className="trace-strong">{formatMilliseconds(latestResource.responseDownloadMs)}</p>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              Fire a probe to populate detailed resource timing data.
            </div>
          )}

          {latestResource?.serverTiming.length ? (
            <div className="chip-row">
              {latestResource.serverTiming.map((timing) => (
                <span className="chip" key={timing}>
                  {timing}
                </span>
              ))}
            </div>
          ) : null}
        </section>
      </div>

      <section className="panel">
        <p className="eyebrow">Resource waterfall</p>
        {recentEntries.length === 0 ? (
          <div className="empty-state">No resource timing entries yet.</div>
        ) : (
          <div className="waterfall">
            {recentEntries.map((entry) => (
              <div className="waterfall-row" key={entry.id}>
                <span className="waterfall-name">
                  {entry.kind === "navigation" ? "navigation" : entry.name}
                </span>
                <div className="waterfall-track">
                  <div
                    className="waterfall-fill"
                    style={{ width: `${Math.max(8, (entry.duration / maxDuration) * 100)}%` }}
                  />
                </div>
                <span className="waterfall-value">{formatMilliseconds(entry.duration)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <p className="eyebrow">Synthetic resource ledger</p>
        {entries.filter((entry) => entry.kind === "resource" && isSyntheticProbe(entry)).length === 0 ? (
          <div className="empty-state">
            Fire one of the probes to compare TTFB, download, DNS, TCP, TLS, and service-worker timing side by side.
          </div>
        ) : (
          <div className="ledger">
            {entries
              .filter((entry) => entry.kind === "resource" && isSyntheticProbe(entry))
              .slice(0, 8)
              .map((entry) => (
                <div className="ledger-row" key={entry.id}>
                  <div>
                    <strong>{entry.name}</strong>
                    <span>
                      DNS {formatMilliseconds(entry.dnsLookupMs)} · TCP {formatMilliseconds(entry.tcpHandshakeMs)} ·
                      TTFB {formatMilliseconds(entry.ttfbMs)}
                    </span>
                  </div>
                  <span>{formatKilobytes(entry.transferSizeKb)}</span>
                  <span className={`badge ${entry.serviceWorkerMs > 0 ? "warn" : "good"}`}>
                    {entry.serviceWorkerMs > 0 ? "worker" : entry.nextHopProtocol}
                  </span>
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}

export { HttpLab as NetworkWaterfall };
