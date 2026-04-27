import { appConfig } from "@/lib/app-config";

export const dynamic = "force-dynamic";

function proxyHeaders(request: Request) {
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  const traceparent = request.headers.get("traceparent");
  const tracestate = request.headers.get("tracestate");
  const xApiKey = request.headers.get("x-api-key");
  const xFaroSessionId = request.headers.get("x-faro-session-id");
  const xScopeOrgId = request.headers.get("x-scope-orgid");

  if (contentType) {
    headers.set("content-type", contentType);
  }

  if (traceparent) {
    headers.set("traceparent", traceparent);
  }

  if (tracestate) {
    headers.set("tracestate", tracestate);
  }

  if (xApiKey) {
    headers.set("x-api-key", xApiKey);
  }

  if (xFaroSessionId) {
    headers.set("x-faro-session-id", xFaroSessionId);
  }

  if (xScopeOrgId) {
    headers.set("x-scope-orgid", xScopeOrgId);
  }

  return headers;
}

async function proxy(request: Request) {
  const body =
    request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();

  const response = await fetch(appConfig.collectorUpstreamUrl, {
    method: request.method,
    headers: proxyHeaders(request),
    body,
    cache: "no-store",
  });

  const responseHeaders = new Headers();
  const contentType = response.headers.get("content-type");

  if (contentType) {
    responseHeaders.set("content-type", contentType);
  }

  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}

export async function GET(request: Request) {
  return proxy(request);
}

export async function POST(request: Request) {
  return proxy(request);
}
