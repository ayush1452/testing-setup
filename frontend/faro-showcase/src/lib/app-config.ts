export const appConfig = {
  name: "faro-showcase",
  title: "Faro Observatory",
  version: "0.1.0",
  environment: process.env.NODE_ENV ?? "development",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001",
  collectorUrl: process.env.NEXT_PUBLIC_FARO_COLLECT_URL ?? "/collect",
  collectorUpstreamUrl:
    process.env.FARO_COLLECT_UPSTREAM_URL ?? "http://localhost:12347/collect",
  grafanaUrl: "http://localhost:3000",
  alloyUrl: "http://localhost:12345",
  tempoOtlpUrl:
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
    "http://127.0.0.1:4318/v1/traces",
} as const;

export const navItems = [
  { href: "/", label: "Overview", step: "00" },
  { href: "/web-vitals", label: "Web Vitals", step: "01" },
  { href: "/journeys", label: "Journeys", step: "02" },
  { href: "/js-errors", label: "JS Errors", step: "03" },
  { href: "/status-codes", label: "Status Codes", step: "04" },
  { href: "/http-lab", label: "HTTP Lab", step: "05" },
] as const;

export function sectionFromPath(pathname: string) {
  const normalizedPath = pathname.split("?")[0]?.split("#")[0] ?? pathname;

  if (normalizedPath === "/") {
    return "overview";
  }

  return normalizedPath.replace(/^\//, "").split("/")[0] || "overview";
}
