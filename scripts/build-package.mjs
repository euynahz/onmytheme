#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const build = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], {
  cwd: projectRoot,
  stdio: "inherit",
});

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const copyAssets = spawnSync(process.execPath, ["scripts/copy-standalone-assets.mjs"], {
  cwd: projectRoot,
  stdio: "inherit",
});

process.exit(copyAssets.status ?? 1);
