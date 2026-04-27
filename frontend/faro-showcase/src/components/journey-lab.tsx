"use client";

import { SpanStatusCode, trace } from "@opentelemetry/api";
import { startTransition, useState } from "react";
import { faro } from "@/lib/faro";
import { addTraceRun } from "@/lib/telemetry-store-core";
import { useTelemetryStore } from "@/lib/use-telemetry-store";

type JourneyKind =
  | "login-success"
  | "invalid-password"
  | "forgot-password"
  | "reset-password";

type JourneySpec = {
  badge: string;
  cta: string;
  description: string;
  label: string;
  latencyMs: number;
  rootSpan: string;
  status: number;
  steps: string[];
};

const journeySpecs: Record<JourneyKind, JourneySpec> = {
  "forgot-password": {
    badge: "Reset Email",
    cta: "Trigger forgot-password journey",
    description:
      "Queues a password reset email, audits the request, and returns an accepted response.",
    label: "journey-forgot-password",
    latencyMs: 300,
    rootSpan: "journey.auth.forgot_password",
    status: 202,
    steps: [
      "auth.validate_email",
      "auth.queue_reset_email",
      "auth.audit_request",
    ],
  },
  "invalid-password": {
    badge: "Login Fail",
    cta: "Trigger invalid-password journey",
    description:
      "Simulates a rejected password check and leaves the root span in an error state.",
    label: "journey-invalid-password",
    latencyMs: 240,
    rootSpan: "journey.auth.invalid_password",
    status: 401,
    steps: [
      "auth.validate_input",
      "auth.request_session",
      "auth.reject_password",
    ],
  },
  "login-success": {
    badge: "Login Success",
    cta: "Trigger login journey",
    description:
      "Validates email and password, requests a session, and persists the browser identity.",
    label: "journey-login-success",
    latencyMs: 180,
    rootSpan: "journey.auth.login_success",
    status: 200,
    steps: [
      "auth.validate_input",
      "auth.request_session",
      "auth.persist_identity",
    ],
  },
  "reset-password": {
    badge: "Reset Flow",
    cta: "Trigger password-reset journey",
    description:
      "Validates the reset token, writes the new password, and issues a fresh session.",
    label: "journey-reset-password",
    latencyMs: 260,
    rootSpan: "journey.auth.reset_password",
    status: 201,
    steps: [
      "auth.validate_reset_token",
      "auth.persist_new_password",
      "auth.issue_new_session",
    ],
  },
};

function sleep(durationMs: number) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@");

  if (!name || !domain) {
    return email;
  }

  const maskedName =
    name.length <= 2 ? `${name[0] ?? ""}•` : `${name.slice(0, 2)}${"•".repeat(name.length - 2)}`;

  return `${maskedName}@${domain}`;
}

function maskSecret(secret: string) {
  return "•".repeat(Math.max(6, Math.min(14, secret.length || 8)));
}

async function withJourneySpan<T>(
  name: string,
  work: () => Promise<T>,
  attributes: Record<string, number | string>,
) {
  const tracer = trace.getTracer("faro-showcase.journey-lab");

  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const value = await work();

      span.setStatus({ code: SpanStatusCode.OK });
      return value;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      span.recordException(err);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err.message,
      });

      throw err;
    } finally {
      span.end();
    }
  });
}

