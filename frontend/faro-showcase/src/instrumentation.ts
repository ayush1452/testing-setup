export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { OTLPHttpProtoTraceExporter, registerOTel } = await import("@vercel/otel");

  registerOTel({
    serviceName: "faro-showcase-server",
    traceExporter: new OTLPHttpProtoTraceExporter({
      url:
        process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
        "http://127.0.0.1:4318/v1/traces",
    }),
  });
}
