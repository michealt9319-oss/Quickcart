import { Request, Response, NextFunction } from "express";
import { incrementMetric } from "../lib/metrics";

// Every route handler in this app is wrapped with asyncHandler (see
// lib/asyncHandler.ts), which forwards thrown errors here instead of
// crashing the process. Keeps error shape consistent for every client —
// web, iOS, and Android all get the same { error: string } JSON body.
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);
  incrementMetric("errors_total");
  const status = err.status || 500;
  const message = err.message || "Something went wrong. Please try again.";
  res.status(status).json({ error: message });
}
