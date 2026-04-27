import type { Metadata } from "next";
import { NetworkWaterfall } from "@/components/network-waterfall";

export const metadata: Metadata = {
  title: "Network Waterfall",
  description:
    "Legacy alias for the HTTP lab with redirect, DNS, TCP, TLS, service worker, payload, server timing, and TTFB probes.",
};

export default function NetworkWaterfallPage() {
  return (
    <div className="page-stack">
      <section className="poster">
        <p className="eyebrow">Legacy alias</p>
        <h1 className="section-title">
          The HTTP lab now owns the timing probes, but this route still works.
        </h1>
        <p className="section-copy">
          Use `/http-lab` in the main navigation for the current timing-focused
          experience. This alias keeps the original route name available.
        </p>
      </section>
      <NetworkWaterfall />
    </div>
  );
}
