import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError';
import { logger } from '../lib/logger';
import { isProduction } from '../config/env';

/**
 * The single place that turns any thrown error into the response envelope
 * defined in docs/04-api-design.md §1: { error: { code, message, details? } }.
 *
 * NFR-SEC-8: never leaks a stack trace, SQL, or internal file paths to the
 * client in production — those still go to the structured log (with the
 * request's correlation ID attached), just not into the HTTP response body.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const apiError = normalizeError(err);

  const logPayload = {
    requestId: req.requestId,
    userId: req.user?.id,
    route: req.originalUrl,
    method: req.method,
    statusCode: apiError.statusCode,
    code: apiError.code,
    err: isProduction ? { message: apiError.message } : err,
  };

  if (apiError.isOperational) {
    logger.warn(logPayload, 'Request failed');
  } else {
    logger.error(logPayload, 'Unexpected error');
  }

  res.status(apiError.statusCode).json({
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.details !== undefined ? { details: apiError.details } : {}),
    },
  });
}

function normalizeError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;

  if (err instanceof ZodError) {
    return ApiError.badRequest(
      'VALIDATION_ERROR',
      'Request validation failed',
      err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    );
  }

  if (err instanceof Error) {
    return ApiError.internal(isProduction ? undefined : err.message);
  }

  return ApiError.internal();
}
