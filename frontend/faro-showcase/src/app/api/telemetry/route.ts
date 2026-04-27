import { SpanStatusCode, trace } from "@opentelemetry/api";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const tracer = trace.getTracer("faro-showcase.server");
const baseProbeHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, traceparent, tracestate",
  "Access-Control-Expose-Headers":
    "server-timing, x-observability-label, x-observability-via",
  "Timing-Allow-Origin": "*",
} as const;

function clamp(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.min(maximum, Math.max(minimum, value));
}

function sleep(durationMs: number) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function buildPayload(bytes: number) {
  return "faro-observability-".repeat(Math.ceil(bytes / 19)).slice(0, bytes);
}

function buildProbeHeaders(label: string, serverTiming: string, via: string) {
  return new Headers({
    ...baseProbeHeaders,
    "Cache-Control": "no-store",
    "Server-Timing": serverTiming,
    "X-Observability-Label": label,
    "X-Observability-Via": via,
  });
}

async function withServerSpan<T>(
  name: string,
  durationMs: number,
  attributes: Record<string, number | string>,
  work?: () => Promise<T>,
) {
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      await sleep(durationMs);

      if (work) {
        return await work();
      }

      return undefined as T;
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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const latencyMs = clamp(Number(url.searchParams.get("latency") ?? 220), 60, 1600);
  const status = clamp(Number(url.searchParams.get("status") ?? 200), 200, 599);
  const bytes = clamp(Number(url.searchParams.get("bytes") ?? 8192), 256, 131072);
  const label = url.searchParams.get("label") ?? "telemetry-probe";
  const via = url.searchParams.get("via") ?? "direct";
  const responseLabel = status >= 400 ? "Synthetic upstream failure" : "Synthetic telemetry probe completed";

  return tracer.startActiveSpan(
    "api.telemetry.demo",
    {
      attributes: {
        "demo.status_code": status,
        "demo.latency_ms": latencyMs,
        "demo.payload_bytes": bytes,
        "demo.label": label,
        "demo.via": via,
        "http.route": "/api/telemetry",
      },
    },
    async (span) => {
      try {
        const phases = [
          { name: "config.lookup", durationMs: Math.round(latencyMs * 0.24) },
          { name: "upstream.wait", durationMs: Math.round(latencyMs * 0.46) },
          { name: "response.serialize", durationMs: Math.round(latencyMs * 0.3) },
        ];

        for (const phase of phases) {
          await withServerSpan(phase.name, phase.durationMs, {
            "demo.phase": phase.name,
            "demo.phase_ms": phase.durationMs,
          });
        }

        const payload = buildPayload(bytes);
        const serverTiming = phases
          .map((phase) => `${phase.name.replace(/\./g, "-")};dur=${phase.durationMs}`)
          .join(", ");

        const headers = buildProbeHeaders(label, serverTiming, via);

        if (status >= 400) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `Synthetic status ${status}`,
          });
        } else {
          span.setStatus({ code: SpanStatusCode.OK });
        }

        return NextResponse.json(
          {
            ok: status < 400,
            status,
            message: responseLabel,
            traceId: span.spanContext().traceId,
            receivedTraceparent: request.headers.get("traceparent"),
            bytes,
            label,
            via,
            phases,
            payload,
          },
          {
            status,
            headers,
          },
        );
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));

        span.recordException(err);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: err.message,
        });

        return NextResponse.json(
          {
            ok: false,
            status: 500,
            message: err.message,
            traceId: span.spanContext().traceId,
            receivedTraceparent: request.headers.get("traceparent"),
          },
          {
            status: 500,
            headers: baseProbeHeaders,
          },
        );
      } finally {
        span.end();
      }
    },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: baseProbeHeaders,
  });
}
