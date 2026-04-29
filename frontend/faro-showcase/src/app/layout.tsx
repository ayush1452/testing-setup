import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { FaroRouteSpan } from "@/components/FaroRouteSpan";
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
        <Suspense fallback={null}>
          <FaroRouteSpan />
        </Suspense>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
