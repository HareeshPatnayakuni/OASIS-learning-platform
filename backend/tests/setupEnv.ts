/**
 * Runs before any test file's imports, per jest.config.js `setupFiles`. This
 * exists purely so src/config/env.ts's Zod validation (which calls
 * process.exit(1) on failure — appropriate for a real boot, not for a test
 * run) has valid values to read. These are dummy, non-secret values used
 * only in the test process.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/oasis_test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-characters-long';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters-long';
process.env.FRONTEND_URL = 'http://localhost:3000';
