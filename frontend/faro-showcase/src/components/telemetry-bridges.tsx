"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import { sectionFromPath } from "@/lib/app-config";
import { faro, setupFaro, syncFaroRoute } from "@/lib/faro";
import { addWebVital } from "@/lib/telemetry-store-core";

type ReportMetric = Parameters<Parameters<typeof useReportWebVitals>[0]>[0];

function round(value: number) {
  return Number(value.toFixed(2));
}

export function TelemetryBridges() {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    setupFaro();
  }, []);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const handleMetric = useCallback((metric: ReportMetric) => {
    const currentPath = pathnameRef.current;

    addWebVital({
      id: `${metric.id}:${metric.name}`,
      name: metric.name,
      value: round(metric.value),
      delta: round(metric.delta),
      rating: metric.rating,
      navigationType: metric.navigationType ?? "navigate",
      path: currentPath,
      capturedAt: new Date().toISOString(),
    });

    faro.api.pushMeasurement(
      {
        type: `next.web_vital.${metric.name.toLowerCase()}`,
        values: {
          value: round(metric.value),
          delta: round(metric.delta),
        },
      },
      {
        context: {
          page: currentPath,
          rating: metric.rating,
          navigation_type: metric.navigationType ?? "navigate",
        },
      },
    );
  }, []);

  useReportWebVitals(handleMetric);

  useEffect(() => {
    syncFaroRoute(pathname);
    faro.api.pushEvent(
      "route.active",
      {
        path: pathname,
        section: sectionFromPath(pathname),
      },
      "navigation",
    );
  }, [pathname]);

  return null;
}
