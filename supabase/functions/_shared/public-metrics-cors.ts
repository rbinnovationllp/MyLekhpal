export const publicMetricsAllowedOrigins = new Set([
  "https://mylekhpal.com",
  "https://www.mylekhpal.com",
  "http://localhost:5173",
]);

export const publicMetricsAllowedMethods = "POST, OPTIONS";
export const publicMetricsAllowedHeaders = "authorization, apikey, x-client-info, content-type";

export function publicMetricsCorsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !publicMetricsAllowedOrigins.has(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": publicMetricsAllowedMethods,
    "access-control-allow-headers": publicMetricsAllowedHeaders,
    vary: "origin",
  };
}
