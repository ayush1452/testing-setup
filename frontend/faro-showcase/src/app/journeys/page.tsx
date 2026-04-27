import type { Metadata } from "next";
import { JourneyLab } from "@/components/journey-lab";

export const metadata: Metadata = {
  title: "Journeys",
  description:
    "Run sign-in, invalid password, forgot-password, and reset-password journeys with one browser root trace.",
};

export default function JourneysPage() {
  return (
    <div className="page-stack">
      <section className="poster">
        <p className="eyebrow">User journeys</p>
        <h1 className="section-title">
          Password and sign-in flows traced as realistic browser journeys.
        </h1>
        <p className="section-copy">
          Each action on this page creates one browser root span and nested child
          spans that model validation, network, and completion work. The server
          API join point stays inside the same trace when propagation is working.
        </p>
      </section>
      <JourneyLab />
    </div>
  );
}
