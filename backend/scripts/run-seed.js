#!/usr/bin/env node
'use strict';

/**
 * Cross-platform replacement for the old `"seed": "NODE_PATH=./node_modules
 * tsx ../database/seed.ts"` script.
 *
 * ROOT CAUSE: `database/seed.ts` lives outside `backend/` (a sibling
 * directory, not a descendant), but it needs `backend/node_modules`'
 * packages (`bcrypt`, `@prisma/client`). Node.js resolves a bare
 * specifier like `require('bcrypt')` by walking up the directory tree
 * starting from the FILE doing the requiring, not from the process's
 * working directory — so from `database/seed.ts`, Node checks
 * `database/node_modules` (doesn't exist) and then the repo root's
 * `node_modules` (also doesn't exist, since `backend/` and `frontend/`
 * each have their own), and never finds `backend/node_modules` at all,
 * because it's a sibling of `database/`, not an ancestor.
 *
 * `NODE_PATH` is the standard Node.js escape hatch for exactly this —
 * an extra list of directories to search — but the previous fix set it
 * using `VAR=value command`, which is bash/zsh/sh syntax only. Windows
 * Command Prompt and PowerShell don't understand that syntax at all
 * (they'd try to run a program literally named `NODE_PATH=./node_modules`),
 * which is exactly the error reported.
 *
 * THE FIX: set NODE_PATH programmatically, via Node's own
 * `child_process` API, instead of shell syntax. `child_process.spawnSync`
 * takes an `env` object directly — this is a plain JavaScript object,
 * not a shell command string, so there's no shell-specific syntax
 * involved at all. The child `tsx` process reads `NODE_PATH` from its
 * own environment at startup exactly as it would if a shell had set it;
 * it has no way to tell the difference. This is the same technique the
 * `cross-env` package uses under the hood — reimplemented here directly
 * in ~25 lines using only Node's built-in `child_process` and `path`
 * modules, so no new dependency is needed for something this small.
 *
 * This file is invoked as `node scripts/run-seed.js` from
 * `backend/package.json`'s `seed` script — a plain `node <file>` command
 * has identical syntax on Command Prompt, PowerShell, bash, zsh, and sh,
 * so npm can run it the same way on every platform.
 */

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const backendDir = path.join(__dirname, '..');
const backendNodeModules = path.join(backendDir, 'node_modules');
const seedScript = path.join(backendDir, '..', 'database', 'seed.ts');
const tsxCli = require.resolve('tsx/cli');

const result = spawnSync(process.execPath, [tsxCli, seedScript], {
  cwd: backendDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_PATH: backendNodeModules,
  },
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status === null ? 1 : result.status);
