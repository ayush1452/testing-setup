import type { Metadata } from "next";
import { HttpLab } from "@/components/network-waterfall";

export const metadata: Metadata = {
  title: "HTTP Lab",
  description:
    "Trigger TTFB, transfer size, handshake, service-worker, and full resource timing scenarios separately.",
};

export default function HttpLabPage() {
  return (
    <div className="page-stack">
      <section className="poster">
        <p className="eyebrow">HTTP timing</p>
        <h1 className="section-title">
          Separate probes for TTFB, transfer time, TCP handshakes, and service worker timing.
        </h1>
        <p className="section-copy">
          This route exposes the low-level timing fields the browser records for
          fetches and navigations, including DNS lookup, TCP connect, TLS,
          request gap, first byte, response download, payload size, and worker time.
        </p>
      </section>
      <HttpLab />
    </div>
  );
}
