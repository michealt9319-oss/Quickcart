import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { randomUUID } from "crypto";
import pinoHttp from "pino-http";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import path from "path";

import { logger } from "./logger";
import { loadSecretsIntoEnv } from "./lib/secrets";
import { incrementMetric, renderMetricsText } from "./lib/metrics";
import { publicApiLimiter, loginLimiter } from "./middleware/rateLimiter";
import { authRouter } from "./routes/auth";
import { mfaRouter } from "./routes/mfa";
import { organizationsRouter } from "./routes/organizations";
import { productsRouter } from "./routes/products";
import { supermarketsRouter } from "./routes/supermarkets";
import { ordersRouter } from "./routes/orders";
import { paymentsRouter } from "./routes/payments";
import { adminOrdersRouter } from "./routes/admin";
import { reportsRouter } from "./routes/reports";
import { devicesRouter } from "./routes/devices";
import { uploadsRouter } from "./routes/uploads";
import { apiKeysRouter } from "./routes/apiKeys";
import { dataRequestsRouter } from "./routes/dataRequests";
import { deliveryZonesRouter } from "./routes/deliveryZones";
import { errorHandler } from "./middleware/errorHandler";
import { query } from "./db";

export const app = express();

app.use(helmet());

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").map((o) => o.trim());
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : true }));

// Structured request logging with a request ID on every log line — the
// baseline for being able to trace one customer's request through logs
// once you have more than a handful of orders a day to sift through.
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => (req.headers["x-request-id"] as string) || randomUUID(),
  })
);

app.use((_req, _res, next) => {
  incrementMetric("http_requests_total");
  next();
});

// Both webhook paths need the raw body for signature verification. This
// mount matches by prefix, so it covers both /payments/webhook (Paystack)
// and /payments/webhook/flutterwave.
app.use("/api/v1/payments/webhook", express.raw({ type: "*/*" }));
app.use(express.json());

// Health check includes an actual database ping, not just "the process is
// running" — a load balancer or uptime monitor relying on this should
// treat a DB-down state as unhealthy, not a false positive.
app.get("/health", async (_req, res) => {
  try {
    await query("SELECT 1");
    res.json({ ok: true, db: "connected" });
  } catch {
    res.status(503).json({ ok: false, db: "unreachable" });
  }
});

app.get("/metrics", (_req, res) => {
  res.type("text/plain").send(renderMetricsText());
});

try {
  const openApiDocument = YAML.load(path.join(__dirname, "..", "openapi.yaml"));
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
} catch (err) {
  logger.warn("Could not load openapi.yaml — /docs will not be available");
}

app.use("/api/v1/auth/login", loginLimiter);
app.use("/api/v1", publicApiLimiter);

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/mfa", mfaRouter);
app.use("/api/v1/organizations", organizationsRouter);
app.use("/api/v1/products", productsRouter);
app.use("/api/v1/supermarkets", supermarketsRouter);
app.use("/api/v1/orders", ordersRouter);
app.use("/api/v1/payments", paymentsRouter);
app.use("/api/v1/admin/orders", adminOrdersRouter);
app.use("/api/v1/admin/reports", reportsRouter);
app.use("/api/v1/devices", devicesRouter);
app.use("/api/v1/uploads", uploadsRouter);
app.use("/api/v1/api-keys", apiKeysRouter);
app.use("/api/v1/data-requests", dataRequestsRouter);
app.use("/api/v1/delivery-zones", deliveryZonesRouter);

app.use(errorHandler);

// Only actually start listening outside of tests — tests import `app` and
// drive it with supertest directly, without binding a real port. Secrets
// are loaded (if configured) before the port opens, so the very first
// request served already has them in process.env.
if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT) || 4000;
  loadSecretsIntoEnv().then(() => {
    app.listen(port, () => {
      logger.info(`QuickCart Enterprise backend listening on port ${port}`);
    });
  });
}
