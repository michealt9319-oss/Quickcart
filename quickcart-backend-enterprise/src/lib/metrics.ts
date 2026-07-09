// Deliberately not a full metrics library — a handful of counters covering
// the events worth alerting on, exposed as plain text a Prometheus scraper
// (or `curl` during an incident) can read directly. If you outgrow this
// (need histograms, percentiles, multi-instance aggregation), reach for
// prom-client and a real Prometheus/Grafana setup — this is the version
// worth having before that investment is justified.
const counters: Record<string, number> = {
  http_requests_total: 0,
  orders_created_total: 0,
  payments_confirmed_total: 0,
  webhook_failures_total: 0,
  errors_total: 0,
};

export function incrementMetric(name: keyof typeof counters, by = 1) {
  counters[name] = (counters[name] ?? 0) + by;
}

export function renderMetricsText(): string {
  return Object.entries(counters)
    .map(([name, value]) => `quickcart_${name} ${value}`)
    .join("\n") + "\n";
}
