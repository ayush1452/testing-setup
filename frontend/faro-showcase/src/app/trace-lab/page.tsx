import type { Metadata } from "next";
import { TraceLab } from "@/components/trace-lab";

export const metadata: Metadata = {
  title: "Trace Lab",
  description:
    "Legacy alias for the journey lab, which creates auth trace trees and verifies propagation into the server route.",
};

export default function TraceLabPage() {
  return (
    <div className="page-stack">
      <section className="poster">
        <p className="eyebrow">Legacy alias</p>
        <h1 className="section-title">
          The journey lab now owns the trace flows, but this route still works.
        </h1>
        <p className="section-copy">
          Use `/journeys` in the main navigation for the current auth-flow trace
          scenarios. This alias keeps the older route name available.
        </p>
      </section>
      <TraceLab />
    </div>
  );
}
