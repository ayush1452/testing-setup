# CI/CD Pipeline — Faro Observatory

A GitHub Actions pipeline for the **Faro Observatory** frontend observability stack. Every push to `main` and every pull request runs a full quality gate: lint, vulnerability scan, build, tests, and coverage reporting.

---

## Pipeline Overview

```
                    ┌────────────────────────────────────────────┐
                    │          Trigger: push / PR to main        │
                    └───────────────────┬────────────────────────┘
                                        │
          ┌─────────────────────────────┼──────────────────────────────────┐
          │                             │                                  │
          │                             │                                  │
  ┌───────▼────────┐          ┌─────────▼──────────┐           ┌──────────▼──────────┐
  │  Lint          │          │  Vuln Check         │           │  Docker Compose     │
  │  ESLint        │          │  npm audit --high   │           │  Validate           │
  └───────┬────────┘          └────────────────────-┘           └─────────────────────┘
          │
          │                                         ┌──────────────────────────────┐
          │                                         │  Observability Validate      │
          │                                         │  ┌──────────────────────┐   │
          │                                         │  │ Alloy  fmt           │   │
          │                                         │  │ Loki  -verify-config │   │
          │                                         │  │ Tempo -verify-config │   │
          │                                         │  │ Grafana YAML parse   │   │
          │                                         │  └──────────────────────┘   │
          │                                         └──────────────────────────────┘
          │
  ┌───────▼────────────────────────────────────┐
  │  Build                                     │
  │  next build  →  upload .next artifact      │
  └───────┬────────────────────────────────────┘
          │
  ┌───────▼────────────────────────────────────┐
  │  Test & Coverage                           │
  │  download artifact  →  vitest --coverage   │
  └───────┬────────────────────────────────────┘
          │
  ┌───────▼────────────────────────────────────┐
  │  Upload to Codecov                         │
  │  lcov.info  →  PR comment + threshold gate │
  └────────────────────────────────────────────┘
```

---

## Jobs at a Glance

| # | Job | Runs after | What it does |
|---|-----|-----------|--------------|
| 1 | **Lint** | — | ESLint across all TypeScript source files |
| 2 | **Vulnerability Check** | — | `npm audit --audit-level=high` — fails on high/critical CVEs |
| 3 | **Docker Compose Validate** | — | `docker compose config` — validates service definitions, ports, and volume mounts |
| 4 | **Observability Validate** | — | Validates all four observability configs using each tool's own checker |
| 5 | **Build** | `lint` | `next build` with telemetry disabled, uploads `.next` as artifact |
| 6 | **Test & Coverage** | `build` | Vitest unit tests + V8 coverage, uploads `lcov.info` to Codecov |

Jobs 1–4 run **in parallel**. Build only starts when Lint passes. Test only starts when Build passes.

---

## File Structure

```
.
├── .github/
│   └── workflows/
│       └── ci.yml                       ← pipeline definition
├── codecov.yml                          ← coverage thresholds + PR comment layout
├── compose.yml                          ← root compose (includes frontend/compose.yml)
└── frontend/
    ├── compose.yml                      ← all four observability services
    ├── observability/
    │   ├── alloy/
    │   │   └── config.alloy             ← Faro receiver, Loki writer, Tempo exporter
    │   ├── grafana/
    │   │   └── provisioning/
    │   │       └── datasources/
    │   │           └── datasources.yml  ← Loki + Tempo auto-provisioned with trace↔log linking
    │   ├── loki/
    │   │   └── config.yml               ← TSDB v13, pattern ingester, structured metadata
    │   └── tempo/
    │       └── tempo.yml                ← OTLP receivers, local block storage, 24h retention
    └── faro-showcase/
        ├── vitest.config.ts             ← test runner + coverage config
        ├── package.json                 ← added: test, test:coverage scripts
        └── __tests__/
            ├── app-config.test.ts       ← 8 tests
            ├── performance.test.ts      ← 24 tests
            └── telemetry-store-core.test.ts ← 9 tests
```

---

## Coverage

Tests are scoped to pure utility libraries only. Browser-specific files (components, Faro SDK init, service worker, React hooks) are excluded from the coverage report.

