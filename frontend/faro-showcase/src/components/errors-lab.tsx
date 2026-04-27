"use client";

import { useState } from "react";
import { faro } from "@/lib/faro";
import { addErrorRecord } from "@/lib/telemetry-store-core";
import { useTelemetryStore } from "@/lib/use-telemetry-store";

function rememberError(
  kind: "console" | "handled" | "unhandled",
  error: Error | string,
) {
  const message = error instanceof Error ? error.message : error;

  addErrorRecord({
    capturedAt: new Date().toISOString(),
    kind,
    id: `${kind}:${message}:${Date.now()}`,
    message,
    path: "/js-errors",
  });
}

export function ErrorsLab() {
  const errors = useTelemetryStore((state) =>
    state.errors.filter((error) => error.path === "/js-errors"),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    "Launch one error family at a time to verify Faro capture without mixing in HTTP probes.",
  );

  const captureError = (
    kind: "handled" | "unhandled",
    error: Error,
    trigger: string,
  ) => {
    faro.api.pushError(error, {
      type: kind === "unhandled" ? "synthetic-unhandled-js" : "handled-js",
      context: {
        page: "/js-errors",
        trigger,
      },
    });

    rememberError(kind, error);
    setMessage(`${trigger} emitted: ${error.name} - ${error.message}`);
  };

  const emitHandledError = (factory: () => Error, trigger: string) => {
    try {
      throw factory();
    } catch (error) {
      captureError(
        "handled",
        error instanceof Error ? error : new Error(String(error)),
        trigger,
      );
    }
  };

  const emitConsoleError = () => {
    const error = new Error("Synthetic console.error emission from the Faro JS error lab");

    console.error(error);
    faro.api.pushEvent(
      "console.error.emitted",
      {
        page: "/js-errors",
        level: "error",
      },
      "errors",
    );
    rememberError("console", error);
    setMessage(`console.error emitted: ${error.message}`);
  };

  const emitAsyncRejection = () => {
    setTimeout(() => {
      captureError(
        "unhandled",
        new Error("Synthetic async rejection from the Faro JS error lab"),
        "async-rejection",
      );
    }, 0);
  };

  const emitSyntaxError = () => {
    try {
      JSON.parse("{bad-json");
    } catch (error) {
      captureError(
        "handled",
        error instanceof Error ? error : new Error(String(error)),
        "syntax-error",
      );
    }
  };

  const runAllErrorProbes = async () => {
    setBusy(true);

    try {
      emitHandledError(
        () => new Error("Synthetic generic Error from the Faro JS error lab"),
        "generic-error",
      );
      emitHandledError(
        () => new TypeError("Synthetic TypeError from the Faro JS error lab"),
        "type-error",
      );
      emitHandledError(
        () => new ReferenceError("Synthetic ReferenceError from the Faro JS error lab"),
        "reference-error",
      );
      emitSyntaxError();
      emitHandledError(
        () => {
          // `toFixed(101)` is guaranteed to throw a RangeError.
          Number(1).toFixed(101);
          return new RangeError("unreachable");
        },
        "range-error",
      );
      emitHandledError(
        () => {
          decodeURIComponent("%broken");
          return new URIError("unreachable");
        },
        "uri-error",
      );
      emitConsoleError();
      emitAsyncRejection();

      faro.api.pushEvent(
        "js_errors.full_sweep.completed",
        {
          page: "/js-errors",
        },
        "errors",
      );

      setMessage(
        "Full JS sweep emitted Error, TypeError, ReferenceError, SyntaxError, RangeError, URIError, console, and async rejection probes.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="signal-grid">
      <section className="panel">
        <p className="eyebrow">Emit probes</p>
        <div className="action-row">
          <button
            className="button"
            onClick={() =>
              emitHandledError(
                () => new Error("Synthetic generic Error from the Faro JS error lab"),
                "generic-error",
              )
            }
            type="button"
          >
            Generic Error
          </button>
          <button
            className="button button-ghost"
            onClick={() =>
              emitHandledError(
                () => new TypeError("Synthetic TypeError from the Faro JS error lab"),
                "type-error",
              )
            }
            type="button"
          >
            TypeError
          </button>
          <button
            className="button button-ghost"
            onClick={() =>
              emitHandledError(
                () => new ReferenceError("Synthetic ReferenceError from the Faro JS error lab"),
                "reference-error",
              )
            }
            type="button"
          >
            ReferenceError
          </button>
          <button className="button button-ghost" onClick={emitSyntaxError} type="button">
            SyntaxError
          </button>
          <button
            className="button button-ghost"
            onClick={() =>
              emitHandledError(
                () => {
                  Number(1).toFixed(101);
                  return new RangeError("unreachable");
                },
                "range-error",
              )
            }
            type="button"
          >
            RangeError
          </button>
          <button
            className="button button-ghost"
            onClick={() =>
              emitHandledError(
                () => {
                  decodeURIComponent("%broken");
                  return new URIError("unreachable");
                },
                "uri-error",
              )
            }
            type="button"
          >
            URIError
          </button>
          <button className="button button-ghost" onClick={emitConsoleError} type="button">
            Console error
          </button>
          <button className="button button-ghost" onClick={emitAsyncRejection} type="button">
            Async rejection
          </button>
          <button
            className="button"
            disabled={busy}
            onClick={runAllErrorProbes}
            type="button"
          >
            {busy ? "Running JS sweep..." : "Run JS sweep"}
          </button>
        </div>

        <div className="mini-grid">
          <div className="soft-tile">
            <p className="soft-label">What reaches Loki</p>
            <p className="small-copy">
              Each button emits a distinct exception name or console event so
              you can filter on `Error`, `TypeError`, `ReferenceError`,
              `SyntaxError`, `RangeError`, `URIError`, and synthetic rejection
              markers.
            </p>
          </div>
          <div className="soft-tile">
            <p className="soft-label">Latest emission</p>
            <p className="small-copy">{message}</p>
          </div>
          <div className="soft-tile">
            <p className="soft-label">Coverage</p>
            <p className="small-copy">
              The probes are isolated to JavaScript runtime error families. Use
              the separate status-code page for HTTP responses and network aborts.
            </p>
          </div>
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">Recent error ledger</p>
        {errors.length === 0 ? (
          <div className="empty-state">
            Trigger one of the probes to fill the local ledger and confirm Faro
            ingestion in Grafana Explore.
          </div>
        ) : (
          <div className="ledger">
            {errors.slice(0, 10).map((error) => (
              <div className="ledger-row" key={error.id}>
                <div>
                  <strong>{error.message}</strong>
                  <span>{error.path}</span>
                </div>
                <span>{error.capturedAt.slice(11, 19)}</span>
                <span className={`badge ${error.kind === "console" ? "warn" : "good"}`}>
                  {error.kind}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
