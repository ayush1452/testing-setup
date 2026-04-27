import type { Metadata } from "next";
import { StatusCodesLab } from "@/components/status-codes-lab";

export const metadata: Metadata = {
  title: "Status Codes",
  description:
    "Trigger preset and custom HTTP response codes, including synthetic status 0, and send them into Faro.",
};

export default function StatusCodesPage() {
  return (
    <div className="page-stack">
      <section className="poster">
        <p className="eyebrow">HTTP responses</p>
        <h1 className="section-title">
          Preset and custom status codes with a dedicated status-zero path.
        </h1>
        <p className="section-copy">
          Test success, client error, server error, and custom status families on
          demand. Status `0` is simulated by aborting the request so you can
          inspect the browser-side failure shape separately.
        </p>
      </section>
      <StatusCodesLab />
    </div>
  );
}