**Covered files:**

| File | Statements | Branches | Functions |
|------|-----------|---------|----------|
| `lib/app-config.ts` | 100% | 80% | 100% |
| `lib/performance.ts` | 99.3% | 74.4% | 100% |
| `lib/telemetry-store-core.ts` | 100% | 100% | 100% |
| **Overall** | **99.6%** | **80.7%** | **100%** |

**Thresholds** (enforced in both `vitest.config.ts` and `codecov.yml`):

```
lines       ≥ 80%
functions   ≥ 80%
branches    ≥ 80%
statements  ≥ 80%
```

Codecov also enforces a **patch threshold** of 80% — any new code introduced in a PR must itself be 80% covered or the check fails.

---

## Running Locally

```bash
cd frontend/faro-showcase

# Run all tests
npm test

# Run with coverage report (also enforces thresholds)
npm run test:coverage

# Lint
npm run lint

# Vulnerability scan
npm audit --audit-level=high

# Validate the observability stack compose files (from repo root)
docker compose config
```

Coverage HTML report is written to `frontend/faro-showcase/coverage/index.html` — open it in a browser to explore line-by-line coverage.

---

## One-Time Setup: Codecov Token

The `test` job uploads coverage to Codecov. Before the upload step will succeed you need to add a secret to the repository:

