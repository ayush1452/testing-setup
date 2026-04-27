"use client";

import { useState } from "react";
import { faro } from "@/lib/faro";
import { addErrorRecord } from "@/lib/telemetry-store-core";
import { useTelemetryStore } from "@/lib/use-telemetry-store";

const presetStatuses = [200, 201, 400, 404, 0, 500] as const;

function statusLatency(status: number) {
  if (status === 0) {
    return 80;
  }

  if (status >= 500) {
    return 320;
  }

  if (status >= 400) {
    return 180;
  }

  return 120;
}

function rememberStatus(message: string, status: number) {
  addErrorRecord({
    capturedAt: new Date().toISOString(),
    id: `status:${status}:${Date.now()}`,
    kind: "status",
    message,
    path: "/status-codes",
    status,
  });
}

export function StatusCodesLab() {
  const statuses = useTelemetryStore((state) =>
    state.errors.filter((entry) => entry.kind === "status" && entry.path === "/status-codes"),
  );
  const [busy, setBusy] = useState<number | null>(null);
  const [customStatus, setCustomStatus] = useState("478");
  const [message, setMessage] = useState(
    "Pick a preset or enter a custom response code. Status 0 simulates a network abort.",
  );

  const runStatusProbe = async (status: number) => {
    setBusy(status);

    try {
      if (status === 0) {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 24);

        try {
          await fetch(
            `/api/telemetry?latency=200&status=200&bytes=4096&label=status-0-abort&run=${Date.now()}`,
            {
              cache: "no-store",
              signal: controller.signal,
            },
          );
        } catch {
          const syntheticError = new Error("Synthetic network abort mapped to status 0");

          faro.api.pushError(syntheticError, {
            type: "http-status",
            context: {
              page: "/status-codes",
              route: "/api/telemetry",
              status: "0",
              trigger: "abort",
            },
          });

          rememberStatus(syntheticError.message, 0);
          setMessage("Synthetic network abort completed and was recorded as status 0.");
        } finally {
          window.clearTimeout(timeout);
        }

        return;
      }

      const response = await fetch(
        `/api/telemetry?latency=${statusLatency(status)}&status=${status}&bytes=8192&label=status-${status}&run=${Date.now()}`,
        {
          cache: "no-store",
        },
      );
      const payload = (await response.json()) as { message?: string; traceId?: string };
      const statusMessage = `Synthetic HTTP ${response.status}: ${payload.message ?? "probe complete"}`;

      faro.api.pushMeasurement(
        {
          type: "status.probe.summary",
          values: {
            status_code: response.status,
            is_failure: response.status >= 400 ? 1 : 0,
          },
        },
        {
          context: {
            page: "/status-codes",
            route: "/api/telemetry",
            trace_id: payload.traceId ?? "missing",
          },
        },
      );

      if (response.status >= 400) {
        faro.api.pushError(new Error(statusMessage), {
          type: "http-status",
          context: {
            page: "/status-codes",
            route: "/api/telemetry",
            status: String(response.status),
          },
        });
      } else {
        faro.api.pushEvent(
          "status.probe.completed",
          {
            page: "/status-codes",
            status: String(response.status),
            trace_id: payload.traceId ?? "missing",
          },
          "status",
        );
      }

      rememberStatus(statusMessage, response.status);
      setMessage(statusMessage);
    } finally {
      setBusy(null);
    }
  };

  const submitCustomStatus = async () => {
    const parsed = Number(customStatus);

    if (!Number.isInteger(parsed) || (parsed !== 0 && (parsed < 200 || parsed > 599))) {
      setMessage("Use status 0 for an abort, or any integer from 200 through 599.");
      return;
    }

    await runStatusProbe(parsed);
  };

  return (
    <div className="page-stack">
      <section className="panel">
        <p className="eyebrow">Preset launchers</p>
        <div className="action-row">
          {presetStatuses.map((status) => (
            <button
              className={status >= 400 || status === 0 ? "button" : "button button-ghost"}
              disabled={busy !== null}
              key={status}
              onClick={() => runStatusProbe(status)}
              type="button"
            >
              {busy === status ? "Sending probe..." : `Trigger ${status}`}
            </button>
          ))}
        </div>

        <div className="form-grid">
          <label className="field">
            <span>Custom status</span>
            <input
              className="input"
              inputMode="numeric"
              onChange={(event) => setCustomStatus(event.target.value)}
              placeholder="478"
              type="text"
              value={customStatus}
            />
          </label>
          <div className="field action-field">
            <span>Run probe</span>
            <button className="button" disabled={busy !== null} onClick={submitCustomStatus} type="button">
              Trigger custom status
            </button>
          </div>
        </div>

        <div className="mini-grid">
          <div className="soft-tile">
            <p className="soft-label">Status 0</p>
            <p className="small-copy">
              This path aborts the request on purpose and records the result as a
              synthetic browser status `0`.
            </p>
          </div>
          <div className="soft-tile">
            <p className="soft-label">Latest probe</p>
            <p className="small-copy">{message}</p>
          </div>
          <div className="soft-tile">
            <p className="soft-label">Custom support</p>
            <p className="small-copy">
              Arbitrary statuses like `478` are returned by the probe API and
              mirrored into Faro with matching labels.
            </p>
          </div>
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">Status ledger</p>
        {statuses.length === 0 ? (
          <div className="empty-state">
            Trigger a response code to capture it locally and in Faro.
          </div>
        ) : (
          <div className="ledger">
            {statuses.slice(0, 10).map((entry) => (
              <div className="ledger-row" key={entry.id}>
                <div>
                  <strong>{entry.message}</strong>
                  <span>{entry.path}</span>
                </div>
                <span>{entry.capturedAt.slice(11, 19)}</span>
                <span
                  className={`badge ${
                    entry.status === 0 || (entry.status ?? 0) >= 400 ? "warn" : "good"
                  }`}
                >
                  {entry.status === 0 ? "status 0" : `HTTP ${entry.status}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
