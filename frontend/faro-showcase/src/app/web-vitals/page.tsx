import type { Metadata } from "next";
import Image from "next/image";
import { WebVitalsDeck } from "@/components/web-vitals-deck";

export const metadata: Metadata = {
  title: "Web Vitals",
  description:
    "Trigger TTFB, FCP, LCP, CLS, INP, and legacy FID scenarios one by one and watch Faro's native web-vitals measurements.",
};

export const dynamic = "force-dynamic";

function clamp(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.min(maximum, Math.max(minimum, value));
}

function sleep(durationMs: number) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

type WebVitalsPageProps = {
  searchParams: Promise<{
    delay?: string;
    imageDelay?: string;
    scenario?: string;
  }>;
};

export default async function WebVitalsPage({
  searchParams,
}: WebVitalsPageProps) {
  const params = await searchParams;
  const scenario = params.scenario ?? "";
  const serverDelayMs = clamp(Number(params.delay ?? 0), 0, 1800);
  const imageDelayMs = clamp(Number(params.imageDelay ?? 900), 0, 1800);
  const isScenarioFocused = scenario.length > 0;
  const elevateLcpStage = scenario === "lcp-image";

  if (serverDelayMs > 0) {
    await sleep(serverDelayMs);
  }

  return (
    <div className="page-stack">
      {elevateLcpStage ? (
        <section className="panel panel-stage">
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
            In focus mode the candidate moves ahead of the explanatory copy so
            the delayed image can actually compete for largest contentful paint.
          </p>
        </section>
      ) : null}

      <section className={`poster ${isScenarioFocused ? "poster-compact" : ""}`}>
        <p className="eyebrow">Core Web Vitals</p>
        <h1 className={`section-title ${isScenarioFocused ? "section-title-compact" : ""}`}>
          {scenario === "lcp-image"
            ? "LCP focus mode with the delayed image promoted higher in the viewport."
            : scenario === "fid-window"
              ? "Legacy first-input focus mode with a deliberate pulse window."
              : "Separate launchers for TTFB, FCP, LCP, CLS, INP, and legacy FID in one Faro-fed lab."}
        </h1>
        <p className="section-copy">
          {isScenarioFocused
            ? "This focused mode strips back the poster and moves the probe stage closer to the first viewport so the chosen metric is easier to interpret."
            : "Some vitals are reload-driven and some are interaction-driven. This route separates them with server-side waits for TTFB and FCP, a promoted hero asset for LCP, a late banner for CLS, a busy click handler for INP, and a pulse window for browsers that still expose FID."}
        </p>
      </section>
      <WebVitalsDeck
        elevateLcpStage={elevateLcpStage}
        imageDelayMs={imageDelayMs}
        scenario={scenario}
        serverDelayMs={serverDelayMs}
      />
    </div>
  );
}
