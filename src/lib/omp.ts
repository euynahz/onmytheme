import { execFileSync, execSync } from "child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "fs";
import { basename, isAbsolute, join, relative } from "path";
import { getConfiguredProfilePath, getConfiguredShell, getThemesDir } from "./config";
import { isValidThemeName } from "./theme-name";
import type { ThemeInfo } from "./types";

const THEME_EXTENSIONS = [".omp.json", ".omp.yaml"] as const;
const ACTIVE_THEME_COMMAND_PATTERN = /\boh-my-posh\s+init\s+[^\s]+/;
const THEME_CONFIG_PATTERN = /--config\s+"((?:\\.|[^"])*)"|--config\s+'((?:\\.|[^'])*)'|--config\s+([^\s]+)/;

export interface ThemeDirectoryOptions {
  includeBuiltin?: boolean;
}

export function getBuiltinThemesDir(): string | null {
  return getBuiltinThemeCandidates().find((directory) => existsSync(directory)) || null;
}

export function getThemeDirectories(
  options: ThemeDirectoryOptions = {},
): string[] {
  const directories: string[] = [];
  const themesDir = getThemesDir();

  if (existsSync(themesDir)) {
    directories.push(themesDir);
  }

  if (options.includeBuiltin !== false) {
    const builtinDir = getBuiltinThemesDir();
    if (builtinDir && !samePath(builtinDir, themesDir)) {
      directories.push(builtinDir);
    }
  }

  return directories;
}

export function listThemes(): ThemeInfo[] {
  const activePath = getActiveThemePath();
  const themes: ThemeInfo[] = [];
  const seenNames = new Set<string>();

  for (const directory of getThemeDirectories()) {
    let entries: string[];
    try {
      entries = readdirSync(directory);
    } catch {
      continue;
    }

    for (const filename of entries) {
      if (!isThemeFilename(filename)) continue;

      const name = getThemeName(filename);
      const nameKey = name.toLowerCase();
      if (seenNames.has(nameKey)) continue;
      seenNames.add(nameKey);

      const path = join(directory, filename);
      const metadata = getThemeMetadata(path);

      themes.push({
        name,
        filename,
        path,
        isActive: activePath ? samePath(path, activePath) : false,
        isInstalled: isManagedTheme(path),
        previewUrl: `/api/themes/${encodeURIComponent(name)}/preview`,
        ...metadata,
      });
    }
  }

  return themes.sort((left, right) => left.name.localeCompare(right.name));
}

export function getThemeContent(name: string): string | null {
  const themePath = getThemePath(name);
  return themePath ? readFileSync(themePath, "utf-8") : null;
}

