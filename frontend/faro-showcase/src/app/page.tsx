import { OverviewConsole } from "@/components/overview-console";

export default function Home() {
  return (
    <div className="page-stack">
      <section className="poster">
        <p className="eyebrow">Browser telemetry into the local LGTM stack</p>
        <h1 className="poster-title">Faro Observatory</h1>
        <p className="poster-copy">
          A compact Next.js observability studio built to trigger vitals,
          passwords and auth journeys, JavaScript error families, custom HTTP
          statuses, and deep browser timing signals into Grafana Alloy, Loki,
          and Tempo.
        </p>
        <div className="cta-row">
          <a className="button" href="/journeys">
            Run auth journeys
          </a>
          <a className="button button-ghost" href="/http-lab">
            Inspect HTTP timing
          </a>
        </div>
      </section>

      <section className="section-grid">
        <article className="panel">
          <p className="eyebrow">What this app proves</p>
          <ul className="bullet-list">
            <li>Separate launchers for TTFB, FCP, LCP, CLS, INP, and legacy FID scenarios.</li>
            <li>Auth journey tracing for sign-in, invalid password, forgot-password, and reset-password flows.</li>
            <li>Isolated JavaScript error families including TypeError, ReferenceError, SyntaxError, RangeError, and URIError.</li>
            <li>Preset and custom status codes including 200, 201, 400, 404, 0, 500, and arbitrary values like 478.</li>
            <li>Resource timing breakdowns for DNS, TCP, TLS, TTFB, transfer size, download, and service worker time.</li>
          </ul>
        </article>
        <article className="panel">
          <p className="eyebrow">Routes</p>
          <ul className="bullet-list">
            <li>`/web-vitals` isolates each metric with reload-driven and interaction-driven probes.</li>
            <li>`/journeys` traces realistic password and sign-in flows under one browser root span.</li>
            <li>`/js-errors` triggers separate JavaScript exception families without mixing in HTTP failures.</li>
            <li>`/status-codes` fires preset and custom response codes, including a synthetic status 0.</li>
            <li>`/http-lab` focuses on TTFB, transfer time, handshake timing, and service worker control.</li>
          </ul>
        </article>
      </section>

      <OverviewConsole />

      <section className="panel">
        <p className="eyebrow">Starter queries</p>
        <div className="code-grid">
          <div className="code-frame">
            <span className="code-label">Loki</span>
            <code>{'{job="faro-web"} |= "faro.performance.navigation"'}</code>
          </div>
          <div className="code-frame">
            <span className="code-label">Loki</span>
            <code>{'{job="faro-web"} | json | kind="measurement" | type="web-vitals"'}</code>
          </div>
          <div className="code-frame">
            <span className="code-label">Loki</span>
            <code>{'{job="faro-web"} |= "status.probe.summary"'}</code>
          </div>
          <div className="code-frame">
            <span className="code-label">Loki</span>
            <code>{'{job="faro-web", kind="error"}'}</code>
          </div>
          <div className="code-frame">
            <span className="code-label">Tempo</span>
            <code>Search for `journey.auth.login_success` or `api.telemetry.demo`</code>
          </div>
        </div>
      </section>
    </div>
  );
}
