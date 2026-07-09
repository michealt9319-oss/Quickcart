import pino from "pino";

// Structured (JSON) logging instead of console.log — the baseline for
// actually being able to search/alert on logs once you're running this
// somewhere with a real log aggregator (most hosts — Render, Railway, a
// VPS with Vector/Loki — can ingest JSON lines directly).
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: ["req.headers.authorization", "*.password", "*.password_hash"],
});
