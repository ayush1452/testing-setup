# Faro Observatory

This app is the browser-side demo for the local Grafana Faro stack in the parent
`frontend/` folder.

## Run it

```bash
docker compose up -d
cd frontend/faro-showcase
npm run dev
```

Open `http://localhost:3001`.

## What it covers

- `/web-vitals`: Next.js web vitals mirrored into Faro custom measurements
- `/status-errors`: handled JS errors, unhandled rejections, console errors, HTTP 503 probes
- `/network-waterfall`: DNS, TCP, TLS, TTFB, and resource duration
- `/trace-lab`: one browser parent trace with nested child spans and traced server work

## Verification targets

- Loki query: `{job="faro-web"} |= "next.web_vital"`
- Loki query: `{job="faro-web", kind="error"}`
- Tempo search: `journey.parent`
- Tempo search: `api.telemetry.demo`

## Notes

- The app runs on port `3001` so Grafana can keep `3000`.
- Browser telemetry posts to `http://localhost:12347/collect`.
- Server spans export to Tempo OTLP HTTP at `http://localhost:4318/v1/traces`.
