import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

/**
 * Assigns a UUID to every incoming request, attaches it to `req.requestId`
 * so every subsequent log line for this request can include it, and echoes
 * it back in the `X-Request-Id` response header so a user-reported issue
 * can be traced to exact log lines (docs/02-architecture.md §11).
 *
 * If the caller already supplied an X-Request-Id (e.g., a mobile client or
 * an upstream proxy that generates its own), that's honored instead of
 * generating a new one, so a single logical request keeps one ID end to end.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  const id = incoming && incoming.trim().length > 0 ? incoming : randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}
