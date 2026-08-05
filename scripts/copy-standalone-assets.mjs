#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const standaloneDir = join(projectRoot, ".next", "standalone");
const standaloneStaticDir = join(standaloneDir, ".next", "static");
const staticDir = join(projectRoot, ".next", "static");
const publicDir = join(projectRoot, "public");
const nativePlatformPackages = [
  "@img/sharp-win32-x64",
  "@img/sharp-win32-ia32",
  "@img/sharp-win32-arm64",
  "@img/sharp-linux-x64",
  "@img/sharp-linux-arm64",
  "@img/sharp-linux-arm",
  "@img/sharp-darwin-x64",
  "@img/sharp-darwin-arm64",
  "@next/swc-win32-x64-msvc",
  "@next/swc-win32-arm64-msvc",
  "@next/swc-linux-x64-gnu",
  "@next/swc-linux-x64-musl",
  "@next/swc-linux-arm64-gnu",
  "@next/swc-linux-arm64-musl",
  "@next/swc-darwin-x64",
  "@next/swc-darwin-arm64",
];

function removePackage(path) {
  rmSync(path, { recursive: true, force: true });
}

function removeScopedPackages(scope, prefixes) {
  const scopeDirectory = join(standaloneDir, "node_modules", scope);
  if (!existsSync(scopeDirectory)) return;

  for (const entry of readdirSync(scopeDirectory)) {
    if (prefixes.some((prefix) => entry.startsWith(prefix))) {
      removePackage(join(scopeDirectory, entry));
    }
  }
}

if (!existsSync(join(standaloneDir, "server.js"))) {
  console.error("Next.js did not produce a standalone server. Run `next build` first.");
  process.exit(1);
}

rmSync(standaloneStaticDir, { recursive: true, force: true });
rmSync(join(standaloneDir, "public"), { recursive: true, force: true });
mkdirSync(standaloneStaticDir, { recursive: true });
cpSync(staticDir, standaloneStaticDir, { recursive: true });
cpSync(publicDir, join(standaloneDir, "public"), { recursive: true });

for (const packageName of nativePlatformPackages) {
  removePackage(join(standaloneDir, "node_modules", packageName));
}

removeScopedPackages("@img", ["sharp-", "sharp-libvips-"]);
removeScopedPackages("@next", ["swc-"]);
