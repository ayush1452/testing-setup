import type { Metadata } from "next";
import { WebVitalsDeck } from "@/components/web-vitals-deck";

export const metadata: Metadata = {
  title: "Web Vitals",
  description:
    "Trigger TTFB, FCP, LCP, CLS, INP, and legacy FID scenarios one by one and watch them flow into Faro.",
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

  if (serverDelayMs > 0) {
    await sleep(serverDelayMs);
  }

  return (
    <div className="page-stack">
      <section className="poster">
        <p className="eyebrow">Core Web Vitals</p>
        <h1 className="section-title">
          Separate launchers for TTFB, FCP, LCP, CLS, INP, and legacy FID in one Faro-fed lab.
        </h1>
        <p className="section-copy">
          Some vitals are reload-driven and some are interaction-driven. This
          route supports both: server-side waits for TTFB and FCP, a delayed
          hero asset for LCP, a late banner for CLS, a busy click handler for
          INP, and a pulse window for the browsers that still expose FID.
        </p>
      </section>
      <WebVitalsDeck
        imageDelayMs={imageDelayMs}
        scenario={scenario}
        serverDelayMs={serverDelayMs}
      />
    </div>
  );
}
