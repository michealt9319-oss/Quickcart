import rateLimit from "express-rate-limit";

// Uses an in-memory store by default — correct for a single running
// instance. If REDIS_URL is set, switches to a Redis-backed store so
// limits are shared across multiple instances behind a load balancer.
// Requires the optional `rate-limit-redis` and `ioredis` packages (see
// package.json) — both are always installed here so this "just works" if
// you set REDIS_URL, but the memory store is what you should run until you
// actually deploy more than one instance of this API.
function buildStore() {
  if (!process.env.REDIS_URL) return undefined;

  try {
    // Required lazily so a missing/misconfigured Redis never breaks
    // startup for anyone not using it.
    const Redis = require("ioredis");
    const { RedisStore } = require("rate-limit-redis");
    const client = new Redis(process.env.REDIS_URL);
    return new RedisStore({
      sendCommand: (...args: string[]) => client.call(...args),
    });
  } catch (err) {
    console.error("Failed to initialize Redis rate-limit store, falling back to memory:", err);
    return undefined;
  }
}

export const publicApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore(),
  message: { error: "Too many requests — please slow down and try again shortly." },
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore(),
  message: { error: "Too many login attempts — please wait before trying again." },
});
