import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

// Validates and REPLACES req.body with the parsed (and type-coerced)
// result — routes downstream can trust req.body matches the schema
// exactly, rather than re-checking optional fields themselves.
export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "Invalid request body",
        details: result.error.flatten().fieldErrors,
      });
    }
    req.body = result.data;
    next();
  };
}
