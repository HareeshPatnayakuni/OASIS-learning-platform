import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { logger } from './lib/logger';
import { checkDatabaseConnection } from './lib/prisma';
import { requestId } from './middleware/requestId';
import { generalRateLimiter } from './middleware/rateLimiters';
import { notFoundHandler } from './middleware/notFoundHandler';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './modules/auth/auth.routes';
import { openapiSpec } from './docs/swagger';

export function createApp(): Express {
  const app = express();

  // Trust the first proxy hop (Render/Railway/DO/etc. all sit behind one) so
  // req.ip and rate limiting see the real client IP, not the proxy's.
  app.set('trust proxy', 1);

  app.use(requestId);
  app.use(helmet()); // NFR-SEC-6
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).requestId,
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      // Full body logging is deliberately off — logger.ts already redacts
      // known-sensitive fields, but keeping bodies out of access logs
      // entirely is the simpler, safer default (NFR-OBS-2).
      serializers: {
        req: (req: { method?: string; url?: string }) => ({ method: req.method, url: req.url }),
      },
    }),
  );

  app.use(generalRateLimiter); // NFR-SEC-5

  /**
   * @openapi
   * /health:
   *   get:
   *     tags: [System]
   *     summary: Liveness/readiness check
   *     responses:
   *       200: { description: Service and database are healthy }
   *       503: { description: Database is unreachable }
   */
  app.get('/health', (_req, res) => {
    checkDatabaseConnection()
      .then((dbHealthy) => {
        if (!dbHealthy) {
          res.status(503).json({ status: 'error', database: 'unreachable' });
          return;
        }
        res.status(200).json({ status: 'ok', database: 'connected' });
      })
      .catch(() => {
        res.status(503).json({ status: 'error', database: 'unreachable' });
      });
  });

  // Swagger/OpenAPI docs — see env.ts's SWAGGER_ENABLED comment for the
  // default-on-everywhere rationale; an operator can disable this per
  // deployment without a code change.
  if (env.SWAGGER_ENABLED) {
    app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));
    app.get('/api/v1/docs.json', (_req, res) => res.json(openapiSpec));
  }

  app.use('/api/v1/auth', authRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
