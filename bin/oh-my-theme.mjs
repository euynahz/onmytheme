#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json");
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceEntry = resolve(projectRoot, "bin", "oh-my-theme.ts");

if (!existsSync(sourceEntry)) {
  console.error(
    "oh-my-theme was installed without its CLI source. Reinstall the package or report this packaging issue.",
  );
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ["--import", "tsx", sourceEntry, ...process.argv.slice(2)],
  {
    cwd: projectRoot,
    env: {
      ...process.env,
      OH_MY_THEME_VERSION: packageJson.version,
    },
    stdio: "inherit",
  },
);

if (result.error) {
  console.error(`Failed to start oh-my-theme: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
