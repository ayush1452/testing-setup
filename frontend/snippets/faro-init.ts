import { getWebInstrumentations, initializeFaro } from '@grafana/faro-web-sdk';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';

export function setupFaro() {
  return initializeFaro({
    url: 'http://localhost:12347/collect',
    app: {
      name: 'your-app-name',
      version: '0.1.0',
      environment: 'local',
    },
    instrumentations: [
      ...getWebInstrumentations(),
      new TracingInstrumentation({
        instrumentationOptions: {
          propagateTraceHeaderCorsUrls: [window.location.origin],
        },
      }),
    ],
  });
}
