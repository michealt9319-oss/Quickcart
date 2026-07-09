// Basic load test using k6 (https://k6.io). Covers the read-heavy path
// most real traffic will actually hit — browsing and looking up orders —
// not a full checkout-to-payment flow, since that requires a real Paystack
// test transaction per virtual user, which doesn't make sense to automate
// against a live payment provider in a load test.
//
// This has NOT been run — there's no server running to run it against in
// this environment. Treat the thresholds below as reasonable starting
// targets to tune once you have a real deployment to point this at, not
// as validated numbers.
//
// Usage:
//   k6 run --env BASE_URL=https://api.quickcart.ng --env ORG_SLUG=quickcart-lagos docs/security/load-test.js

import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:4000";
const ORG_SLUG = __ENV.ORG_SLUG || "quickcart-lagos";

export const options = {
  stages: [
    { duration: "30s", target: 10 },  // ramp up to 10 virtual users
    { duration: "1m", target: 50 },   // ramp to 50, the realistic "busy lunch rush" guess
    { duration: "30s", target: 0 },   // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"], // 95% of requests under 500ms — a starting target, tune based on real traffic
    http_req_failed: ["rate<0.01"],   // under 1% error rate
  },
};

const headers = { "X-Organization-Slug": ORG_SLUG };

export default function () {
  // Browse products — the single most common request any real storefront sees.
  const productsRes = http.get(`${BASE_URL}/api/v1/products`, { headers });
  check(productsRes, {
    "products status is 200": (r) => r.status === 200,
    "products response has array": (r) => {
      try {
        return Array.isArray(JSON.parse(r.body).products);
      } catch {
        return false;
      }
    },
  });

  sleep(1);

  // Health check — cheap, but worth confirming it stays fast under load
  // too, since a monitoring system polling it shouldn't itself become a
  // load problem.
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, { "health status is 200 or 503": (r) => r.status === 200 || r.status === 503 });

  sleep(1);
}
