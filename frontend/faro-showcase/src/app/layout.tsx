import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { TelemetryBridges } from "@/components/telemetry-bridges";
import { appConfig } from "@/lib/app-config";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: appConfig.title,
    template: `%s | ${appConfig.title}`,
  },
  description:
    "A small multi-page Next.js app that proves Faro web vitals, auth journeys, JavaScript errors, status failures, and browser timing against Grafana Alloy, Loki, and Tempo.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <TelemetryBridges />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
