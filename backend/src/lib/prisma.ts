import { PrismaClient } from '@prisma/client';
import { isProduction } from '../config/env';
import { logger } from './logger';

/**
 * Single shared PrismaClient instance for the whole process.
 *
 * A new PrismaClient per request (or per module) would exhaust Postgres
 * connections under load — Prisma's connection pool is meant to be created
 * once and reused. In dev, Node's module cache already gives us this for
 * free across a single process; ts-node-dev / tsx hot-reloads are the one
 * case that can create duplicate clients, which is why development logging
 * is louder here — if you see this log line twice in a row without a
 * restart, something is re-importing this module in a way that defeats the
 * singleton.
 */
export const prisma = new PrismaClient({
  log: isProduction
    ? [{ emit: 'event', level: 'error' }]
    : [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
});

// Route Prisma's own internal logging through our structured logger rather
// than letting it write directly to stdout in its own format — keeps every
// log line in the app consistently structured (docs/02-architecture.md §11).
//
// Note for Module 3 (once `prisma generate` has run for real, per
// docs/07-module-2-notes.md): the real generated client's $on overloads are
// keyed off the literal shape of the `log` array above. If TypeScript can't
// narrow the event name here once real types are in place, add `as const`
// to the array literal above rather than casting at each $on call site.
prisma.$on('warn', (e: unknown) => logger.warn({ prisma: e }, 'Prisma warning'));
prisma.$on('error', (e: unknown) => logger.error({ prisma: e }, 'Prisma error'));

/** Verifies the database is actually reachable — used at startup and by
 * GET /health (docs/06-deployment-and-docker.md §5). */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (err) {
    logger.error({ err }, 'Database connectivity check failed');
    return false;
  }
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
