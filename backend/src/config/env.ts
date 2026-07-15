import 'dotenv/config';
import { z } from 'zod';

/**
 * Every environment variable the backend depends on is validated here, once,
 * at process start. If something required is missing or malformed, the
 * process fails fast with a clear message instead of surfacing a confusing
 * error deep inside a request handler later.
 *
 * Variable names and purposes match docs/06-deployment-and-docker.md §6 and
 * backend/.env.example exactly — this file is the enforcement of that
 * reference table, not a separate source of truth.
 */

const DEV_CORS_ORIGIN_DEFAULT = 'http://localhost:3000';

/**
 * `z.coerce.boolean()` is a footgun for env vars: JS's `Boolean("false")`
 * is `true`, so an operator setting `SWAGGER_ENABLED=false` would still
 * coerce to `true` and silently fail to disable anything. This parses the
 * textual forms an operator would actually type.
 */
function booleanEnv(defaultValue: boolean) {
  return z
    .string()
    .optional()
    .transform((val) => {
      if (val === undefined || val === '') return defaultValue;
      return val.toLowerCase() === 'true' || val === '1';
    });
}

/**
 * Same footgun as `booleanEnv`, different shape: `z.coerce.number()` on an
 * *empty string* (not a missing key) coerces via JS's `Number('')`, which
 * is `0`, not `NaN` — so a genuinely-optional numeric var left as
 * `SMTP_PORT=` (present, blank — exactly what a template `.env.example`
 * produces once a user removes a placeholder value) fails `.positive()`
 * with a confusing "must be greater than 0", even though `.optional()`
 * is already on the schema. `.optional()` only skips validation for
 * `undefined` (the key entirely absent), not for a present-but-blank
 * value — this treats blank the same as absent, for optional numeric vars.
 */
function optionalPositiveIntEnv() {
  return z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.coerce.number().int().positive().optional(),
  );
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  // Provisioned as a genuinely separate secret from JWT_ACCESS_SECRET (not
  // just a differently-named copy) — see src/utils/token.util.ts for
  // how it's actually used: refresh/verification tokens are opaque random
  // strings, not JWTs, so this isn't used to *sign* anything; it's used as
  // an HMAC pepper when hashing those tokens for storage, which is what
  // makes it a real, load-bearing secret rather than a declared-but-unused
  // one. See docs/07-module-2-notes.md for the full explanation.
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY_DAYS: z.coerce.number().int().positive().default(30),

  CORS_ORIGIN: z.string().default(DEV_CORS_ORIGIN_DEFAULT),

  // R2 — private bucket (lecture videos & notes). Not exercised by the Auth
  // module in Module 2, but validated now so config errors surface early
  // rather than resurfacing piecemeal in Module 3.
  R2_ACCOUNT_ID: z.string().optional(),
  R2_PRIVATE_ACCESS_KEY_ID: z.string().optional(),
  R2_PRIVATE_SECRET_ACCESS_KEY: z.string().optional(),
  R2_PRIVATE_BUCKET_NAME: z.string().default('oasis-private-content'),

  // R2 — public/media bucket
  R2_PUBLIC_ACCESS_KEY_ID: z.string().optional(),
  R2_PUBLIC_SECRET_ACCESS_KEY: z.string().optional(),
  R2_PUBLIC_BUCKET_NAME: z.string().default('oasis-public-media'),
  R2_PUBLIC_CDN_BASE_URL: z.string().optional(),

  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  ENQUIRY_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(3_600_000),
  ENQUIRY_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),

  // Auth-specific rate limits — not in the original env reference table
  // (Module 1 didn't design the Auth module's internals yet), added here
  // for the same reason Enquiry got its own: login/forgot-password are
  // public-facing, abuse-prone endpoints that deserve tighter limits than
  // the general API default.
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60_000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Used to build links embedded in verification/reset emails.
  FRONTEND_URL: z.string().default('http://localhost:3000'),

  // Transactional email — see src/lib/email.ts for the console-transport
  // fallback used when these aren't set (Module 2 default; a real provider
  // is wired in once credentials exist).
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: optionalPositiveIntEnv(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().default('OASIS <no-reply@oasis.example.com>'),

  // Swagger/OpenAPI docs (docs/04-api-design.md §1) are mounted at
  // /api/v1/docs. Defaults to enabled everywhere, including production —
  // the same docs are what a future Android/iOS team consumes (Module 1
  // brief) — but an operator can turn them off for a given deployment
  // without a code change.
  SWAGGER_ENABLED: booleanEnv(true),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('❌ Invalid environment configuration:');
    for (const issue of parsed.error.issues) {
      // eslint-disable-next-line no-console
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }

  validateProductionSafety(parsed.data);
  return parsed.data;
}

/**
 * Config that's merely "valid" per the schema above can still be unsafe in
 * production specifically (e.g. Zod is happy with CORS_ORIGIN left at its
 * localhost dev default, or set to a wildcard — neither is a schema
 * violation, both are a real problem in production). Checked separately,
 * after schema validation, so the two kinds of failure stay easy to tell
 * apart in the error output.
 */
function validateProductionSafety(data: Env): void {
  if (data.NODE_ENV !== 'production') return;

  const problems: string[] = [];
  if (data.CORS_ORIGIN.includes('*')) {
    problems.push('CORS_ORIGIN must not contain a wildcard ("*") in production.');
  }
  if (data.CORS_ORIGIN === DEV_CORS_ORIGIN_DEFAULT) {
    problems.push(
      'CORS_ORIGIN is still the localhost development default — set it to your real ' +
        'frontend origin(s) (comma-separated for more than one) before deploying to production.',
    );
  }

  if (problems.length > 0) {
    // eslint-disable-next-line no-console
    console.error('❌ Unsafe production configuration:');
    for (const problem of problems) {
      // eslint-disable-next-line no-console
      console.error(`  - ${problem}`);
    }
    process.exit(1);
  }
}

export const env = loadEnv();
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
