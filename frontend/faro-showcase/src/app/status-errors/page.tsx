import type { Metadata } from "next";
import { ErrorsLab } from "@/components/errors-lab";
import { StatusCodesLab } from "@/components/status-codes-lab";

export const metadata: Metadata = {
  title: "Status and Errors",
  description:
    "Legacy combined route for JavaScript error probes and HTTP status-code probes.",
};

export default function StatusErrorsPage() {
  return (
    <div className="page-stack">
      <section className="poster">
        <p className="eyebrow">Legacy combined lab</p>
        <h1 className="section-title">
          Runtime errors and HTTP statuses now live on separate pages, but this
          route still exposes both for compatibility.
        </h1>
        <p className="section-copy">
          Prefer `/js-errors` for exception families and `/status-codes` for
          response-code checks. This page keeps both blocks available so older
          links continue to work.
        </p>
      </section>
      <ErrorsLab />
      <StatusCodesLab />
    </div>
  );
}
