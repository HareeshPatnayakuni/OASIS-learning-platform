import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

/**
 * NFR-SEC-4: all input is validated server-side regardless of what the
 * client already validated. One middleware factory, reused by every module
 * — each module just supplies its own Zod schemas (see auth.validators.ts).
 *
 * On success, the parsed (and type-coerced) value REPLACES the raw
 * `req.body`/`req.query`/`req.params`, so controllers downstream can trust
 * the shape and types without re-checking.
 */
interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        // Zod's `.parse()` on an unparameterized `ZodSchema` returns `any`
        // by construction — this middleware is generic across every
        // module's schemas, so it can't know the concrete output type at
        // this call site (each route knows its own, via the exported
        // z.infer<> types in auth.validators.ts and friends). This is the
        // one deliberate boundary where "untyped in, validated out" is the
        // whole point of the function, not an oversight.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query) as typeof req.query;
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as typeof req.params;
      }
      next();
    } catch (err) {
      // ZodError is caught here and re-thrown as-is; errorHandler.ts knows
      // how to translate a ZodError into the standard error envelope, so
      // there's exactly one place that formats validation failures.
      next(err);
    }
  };
}