export function JourneyLab() {
  const traces = useTelemetryStore((state) =>
    state.traces.filter((run) => run.path === "/journeys"),
  );
  const [email, setEmail] = useState("operator@faro.local");
  const [password, setPassword] = useState("correct-horse-battery-staple");
  const [newPassword, setNewPassword] = useState("graph-signals-2026");
  const [running, setRunning] = useState<JourneyKind | "">("");
  const [message, setMessage] = useState(
    "Choose an auth journey to generate one browser root span and nested child spans under it.",
  );

  const runJourney = async (kind: JourneyKind) => {
    const spec = journeySpecs[kind];
    const tracer = trace.getTracer("faro-showcase.journey-lab");

    setRunning(kind);

    let traceId = "";
    let serverTraceId = "";
    let httpStatus = 0;

    try {
      await tracer.startActiveSpan(
        spec.rootSpan,
        {
          attributes: {
            "demo.flow": kind,
            "demo.page": "/journeys",
            "user.email_masked": maskEmail(email),
          },
        },
        async (rootSpan) => {
          try {
            traceId = rootSpan.spanContext().traceId;

            faro.api.pushEvent(
              "journey.started",
              {
                flow: kind,
                page: "/journeys",
                user_email: maskEmail(email),
              },
              "journey",
              {
                spanContext: rootSpan.spanContext(),
              },
            );

            await withJourneySpan(
              spec.steps[0],
              async () => {
                await sleep(60);
              },
              {
                "journey.step": spec.steps[0],
              },
            );

            await withJourneySpan(
              spec.steps[1],
              async () => {
                const response = await fetch(
                  `/api/telemetry?latency=${spec.latencyMs}&status=${spec.status}&bytes=4096&label=${spec.label}&run=${Date.now()}`,
                  {
                    cache: "no-store",
                  },
                );
                const payload = (await response.json()) as { traceId?: string };

                httpStatus = response.status;
                serverTraceId = payload.traceId ?? "";
              },
              {
                "journey.step": spec.steps[1],
                "journey.http_status": spec.status,
              },
            );

            await withJourneySpan(
              spec.steps[2],
              async () => {
                await sleep(kind === "reset-password" ? 96 : 72);
              },
              {
                "journey.step": spec.steps[2],
                "journey.password_masked":
                  kind === "forgot-password" ? "reset-email" : maskSecret(newPassword),
              },
            );

            faro.api.pushMeasurement(
              {
                type: "journey.summary",
                values: {
                  child_span_count: spec.steps.length,
                  http_status: httpStatus,
                  propagation_match: serverTraceId === traceId ? 1 : 0,
                },
              },
              {
                context: {
                  flow: kind,
                  page: "/journeys",
                },
                spanContext: rootSpan.spanContext(),
              },
            );

            if (httpStatus >= 400) {
              const error = new Error(`Synthetic auth failure for ${kind}`);

              rootSpan.recordException(error);
              rootSpan.setStatus({
                code: SpanStatusCode.ERROR,
                message: error.message,
              });

              faro.api.pushError(error, {
                type: "journey-auth",
                context: {
                  flow: kind,
                  page: "/journeys",
                  status: String(httpStatus),
                },
              });
            } else {
              rootSpan.setStatus({ code: SpanStatusCode.OK });
            }

            faro.api.pushEvent(
              "journey.completed",
              {
                flow: kind,
                page: "/journeys",
                status: String(httpStatus),
                trace_id: traceId,
                server_trace_id: serverTraceId || "missing",
              },
              "journey",
              {
                spanContext: rootSpan.spanContext(),
              },
            );
          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));

            rootSpan.recordException(err);
            rootSpan.setStatus({
              code: SpanStatusCode.ERROR,
              message: err.message,
            });

            faro.api.pushError(err, {
              type: "journey-lab",
              context: {
                flow: kind,
                page: "/journeys",
              },
            });
          } finally {
            rootSpan.end();
          }
        },
      );
    } finally {
      const propagationState = !serverTraceId
        ? "missing"
        : serverTraceId === traceId
          ? "matched"
          : "mismatched";

      startTransition(() => {
        addTraceRun({
          childSpans: journeySpecs[kind].steps,
          capturedAt: new Date().toISOString(),
          httpStatus,
          id: `${kind}:${traceId}:${Date.now()}`,
          path: "/journeys",
          propagationState,
          serverTraceId,
          traceId,
        });

        setMessage(
          propagationState === "matched"
            ? `${journeySpecs[kind].badge} completed with ${httpStatus || journeySpecs[kind].status} and trace ${traceId}.`
            : `${journeySpecs[kind].badge} ran, but the server trace did not match the browser root span.`,
        );
        setRunning("");
      });
    }
  };

  return (
    <div className="page-stack">
      <section className="panel">
        <p className="eyebrow">Synthetic auth payload</p>
        <div className="form-grid">
          <label className="field">
            <span>Email</span>
            <input
              className="input"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              className="input"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>
          <label className="field">
            <span>New password</span>
            <input
              className="input"
              onChange={(event) => setNewPassword(event.target.value)}
              type="password"
              value={newPassword}
            />
          </label>
        </div>

        <div className="mini-grid">
          <div className="soft-tile journey-stat">
            <p className="soft-label">Masked email</p>
            <p className="journey-stat-value mono">{maskEmail(email)}</p>
          </div>
          <div className="soft-tile journey-stat">
            <p className="soft-label">Password length</p>
            <p className="journey-stat-value">{password.length} chars</p>
          </div>
          <div className="soft-tile journey-stat">
            <p className="soft-label">Reset payload</p>
            <p className="journey-stat-value mono">{maskSecret(newPassword)}</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">Journey launchers</p>
        <div className="scenario-grid">
          {(Object.entries(journeySpecs) as [JourneyKind, JourneySpec][]).map(
            ([kind, spec]) => (
              <div className="scenario-card" key={kind}>
                <span className={`badge ${spec.status >= 400 ? "warn" : "good"}`}>
                  {spec.badge}
                </span>
                <h2>{spec.rootSpan}</h2>
                <p>{spec.description}</p>
                <div className="chip-row">
                  {spec.steps.map((step) => (
                    <span className="chip" key={step}>
                      {step}
                    </span>
                  ))}
                </div>
                <button
                  className="button"
                  disabled={running !== ""}
                  onClick={() => runJourney(kind)}
                  type="button"
                >
                  {running === kind ? "Running journey..." : spec.cta}
                </button>
              </div>
            ),
          )}
        </div>

        <p className="small-copy">{message}</p>
      </section>

      <div className="signal-grid">
        <section className="panel">
          <p className="eyebrow">Expected trace anatomy</p>
          <div className="trace-list">
            <div className="trace-step">
              <strong>journey.auth.*</strong>
              <span>browser root span for the chosen flow</span>
            </div>
            <div className="trace-step">
              <strong>auth.validate_*</strong>
              <span>local validation child span</span>
            </div>
            <div className="trace-step">
              <strong>auth.request_session / auth.queue_reset_email</strong>
              <span>client child span wrapped around the fetch</span>
            </div>
            <div className="trace-step">
              <strong>api.telemetry.demo</strong>
              <span>server child span exported to Tempo</span>
            </div>
            <div className="trace-step">
              <strong>auth.persist_* / auth.audit_request</strong>
              <span>final client child span</span>
            </div>
          </div>
        </section>

        <section className="panel">
          <p className="eyebrow">Recent journey traces</p>
          {traces.length === 0 ? (
            <div className="empty-state">
              Trigger one of the auth flows to capture a root trace and the
              propagated server span.
            </div>
          ) : (
            <div className="ledger">
              {traces.slice(0, 8).map((run) => (
                <div className="ledger-row" key={run.id}>
                  <div>
                    <strong className="mono">{run.traceId}</strong>
                    <span>{run.childSpans.join(" -> ")}</span>
                  </div>
                  <span>{run.httpStatus || "pending"}</span>
                  <span
                    className={`badge ${run.propagationState === "matched" ? "good" : "warn"}`}
                  >
                    {run.propagationState}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
