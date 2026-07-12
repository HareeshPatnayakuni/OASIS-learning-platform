import pino from 'pino';
import { env, isProduction } from '../config/env';

/**
 * Structured JSON logging to stdout, per docs/02-architecture.md §11.
 *
 * - `redact` guarantees secrets can't leak into a log line even if a
 *   developer accidentally logs a full request/response body — this is
 *   enforced here, not left to developer discipline (NFR-OBS-2).
 * - In development, pino-pretty would be nicer to read, but is deliberately
 *   NOT wired in here: it's a devDependency-only formatting layer, and
 *   pulling it in changes output shape between dev and prod, which is
 *   exactly the inconsistency structured logging is meant to avoid. If you
 *   want pretty local output, pipe `npm run dev | npx pino-pretty` — that
 *   keeps the app's own output format identical in every environment.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'oasis-backend' },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.passwordHash',
      '*.newPassword',
      '*.token',
      '*.accessToken',
      '*.refreshToken',
      '*.tokenHash',
      '*.razorpaySignature',
      '*.razorpayKeySecret',
    ],
    censor: '[REDACTED]',
  },
  formatters: isProduction
    ? undefined
    : {
        level: (label) => ({ level: label }),
      },
});
