import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { dirname, isAbsolute, join, resolve } from "path";

export const DEFAULT_THEMES_DIR = join(homedir(), ".oh-my-theme", "themes");
export const DEFAULT_PORT = 4310;
const CONFIG_PATH = join(homedir(), ".oh-my-theme", "config.json");
const CONFIG_DIR = dirname(CONFIG_PATH);

export type Shell = "pwsh" | "powershell" | "zsh" | "bash" | "fish";

export interface OhMyThemeConfig {
  themesDir: string;
  shell: Shell;
  profilePath?: string;
}

export interface StoredOhMyThemeConfig {
  themesDir?: string;
  shell?: Shell;
  profilePath?: string;
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export function getThemesDir(): string {
  return loadConfig().themesDir;
}

export function getConfiguredProfilePath(): string | undefined {
  return loadConfig().profilePath;
}

export function getConfiguredShell(): Shell {
  return loadConfig().shell;
}

export function getDefaultConfig(): OhMyThemeConfig {
  return {
    themesDir: DEFAULT_THEMES_DIR,
    shell: getDefaultShell(),
  };
}

export function loadConfig(): OhMyThemeConfig {
  const defaults = getDefaultConfig();

  if (!existsSync(CONFIG_PATH)) {
    return defaults;
  }

  try {
    const rawConfig = JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as StoredOhMyThemeConfig;
    return normalizeConfig(rawConfig, defaults);
  } catch {
    return defaults;
  }
}

export function saveConfig(config: OhMyThemeConfig): void {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export function isInitialized(): boolean {
  return existsSync(CONFIG_PATH);
}

export function normalizeConfig(
  config: StoredOhMyThemeConfig,
  defaults: OhMyThemeConfig = getDefaultConfig(),
): OhMyThemeConfig {
  return {
    themesDir: resolvePath(config.themesDir || defaults.themesDir),
    shell: isShell(config.shell) ? config.shell : defaults.shell,
    ...(config.profilePath ? { profilePath: resolvePath(config.profilePath) } : {}),
  };
}

export function resolvePath(path: string): string {
  const expandedPath = expandHome(path);
  if (isAbsolute(expandedPath)) {
    return expandedPath;
  }

  return resolve(CONFIG_DIR, expandedPath);
}

export function expandHome(path: string): string {
  if (path === "~") return homedir();
  if (path.startsWith("~/") || path.startsWith("~\\")) {
    return join(homedir(), path.slice(2));
  }

  return path;
}

function getDefaultShell(): Shell {
  if (process.platform === "win32") {
    return "pwsh";
  }

  const shell = process.env.SHELL || "";
  if (shell.endsWith("/zsh")) return "zsh";
  if (shell.endsWith("/fish")) return "fish";
  return "bash";
}

function isShell(value: unknown): value is Shell {
  return (
    value === "pwsh" ||
    value === "powershell" ||
    value === "zsh" ||
    value === "bash" ||
    value === "fish"
  );
}
