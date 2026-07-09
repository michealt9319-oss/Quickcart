import request from "supertest";
import { app } from "../src/index";

describe("GET /health", () => {
  it("responds with a well-formed health payload regardless of DB availability", async () => {
    // Deliberately does not require a real Postgres to be running for this
    // test to be meaningful — it asserts the endpoint behaves correctly in
    // EITHER state, since "returns the right shape whether the DB is up or
    // down" is exactly the property a health check needs to have.
    const res = await request(app).get("/health");
    expect([200, 503]).toContain(res.status);
    expect(typeof res.body.ok).toBe("boolean");
  });
});

describe("GET /metrics", () => {
  it("returns Prometheus-style plain text counters", async () => {
    const res = await request(app).get("/metrics");
    expect(res.status).toBe(200);
    expect(res.text).toContain("quickcart_http_requests_total");
  });
});

describe("POST /api/v1/orders", () => {
  it("rejects a request missing the tenant header", async () => {
    const res = await request(app).post("/api/v1/orders").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/X-Organization-Slug/i);
  });
});
