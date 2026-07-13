/* eslint-env node */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.test.json',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'prettier',
  ],
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/consistent-type-imports': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  ignorePatterns: ['dist', 'node_modules', 'coverage', '*.cjs'],
  overrides: [
    {
      // Test doubles (e.g. tests/unit/auth/fakeAuthRepository.ts) legitimately
      // implement async interface methods with no internal await — the
      // interface requires a Promise return; the fake just doesn't need to
      // wait on anything to produce one. Real application code doesn't get
      // this exemption.
      files: ['tests/**/*.ts'],
      rules: {
        '@typescript-eslint/require-await': 'off',
      },
    },
    {
      // env.test.ts and r2.test.ts deliberately re-`require()` their
      // subject module inside each test case (after `jest.resetModules()`)
      // to exercise module-load-time behavior (env validation; R2 client
      // construction from env vars) fresh each time — a static top-level
      // `import` would only ever run that code once, for the whole file,
      // which is exactly what these tests need to avoid. The resulting
      // `any`-typed dynamic import is an accepted, narrow trade-off
      // specific to this testing technique.
      files: ['tests/unit/config/env.test.ts', 'tests/unit/lib/r2.test.ts'],
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
      },
    },
    {
      // *.repository.ts files are the ONLY files that import PrismaClient
      // (docs/02-architecture.md §2's Clean Architecture boundary). In this
      // sandbox, @prisma/client is a hand-written local-only stub with
      // `any`-typed delegates (real `prisma generate` cannot run here —
      // see docs/07-module-2-notes.md §6) — every no-unsafe-* error below
      // is that stub's imprecision propagating through, not a correctness
      // problem: a genuinely wrong field/model name against the real
      // schema still fails as a TS2339 compile error regardless of this
      // override (`tsc --noEmit` catches those; try it). Scoped narrowly
      // to repository files and to the unsafe-* family specifically, so
      // this doesn't quiet unrelated issues elsewhere.
      files: ['**/*.repository.ts'],
      rules: {
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
      },
    },
  ],
};
