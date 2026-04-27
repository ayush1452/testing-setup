self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (
    url.origin !== self.location.origin ||
    url.pathname !== "/api/telemetry" ||
    url.searchParams.get("via") !== "service-worker"
  ) {
    return;
  }

  event.respondWith(handleTelemetryProbe(event.request));
});

async function handleTelemetryProbe(request) {
  const response = await fetch(request);
  const headers = new Headers(response.headers);

  headers.set("x-observability-worker", "handled");

  return new Response(await response.blob(), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
