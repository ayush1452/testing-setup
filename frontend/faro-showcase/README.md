# Faro Observatory

Small Next.js app for exercising browser-side Grafana Faro signals against the
local Alloy, Loki, Tempo, and Grafana stack in `frontend/`.

## Run

From the repo root:

```bash
docker compose up -d
cd frontend/faro-showcase
npm install
npm run dev
```

Open `http://localhost:3001`.

For cleaner Web Vitals numbers, use production mode:

```bash
npm run build
npm run start
```

## Faro Flow

The browser sends Faro payloads to the app-local endpoint:

```text
browser -> http://localhost:3001/collect -> http://localhost:12347/collect
```

The `/collect` route is a Next proxy for Alloy's Faro receiver. This keeps the
browser request same-origin and avoids CORS noise while still testing the real
Alloy receiver.

Faro setup lives in:

- `src/lib/faro.ts`: initializes Faro, enables native web vitals, resource timing, console/error instrumentation, tracing, and fetch/XHR parent-span wrapping.
- `src/components/FaroRouteSpan.tsx`: creates route spans, persists the previous span context in `sessionStorage`, sets the active page span, and keeps fetch/XHR spans under the current route trace.

There is no Next server OpenTelemetry hook in this app now. The showcase is
focused on browser Faro/RUM behavior. API routes still return the incoming
`traceparent` trace id so you can confirm browser propagation.

## Pages

- `/web-vitals`: trigger TTFB, FCP, LCP, CLS, INP, and legacy FID-style scenarios. Standard vitals are emitted by Faro as native `type="web-vitals"` measurements.
- `/js-errors`: trigger handled JS errors, unhandled rejections, console errors, and individual JavaScript error classes.
- `/status-codes`: trigger preset HTTP statuses or custom statuses like `478`.
- `/http-lab`: trigger resource timing scenarios for TTFB, download time, DNS/TCP/TLS, alternate host timing, and service-worker timing.
- `/journeys`: simulate auth/password journeys with browser root spans and nested child spans.
- `/trace-lab`, `/status-errors`, `/network-waterfall`: compatibility aliases for the newer pages.

## Queries

Use Grafana Explore with the Loki data source.

All Faro logs:

```logql
{job="faro-web"}
```

Native Web Vitals:

```logql
{job="faro-web"} | json | kind=`measurement` | type=`web-vitals`
```

Native navigation/resource events:

```logql
{job="faro-web"} |= "faro.performance.navigation"
```

```logql
{job="faro-web"} |= "faro.performance.resource"
```

Errors:

```logql
{job="faro-web", kind="error"}
```

Status probes:

```logql
{job="faro-web"} |= "status.probe.summary"
```

Custom demo event timing:

```logql
{job="faro-web"} | json | kind=`measurement` | type=`demo.performance.event_timing`
```

## Trace Checks

Open Grafana Explore with the Tempo data source and search for route or journey
span names:

```text
route:overview
route:web-vitals
journey.auth.login_success
journey.auth.invalid_password
```

Route spans are chained by the previous route span context stored in
`sessionStorage`. Fetch/XHR calls run inside the current page span context, so
browser request spans should appear below the active route span.

## Local Notes

- The app runs on `3001`; Grafana runs on `3000`.
- Alloy's Faro receiver listens on `12347`.
- Loki listens on `3100`.
- Tempo listens on `3200` and OTLP HTTP `4318`, but this app no longer exports Next server spans directly.
- The local in-memory store files are only for rendering demo ledgers in the UI. Faro ingestion does not depend on them.