1. Sign in at [codecov.io](https://codecov.io) and connect your GitHub repository
2. Copy the **Repository Upload Token** from Codecov's settings page
3. In GitHub: **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `CODECOV_TOKEN`
   - Value: _(paste the token)_

Once the secret exists, every run of the `test` job will post a coverage comment on the PR and enforce the 80% threshold gate.

---

## Dependency Notes

| Tool | Version | Purpose |
|------|---------|---------|
| `vitest` | `^2.0.0` | Test runner with native TypeScript support |
| `@vitest/coverage-v8` | `^2.0.0` | V8-based coverage provider (no Babel required) |
| `actions/checkout` | `v4` | Repo checkout |
| `actions/setup-node` | `v4` | Node.js 20 LTS with npm cache |
| `codecov/codecov-action` | `v4` | Uploads `lcov.info` and posts PR summary |

---

## Observability Stack

Two CI jobs guard the observability stack on every push and PR:

- **`docker-validate`** — runs `docker compose config` to verify service definitions, port bindings, and volume mount paths are correct
- **`observability-validate`** — runs each tool's own built-in config checker to catch invalid field names, wrong types, or bad values inside the config files themselves

Both run in parallel with Lint and Vuln Check, so they add zero time to the critical path.

The full stack is defined across two compose files:

```
compose.yml                          ← root (includes frontend/compose.yml)
└── frontend/
    ├── compose.yml                  ← all four services
    └── observability/
        ├── alloy/
        │   └── config.alloy         ← Faro receiver + Loki writer + Tempo exporter
        ├── grafana/
        │   └── provisioning/
        │       └── datasources/
        │           └── datasources.yml  ← auto-wires Loki + Tempo, trace↔log linking
        ├── loki/
        │   └── config.yml           ← TSDB schema v13, pattern ingester, structured metadata
        └── tempo/
            └── tempo.yml            ← OTLP/HTTP + gRPC receivers, local block storage
```

### Signal Flow

```
  Browser (Faro SDK)
       │
       │  logs + traces over HTTP
       ▼
  Next.js :3001
  /collect  ──────────────────────────────────────────────────────┐
                                                                   │ proxies to
                                                                   ▼
                                                     Grafana Alloy :12347
                                                     ┌─────────────────────┐
                                                     │  faro.receiver      │
                                                     │  • rate limit 50/s  │
                                                     │  • CORS: *          │
                                                     │  • labels:          │
                                                     │    env=docker-local │
                                                     │    job=faro-web     │
                                                     └──────┬──────────────┘
                                                            │
                                  ┌─────────────────────────┼──────────────────────┐
                                  │ logs                                  traces   │
                                  ▼                                                ▼
                        Loki :3100                                    Tempo :4318 (OTLP/HTTP)
                        ┌──────────────────┐                          ┌────────────────────┐
                        │ TSDB schema v13  │                          │ OTLP gRPC  :4317   │
                        │ filesystem store │                          │ OTLP HTTP  :4318   │
                        │ pattern ingester │                          │ block retention 24h│
                        │ structured meta  │                          │ local WAL + blocks │
                        └────────┬─────────┘                          └─────────┬──────────┘
                                 │                                               │
                                 └─────────────────┬─────────────────────────────┘
                                                   ▼
                                         Grafana :3000
                                  ┌──────────────────────────────┐
                                  │  Loki datasource (default)   │
                                  │  Tempo datasource            │
                                  │  ┌────────────────────────┐  │
                                  │  │ TraceID linking        │  │
                                  │  │ log regex → Tempo URL  │  │
                                  │  │ trace → logs ±1min     │  │
                                  │  │ node graph enabled     │  │
                                  │  └────────────────────────┘  │
                                  └──────────────────────────────┘
```

### CI Validation — What Each Step Catches

| Step | Command | What it catches |
|------|---------|----------------|
| **Alloy** | `alloy fmt config.alloy` | River language syntax errors — bad blocks, unknown component names, type mismatches |
| **Loki** | `loki -verify-config` | Invalid YAML keys, unknown schema versions, missing required sections, bad retention values |
| **Tempo** | `tempo -config.verify=true` | Invalid receiver config, unknown storage backends, bad duration strings |
| **Grafana datasources** | `python3 yaml.safe_load` | Malformed YAML, missing `datasources` root key |

> **What `docker compose config` catches (separately):** broken volume mount paths, undefined service references, duplicate port bindings, bad image names. It does not read or parse the contents of mounted config files.

---

### Component Reference

| Service | Image | Port(s) | Role |
|---------|-------|---------|------|
| **Alloy** | `grafana/alloy:v1.15.1` | `12345` (UI), `12347` (Faro receiver) | Ingestion gateway — receives Faro signals from the browser, fans out to Loki and Tempo |
| **Loki** | `grafana/loki:3.7.1` | `3100` | Log aggregation — stores browser logs with structured metadata and pattern detection |
| **Tempo** | `grafana/tempo:2.10.4` | `3200` (HTTP), `4317` (gRPC), `4318` (OTLP/HTTP) | Distributed tracing backend — stores OpenTelemetry traces from the frontend |
| **Grafana** | `grafana/grafana:13.0.1` | `3000` | Dashboards — auto-provisioned with Loki + Tempo datasources and trace↔log correlation |

### Key Configuration Details

**Alloy** (`observability/alloy/config.alloy`)
- Runs a `faro.receiver` on port `12347` accepting browser signals
- Rate-limited to `50 req/s` per app, burst `100`
- Writes logs to Loki and batches traces to Tempo over OTLP/HTTP
- Adds labels: `environment=docker-local`, `job=faro-web`, `stack=grafana-faro-local`

**Loki** (`observability/loki/config.yml`)
- Schema v13 with TSDB index, 24h index period
- Pattern ingester enabled for automatic log pattern detection
- Structured metadata and volume queries enabled
- Single-instance mode (replication factor 1, in-memory ring)

**Tempo** (`observability/tempo/tempo.yml`)
- Accepts traces via OTLP/HTTP on `:4318` and gRPC on `:4317`
- Local filesystem storage with WAL at `/var/tempo/wal`
- Block retention: `24h`, max ingester block duration: `5m`
- HTTP streaming enabled

**Grafana** (`observability/grafana/provisioning/datasources/datasources.yml`)
- Loki is the **default** datasource with a `TraceID` derived field — clicking a trace ID in a log line jumps directly to Tempo
- Tempo is linked back to Loki with a `±1 minute` time window around each span
- Node graph and service map enabled for distributed trace visualization

### Starting the Stack

```bash
# From repo root
docker compose up -d

# Services will be available at:
#   Next.js app   → http://localhost:3001
#   Grafana       → http://localhost:3000  (admin / admin)
#   Alloy UI      → http://localhost:12345
#   Loki          → http://localhost:3100
#   Tempo         → http://localhost:3200
```
