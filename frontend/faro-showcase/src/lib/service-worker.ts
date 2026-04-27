export type ServiceWorkerStatus = {
  supported: boolean;
  controlled: boolean;
  scope?: string;
  errorMessage?: string;
};

declare global {
  interface Window {
    __faroShowcaseServiceWorkerReady__?: Promise<ServiceWorkerStatus>;
  }
}

function waitForController(timeoutMs = 4000) {
  if (navigator.serviceWorker.controller) {
    return Promise.resolve(true);
  }

  return new Promise<boolean>((resolve) => {
    const onChange = () => {
      cleanup();
      resolve(true);
    };

    const cleanup = () => {
      clearTimeout(timeout);
      navigator.serviceWorker.removeEventListener("controllerchange", onChange);
    };

    const timeout = window.setTimeout(() => {
      cleanup();
      resolve(Boolean(navigator.serviceWorker.controller));
    }, timeoutMs);

    navigator.serviceWorker.addEventListener("controllerchange", onChange);
  });
}

export async function ensureObservabilityServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return {
      supported: false,
      controlled: false,
      errorMessage: "Service workers are not available in this browser.",
    } satisfies ServiceWorkerStatus;
  }

  if (!window.__faroShowcaseServiceWorkerReady__) {
    window.__faroShowcaseServiceWorkerReady__ = (async () => {
      try {
        const registration = await navigator.serviceWorker.register(
          "/sw-observability.js",
          {
            scope: "/",
          },
        );

        await navigator.serviceWorker.ready;
        const controlled = await waitForController();

        return {
          supported: true,
          controlled,
          scope: registration.scope,
        } satisfies ServiceWorkerStatus;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));

        return {
          supported: true,
          controlled: false,
          errorMessage: err.message,
        } satisfies ServiceWorkerStatus;
      }
    })();
  }

  return window.__faroShowcaseServiceWorkerReady__;
}
