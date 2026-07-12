/**
 * config/env.ts runs its validation at module *import* time (`export const
 * env = loadEnv()`), which is exactly what makes "fails fast at startup"
 * true — but it also means testing failure paths requires re-importing the
 * module fresh for each case (`jest.resetModules()` + `require`) with
 * `process.exit` mocked to throw instead of actually killing the test
 * worker.
 */

const REQUIRED_BASE_ENV = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
};

describe('config/env — fail-fast validation', () => {
  const ORIGINAL_ENV = process.env;
  let exitSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code ?? 0}) called`);
    }) as never);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    exitSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  function setEnv(overrides: Record<string, string | undefined>): void {
    process.env = { ...ORIGINAL_ENV, ...REQUIRED_BASE_ENV, ...overrides };
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) delete process.env[key];
    }
  }

  it('loads successfully with all required variables present', () => {
    setEnv({ NODE_ENV: 'development' });
    expect(() => require('../../../src/config/env')).not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('exits the process when a required secret is missing', () => {
    setEnv({ NODE_ENV: 'development', JWT_ACCESS_SECRET: undefined });
    expect(() => require('../../../src/config/env')).toThrow(/process\.exit/);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits the process when a secret is shorter than 32 characters', () => {
    setEnv({ NODE_ENV: 'development', JWT_ACCESS_SECRET: 'too-short' });
    expect(() => require('../../../src/config/env')).toThrow(/process\.exit/);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits the process when DATABASE_URL is missing', () => {
    setEnv({ NODE_ENV: 'development', DATABASE_URL: undefined });
    expect(() => require('../../../src/config/env')).toThrow(/process\.exit/);
  });

  describe('production safety', () => {
    it('exits when CORS_ORIGIN is still the localhost development default', () => {
      setEnv({ NODE_ENV: 'production', CORS_ORIGIN: 'http://localhost:3000' });
      expect(() => require('../../../src/config/env')).toThrow(/process\.exit/);
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('exits when CORS_ORIGIN contains a wildcard', () => {
      setEnv({ NODE_ENV: 'production', CORS_ORIGIN: '*' });
      expect(() => require('../../../src/config/env')).toThrow(/process\.exit/);
    });

    it('accepts a real production origin', () => {
      setEnv({ NODE_ENV: 'production', CORS_ORIGIN: 'https://oasis.example.com' });
      expect(() => require('../../../src/config/env')).not.toThrow();
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('does NOT apply the production CORS check outside production', () => {
      setEnv({ NODE_ENV: 'development', CORS_ORIGIN: 'http://localhost:3000' });
      expect(() => require('../../../src/config/env')).not.toThrow();
      expect(exitSpy).not.toHaveBeenCalled();
    });
  });

  describe('SWAGGER_ENABLED boolean parsing', () => {
    it('defaults to true when unset', () => {
      setEnv({ NODE_ENV: 'development', SWAGGER_ENABLED: undefined });
      const { env } = require('../../../src/config/env');
      expect(env.SWAGGER_ENABLED).toBe(true);
    });

    it('parses "true" as true', () => {
      setEnv({ NODE_ENV: 'development', SWAGGER_ENABLED: 'true' });
      const { env } = require('../../../src/config/env');
      expect(env.SWAGGER_ENABLED).toBe(true);
    });

    it('parses "false" as false — NOT the Boolean("false")===true footgun', () => {
      setEnv({ NODE_ENV: 'development', SWAGGER_ENABLED: 'false' });
      const { env } = require('../../../src/config/env');
      expect(env.SWAGGER_ENABLED).toBe(false);
    });

    it('parses "0" as false and "1" as true', () => {
      setEnv({ NODE_ENV: 'development', SWAGGER_ENABLED: '0' });
      expect(require('../../../src/config/env').env.SWAGGER_ENABLED).toBe(false);

      jest.resetModules();
      setEnv({ NODE_ENV: 'development', SWAGGER_ENABLED: '1' });
      expect(require('../../../src/config/env').env.SWAGGER_ENABLED).toBe(true);
    });
  });
});
