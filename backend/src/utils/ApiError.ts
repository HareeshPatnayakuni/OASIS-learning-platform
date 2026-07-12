/**
 * Every error the app intentionally throws (as opposed to a genuine bug)
 * should be an ApiError. The central error handler (middleware/errorHandler.ts)
 * knows how to turn one into the response envelope specified in
 * docs/04-api-design.md §1: { error: { code, message, details? } }.
 *
 * `code` is a stable, machine-readable string a future mobile client can
 * switch on; `message` is for humans and may change wording over time.
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  /** Set to true for errors that are expected/operational (bad input,
   * not-found, auth failure) vs. programmer errors/bugs. The error handler
   * uses this to decide whether to log at `warn` or `error` level. */
  public readonly isOperational: boolean;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    options: { details?: unknown; isOperational?: boolean } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = options.details;
    this.isOperational = options.isOperational ?? true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(code: string, message: string, details?: unknown): ApiError {
    return new ApiError(400, code, message, { details });
  }

  static unauthorized(code: string, message = 'Unauthorized'): ApiError {
    return new ApiError(401, code, message);
  }

  static forbidden(code: string, message = 'Forbidden'): ApiError {
    return new ApiError(403, code, message);
  }

  static notFound(code: string, message = 'Resource not found'): ApiError {
    return new ApiError(404, code, message);
  }

  static conflict(code: string, message: string, details?: unknown): ApiError {
    return new ApiError(409, code, message, { details });
  }

  static tooManyRequests(code: string, message = 'Too many requests'): ApiError {
    return new ApiError(429, code, message);
  }

  static internal(message = 'Internal server error'): ApiError {
    return new ApiError(500, 'INTERNAL_SERVER_ERROR', message, { isOperational: false });
  }
}
