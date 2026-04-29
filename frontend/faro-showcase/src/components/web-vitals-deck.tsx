"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { faro } from "@/lib/faro";
import { formatVitalValue } from "@/lib/performance";
import { useTelemetryStore } from "@/lib/use-telemetry-store";

const thresholds: Record<string, string> = {
  CLS: "good under 0.10",
  FCP: "good under 1.8s",
  INP: "good under 200ms",
  LCP: "good under 2.5s",
  TTFB: "good under 800ms",
};

type WebVitalsDeckProps = {
  elevateLcpStage?: boolean;
  imageDelayMs: number;
  scenario: string;
  serverDelayMs: number;
};

function scenarioHref(scenario: string, serverDelayMs = 0, imageDelayMs = 0) {
  const params = new URLSearchParams({ scenario });

  if (serverDelayMs > 0) {
    params.set("delay", String(serverDelayMs));
  }

  if (imageDelayMs > 0) {
    params.set("imageDelay", String(imageDelayMs));
  }

  return `/web-vitals?${params.toString()}`;
}

export function WebVitalsDeck({
  elevateLcpStage = false,
  imageDelayMs,
  scenario,
  serverDelayMs,
}: WebVitalsDeckProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.toString();
  const currentRoute = `${pathname}${currentSearch ? `?${currentSearch}` : ""}`;
  const events = useTelemetryStore((state) => state.events);
  const currentRouteEvents = events.filter((event) => event.path === currentRoute);
  const [shiftVisible, setShiftVisible] = useState(false);
  const [firstInputPulse, setFirstInputPulse] = useState<"idle" | "armed" | "running" | "complete">("idle");
  const [note, setNote] = useState(
    "Click the interaction probe to generate event timing and help surface INP.",
  );
  const shiftTimerRef = useRef<number | null>(null);
  const fidIntervalRef = useRef<number | null>(null);
  const fidTimeoutRef = useRef<number | null>(null);
  const isDevMode = process.env.NODE_ENV !== "production";

  useEffect(() => {
    fetch("/api/telemetry?latency=80&label=web-vitals-page-probe&via=page-load").catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      if (shiftTimerRef.current) {
        window.clearTimeout(shiftTimerRef.current);
      }

      if (fidIntervalRef.current) {
        window.clearInterval(fidIntervalRef.current);
      }

      if (fidTimeoutRef.current) {
        window.clearTimeout(fidTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (scenario !== "fid-window") {
      return;
    }

    const announceTimer = window.setTimeout(() => {
      setNote(
        "Legacy first-input window armed. Click the amber button while the page is pulsing to encourage a FID sample.",
      );
      setFirstInputPulse("armed");
    }, 0);

    fidTimeoutRef.current = window.setTimeout(() => {
      let pulses = 0;

      setFirstInputPulse("running");
      fidIntervalRef.current = window.setInterval(() => {
        const start = performance.now();

        while (performance.now() - start < 120) {
          // Repeated short blocks make it easier to land a delayed first input.
        }

        pulses += 1;

        if (pulses >= 6) {
          if (fidIntervalRef.current) {
            window.clearInterval(fidIntervalRef.current);
          }

          setFirstInputPulse("complete");
        }
      }, 190);
    }, 900);

    return () => {
      window.clearTimeout(announceTimer);

      if (fidIntervalRef.current) {
        window.clearInterval(fidIntervalRef.current);
      }

      if (fidTimeoutRef.current) {
        window.clearTimeout(fidTimeoutRef.current);
      }
    };
  }, [scenario]);

  const generateInteractionDelay = () => {
    const start = performance.now();

    while (performance.now() - start < 90) {
      // Intentionally block the main thread to create an event timing sample.
    }

    faro.api.pushEvent(
      "event_timing.synthetic_interaction",
      {
        page: currentRoute,
        scenario: scenario || "default",
      },
      "event",
    );
    setNote("Synthetic interaction delay generated. Check the event timing ledger below.");
  };

  const armLayoutShiftProbe = () => {
    if (shiftTimerRef.current) {
      window.clearTimeout(shiftTimerRef.current);
    }

    setShiftVisible(false);
    setNote("Layout shift armed. A banner will appear after 850 ms to try to register CLS.");
    shiftTimerRef.current = window.setTimeout(() => {
      setShiftVisible(true);
      faro.api.pushEvent(
        "layout_shift.synthetic_probe",
        {
          page: currentRoute,
          scenario: scenario || "default",
        },
        "web-vitals",
      );
    }, 850);
  };

  const markFirstInputTap = () => {
    faro.api.pushEvent(
      "fid.synthetic_tap",
      {
        page: currentRoute,
        pulse: firstInputPulse,
      },
      "web-vitals",
    );
    setNote(
      firstInputPulse === "running"
        ? "First-input tap recorded during the pulse window. Check Faro's native web-vitals measurement in Grafana."
        : "Tap recorded. If you need a clearer FID sample, reload the legacy first-input scenario and click during the amber pulse.",
    );
  };

  const activeScenarioCopy =
    scenario === "ttfb"
      ? `Server response held for ${serverDelayMs} ms before rendering this route.`
      : scenario === "fcp"
        ? `Server response held for ${serverDelayMs} ms to shift first paint on this navigation.`
        : scenario === "lcp-image"
          ? `The hero image below waits ${imageDelayMs} ms before becoming the likely LCP candidate.`
          : scenario === "fid-window"
            ? "The page will pulse the main thread after load so your first click can be delayed."
            : "No reload scenario active. Use the launchers below to isolate a specific metric.";

  return (
    <div className="page-stack">
      {scenario === "lcp-image" && !elevateLcpStage ? (
        <section className="panel">
          <p className="eyebrow">LCP candidate area</p>
          <div className="hero-image-frame">
            <Image
              alt="Synthetic hero used to produce a largest contentful paint candidate."
              height={920}
              priority
              src={`/api/vital-image?delay=${imageDelayMs}&theme=teal&scenario=${scenario}`}
              unoptimized
              width={1400}
            />
          </div>
          <p className="small-copy">
            This image is promoted to the top of the page and marked `priority`
            so the LCP scenario measures the intended candidate instead of the
            surrounding copy blocks.
          </p>
        </section>
      ) : null}

      {scenario === "fid-window" ? (
        <section className="panel">
          <p className="eyebrow">Legacy first-input window</p>
          <div className={`pulse-stage pulse-${firstInputPulse}`}>
            <strong>
              {firstInputPulse === "armed"
                ? "Stand by. The pulse starts in a moment."
                : firstInputPulse === "running"
                  ? "Pulse active. Click now."
                  : firstInputPulse === "complete"
                    ? "Pulse complete. Reload to try again."
                    : "Reload the FID scenario to arm it."}
            </strong>
            <span>
              FID is legacy and browser-dependent. If no FID appears, compare INP and event timing instead.
            </span>
          </div>
          <button
            className={firstInputPulse === "running" ? "button" : "button button-ghost"}
            onClick={markFirstInputTap}
            type="button"
          >
            Capture first input tap
          </button>
        </section>
      ) : null}

      <section className="panel">
        <p className="eyebrow">Metric-specific launchers</p>
        <div className="scenario-grid">
          <div className="scenario-card">
            <span className="badge good">TTFB</span>
            <h2>Slow server response</h2>
            <p>Reload this route with a server hold to move TTFB and the first paint later.</p>
            <a className="button" href={scenarioHref("ttfb", 1200)}>
              Reload TTFB scenario
            </a>
          </div>
          <div className="scenario-card">
            <span className="badge good">FCP</span>
            <h2>Delayed first contentful paint</h2>
            <p>Reload with a shorter server hold to create a cleaner FCP shift without a huge payload.</p>
            <a className="button button-ghost" href={scenarioHref("fcp", 760)}>
              Reload FCP scenario
            </a>
          </div>
          <div className="scenario-card">
            <span className="badge good">LCP</span>
            <h2>Delayed hero image</h2>
            <p>Render a large same-origin SVG after a controlled wait so it becomes the visible LCP candidate.</p>
            <a className="button button-ghost" href={scenarioHref("lcp-image", 180, 900)}>
              Reload LCP scenario
            </a>
          </div>
          <div className="scenario-card">
            <span className="badge warn">CLS</span>
            <h2>Delayed layout shift</h2>
            <p>Insert a banner after the user-input grace window to try to produce an isolated CLS sample.</p>
            <button className="button button-ghost" onClick={armLayoutShiftProbe} type="button">
              Trigger CLS shift
            </button>
          </div>
          <div className="scenario-card">
            <span className="badge good">INP</span>
            <h2>Interaction delay</h2>
            <p>Block the main thread during a click handler and compare the resulting event timing entries.</p>
            <button className="button" onClick={generateInteractionDelay} type="button">
              Trigger INP interaction
            </button>
          </div>
          <div className="scenario-card">
            <span className="badge warn">FID</span>
            <h2>Legacy first-input pulse</h2>
            <p>Reload without touching the page, then click during the amber pulse if your browser still reports FID.</p>
            <a className="button button-ghost" href={scenarioHref("fid-window")}>
              Reload FID scenario
            </a>
          </div>
        </div>

        <div className="mini-grid">
          <div className="soft-tile">
            <p className="soft-label">Active scenario</p>
            <p className="small-copy">{activeScenarioCopy}</p>
          </div>
          <div className="soft-tile">
            <p className="soft-label">Metric availability</p>
            <p className="small-copy">
              `CLS`, `LCP`, and `INP` now stream interim changes during the run.
              `FID` is best-effort because modern browsers treat it as a legacy signal.
            </p>
          </div>
          <div className="soft-tile">
            <p className="soft-label">Reset</p>
            <p className="small-copy">
              Return to the neutral route after each reload-driven probe so the next reading is easier to interpret.
            </p>
            <a className="button button-ghost" href="/web-vitals">
              Reset to default
            </a>
          </div>
          {isDevMode ? (
            <div className="soft-tile soft-tile-warn">
              <p className="soft-label">Dev-mode warning</p>
              <p className="small-copy">
                Turbopack dev runtime, HMR, and React dev tooling can shift vitals. Use `npm run build && npm run start`
                when you want the cleanest numbers in Faro.
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">Native Faro web vitals</p>
        <div className="metric-grid">
          {Object.entries(thresholds).map(([name, threshold]) => (
            <div className="metric-tile" key={name}>
              <p className="metric-label">{name}</p>
              <p className="metric-value">{name === "CLS" ? "score" : "ms"}</p>
              <p className="metric-caption">{threshold}</p>
            </div>
          ))}
        </div>

        <div className="soft-tile">
          <p className="soft-label">Current route</p>
          <p className="small-copy mono">{currentRoute}</p>
        </div>

        <p className="small-copy">{note}</p>
      </section>

      <section className="panel">
        <p className="eyebrow">CLS probe area</p>
        {shiftVisible ? (
          <div className="shift-banner">
            Delayed banner inserted to provoke a layout shift after the click
            grace window has passed.
          </div>
        ) : (
          <div className="empty-state">
            No delayed layout shift is currently visible.
          </div>
        )}
      </section>

      <section className="panel">
        <p className="eyebrow">Recent event timing</p>
        {currentRouteEvents.length === 0 ? (
          <div className="empty-state">
            Generate the interaction delay once to collect `event` timing
            entries. These are separate from the vitals callback and are useful
            for diagnosing INP-style interaction cost.
          </div>
        ) : (
          <div className="ledger">
            {currentRouteEvents.slice(0, 8).map((event) => (
              <div className="ledger-row" key={event.id}>
                <div>
                  <strong>{event.name}</strong>
                  <span>
                    input {event.inputDelayMs.toFixed(0)} ms · handler{" "}
                    {event.handlerDurationMs.toFixed(0)} ms · presentation{" "}
                    {event.presentationDelayMs.toFixed(0)} ms
                  </span>
                </div>
                <span>{formatVitalValue("INP", event.duration)}</span>
                <span className={`badge ${event.duration <= 200 ? "good" : "warn"}`}>
                  interaction
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