export function getThemePath(name: string): string | null {
  if (!isValidThemeName(name)) return null;

  for (const directory of getThemeDirectories()) {
    for (const extension of THEME_EXTENSIONS) {
      const candidate = join(directory, `${name}${extension}`);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

export function isManagedTheme(themePath: string): boolean {
  const pathRelativeToThemesDir = relative(getThemesDir(), themePath);
  return (
    pathRelativeToThemesDir !== "" &&
    !pathRelativeToThemesDir.startsWith("..") &&
    !isAbsolute(pathRelativeToThemesDir)
  );
}

export function installTheme(themePath: string): string {
  if (!existsSync(themePath)) {
    throw new Error(`Theme file not found: ${themePath}`);
  }

  if (!isThemeFilename(basename(themePath))) {
    throw new Error("Unsupported theme file type");
  }

  const themesDir = getThemesDir();
  mkdirSync(themesDir, { recursive: true });

  const destination = join(themesDir, basename(themePath));
  if (!existsSync(destination)) {
    copyFileSync(themePath, destination);
  }

  return destination;
}

export function ensureOsc99(themePath: string): void {
  if (!existsSync(themePath) || !themePath.endsWith(".omp.json")) return;

  let content: string;
  let parsed: Record<string, unknown>;
  try {
    content = readFileSync(themePath, "utf-8");
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return;
  }

  const alreadyHasOsc99 =
    parsed.pwd === "osc99" || parsed.osc99 === true;
  if (alreadyHasOsc99) return;

  parsed.pwd = "osc99";

  writeFileSync(themePath, JSON.stringify(parsed, null, 2) + "\n", "utf-8");
}

export function generatePreviewImage(
  themePath: string,
  outputPath: string,
): Buffer | null {
  try {
    execFileSync(
      "oh-my-posh",
      ["config", "export", "image", "--config", themePath, "--output", outputPath],
      { stdio: "ignore", timeout: 15_000 },
    );

    return existsSync(outputPath) ? readFileSync(outputPath) : null;
  } catch {
    return null;
  }
}

export function generatePreviewText(themePath: string): string | null {
  try {
    return execFileSync("oh-my-posh", ["print", "primary", "--config", themePath], {
      encoding: "utf-8",
      timeout: 10_000,
      env: { ...process.env, POSH_SHELL_VERSION: "7.4.0" },
    });
  } catch {
    return null;
  }
}

export function getActiveThemePath(): string | null {
  const profilePath = getProfilePath(getConfiguredProfilePath());

  if (!existsSync(profilePath)) return null;

  try {
    const content = readFileSync(profilePath, "utf-8");
    const initLine = content
      .split(/\r?\n/)
      .find((line) => {
        const trimmed = line.trim();
        return !trimmed.startsWith("#") && ACTIVE_THEME_COMMAND_PATTERN.test(trimmed);
      });
    if (!initLine) return null;

    const configMatch = initLine.match(THEME_CONFIG_PATTERN);
    return configMatch?.[1] || configMatch?.[2] || configMatch?.[3] || null;
  } catch {
    return null;
  }
}

export function getProfilePath(configuredPath?: string): string {
  if (configuredPath) {
    // Verify the configured path exists; if not, fall back to detection
    if (existsSync(configuredPath)) {
      return configuredPath;
    }
  }

  if (process.platform === "win32") {
    const detected = detectPwshProfilePath();
    if (detected) return detected;

    const home = process.env.USERPROFILE || process.env.HOME || "";
    const candidates = [
      join(home, "Documents", "PowerShell", "Microsoft.PowerShell_profile.ps1"),
      join(home, "Documents", "WindowsPowerShell", "Microsoft.PowerShell_profile.ps1"),
    ];

    return candidates.find((candidate) => existsSync(candidate)) || candidates[0];
  }

  const shell = getConfiguredShell();
  const home = process.env.HOME || "";
  const candidates: Record<Exclude<typeof shell, "pwsh" | "powershell">, string> = {
    bash: join(home, ".bashrc"),
    zsh: join(home, ".zshrc"),
    fish: join(home, ".config", "fish", "config.fish"),
  };

  if (shell === "pwsh" || shell === "powershell") {
    return join(home, ".config", "powershell", "Microsoft.PowerShell_profile.ps1");
  }

  return candidates[shell];
}

function detectPwshProfilePath(): string | null {
  for (const exe of ["pwsh", "powershell"]) {
    try {
      const result = execFileSync(
        exe,
        ["-NoProfile", "-Command", "$PROFILE"],
        { encoding: "utf-8", timeout: 5_000 },
      ).trim();
      if (result) return result;
    } catch {
      continue;
    }
  }
  return null;
}

export function getActiveTheme(): string | null {
  const activePath = getActiveThemePath();
  return activePath ? getThemeName(basename(activePath)) : null;
}

function getBuiltinThemeCandidates(): string[] {
  const candidates: string[] = [];

  if (process.platform === "win32") {
    try {
      const appxInstallLocation = execSync(
        'powershell.exe -NoProfile -Command "(Get-AppxPackage -Name \'*ohmyposh*\').InstallLocation"',
        { encoding: "utf-8", timeout: 5_000 },
      ).trim();
      if (appxInstallLocation) {
        candidates.push(join(appxInstallLocation, "themes"));
      }
    } catch {
      // Oh My Posh was not installed from the Microsoft Store.
    }

    const localAppData = process.env.LOCALAPPDATA || "";
    const programFiles = process.env.ProgramFiles || "C:\\Program Files";
    candidates.push(
      join(localAppData, "Programs", "oh-my-posh", "themes"),
      join(programFiles, "oh-my-posh", "themes"),
    );
  } else {
    candidates.push(
      "/usr/local/share/oh-my-posh/themes",
      "/usr/share/oh-my-posh/themes",
      join(process.env.HOME || "", ".cache", "oh-my-posh", "themes"),
    );
  }

  return candidates;
}

function getThemeMetadata(themePath: string): {
  segmentTypes: string[];
  colors: string[];
} {
  try {
    return parseThemeContent(readFileSync(themePath, "utf-8"));
  } catch {
    return { segmentTypes: [], colors: [] };
  }
}

function parseThemeContent(content: string): {
  segmentTypes: string[];
  colors: string[];
} {
  const segmentTypes = new Set<string>();
  const colors = new Set<string>();

  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const blocks = parsed.blocks;

    if (Array.isArray(blocks)) {
      for (const block of blocks) {
        if (!block || typeof block !== "object") continue;
        const segments = (block as Record<string, unknown>).segments;
        if (!Array.isArray(segments)) continue;

        for (const segment of segments) {
          if (!segment || typeof segment !== "object") continue;
          const values = segment as Record<string, unknown>;
          if (typeof values.type === "string") segmentTypes.add(values.type);
          addColor(values.foreground, colors);
          addColor(values.background, colors);
        }
      }
    }

    const transientPrompt = parsed.transient_prompt;
    if (transientPrompt && typeof transientPrompt === "object") {
      const values = transientPrompt as Record<string, unknown>;
      addColor(values.foreground, colors);
      addColor(values.background, colors);
    }
  } catch {
    // YAML themes are still listed but do not expose parsed metadata.
  }

  return {
    segmentTypes: [...segmentTypes],
    colors: [...colors].slice(0, 6),
  };
}

function addColor(value: unknown, colors: Set<string>): void {
  if (typeof value === "string" && value.startsWith("#")) {
    colors.add(value);
  }
}

function isThemeFilename(filename: string): boolean {
  return THEME_EXTENSIONS.some((extension) => filename.endsWith(extension));
}

function getThemeName(filename: string): string {
  return filename.replace(/\.omp\.(json|yaml)$/, "");
}

function samePath(left: string, right: string): boolean {
  return process.platform === "win32"
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
}
