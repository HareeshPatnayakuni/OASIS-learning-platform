import type { NextFunction, Request, Response } from 'express';

/**
 * Express doesn't catch rejected promises from async route handlers on its
 * own (pre-Express 5). Wrapping every async handler in this is the
 * alternative to remembering a try/catch-and-next(err) in every controller
 * method — one place to get this right instead of N.
 */
export function asyncHandler<
  Req extends Request = Request,
  Res extends Response = Response,
>(fn: (req: Req, res: Res, next: NextFunction) => Promise<unknown>) {
  return (req: Req, res: Res, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
