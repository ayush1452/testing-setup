import Link from "next/link";
import { appConfig } from "@/lib/app-config";
import { SidebarNav } from "./sidebar-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand-lockup">
          <p className="eyebrow">Next.js + Faro + Tempo</p>
          <Link className="brand-title" href="/">
            Faro Observatory
          </Link>
          <p className="brand-copy">
            A local browser observability studio for metrics, errors, resource
            timing, auth journeys, and traces.
          </p>
        </div>

        <SidebarNav />

        <div className="divider" />

        <div className="rail-notes">
          <span>
            App <strong>{appConfig.appUrl}</strong>
          </span>
          <span>
            Collector <strong>{appConfig.collectorUrl}</strong>
          </span>
          <span>
            Grafana <strong>{appConfig.grafanaUrl}</strong>
          </span>
        </div>
      </aside>

      <main className="main-stage">{children}</main>
    </div>
  );
}
