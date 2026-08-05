#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const build = spawnSync(process.execPath, ["scripts/build-package.mjs"], {
  cwd: projectRoot,
  stdio: "inherit",
});

process.exit(build.status ?? 1);
