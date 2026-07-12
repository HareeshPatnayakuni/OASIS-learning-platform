import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { checkDatabaseConnection, disconnectPrisma } from './lib/prisma';

async function main(): Promise<void> {
  const dbHealthy = await checkDatabaseConnection();
  if (!dbHealthy) {
    logger.error('Could not connect to the database at startup. Check DATABASE_URL.');
    process.exit(1);
  }
  logger.info('Database connection established');

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`OASIS backend listening on port ${env.PORT} (${env.NODE_ENV})`);
    if (env.SWAGGER_ENABLED) {
      logger.info(`API docs available at http://localhost:${env.PORT}/api/v1/docs`);
    }
  });

  const shutdown = (signal: string): void => {
    logger.info(`${signal} received, shutting down gracefully`);
    server.close(() => {
      disconnectPrisma()
        .then(() => {
          logger.info('Shutdown complete');
          process.exit(0);
        })
        .catch((err: unknown) => {
          logger.error({ err }, 'Error during shutdown');
          process.exit(1);
        });
    });

    // Force-exit if graceful shutdown hangs (e.g. a stuck connection).
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Fatal error during startup:', err);
  process.exit(1);
});
