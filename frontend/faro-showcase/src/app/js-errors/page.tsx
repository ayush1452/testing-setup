import type { Metadata } from "next";
import { ErrorsLab } from "@/components/errors-lab";

export const metadata: Metadata = {
  title: "JS Errors",
  description:
    "Trigger separate JavaScript error families and console noise without mixing them with HTTP status probes.",
};

export default function JsErrorsPage() {
  return (
    <div className="page-stack">
      <section className="poster">
        <p className="eyebrow">Runtime capture</p>
        <h1 className="section-title">
          Isolated JavaScript errors you can throw and inspect one by one.
        </h1>
        <p className="section-copy">
          Use this page to emit specific exception classes and console records.
          The goal is to make filtering in Faro, Loki, and Grafana Explore
          obvious instead of mixing runtime and HTTP signals together.
        </p>
      </section>
      <ErrorsLab />
    </div>
  );
}
