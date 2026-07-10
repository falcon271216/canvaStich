import client from "prom-client";

export const register = new client.Registry();

try {
  client.collectDefaultMetrics({
    register,
    prefix: "excalidraw_http_",
  });
} catch (err) {
  console.warn("[metrics] collectDefaultMetrics skipped:", err);
}

export const httpRequestDuration = new client.Histogram({
  name: "excalidraw_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

export const httpRequestsTotal = new client.Counter({
  name: "excalidraw_http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status"],
  registers: [register],
});

export function getMetrics(): Promise<string> {
  return register.metrics();
}

export function getContentType(): string {
  return register.contentType;
}
