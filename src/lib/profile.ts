import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import { getConfiguredProfilePath, getConfiguredShell, type Shell } from "./config";
import { getProfilePath } from "./omp";

const THEME_CONFIG_ARGUMENT = "(?:\"(?:\\\\.|[^\"])*\"|'(?:\\\\.|[^'])*'|[^\\s]+)";
const BASH_ZSH_EVAL_PATTERN = new RegExp(
  `^eval\\s+\"\\$\\(oh-my-posh\\s+init\\s+(?:bash|zsh)(?:\\s+--config\\s+${THEME_CONFIG_ARGUMENT})?\\)\"\\s*$`,
);
const BASH_ZSH_SOURCE_PATTERN = new RegExp(
  `^oh-my-posh\\s+init\\s+(?:bash|zsh)(?:\\s+--config\\s+${THEME_CONFIG_ARGUMENT})?\\s*\\|\\s*source\\s*$`,
);
const FISH_SOURCE_PATTERN = new RegExp(
  `^oh-my-posh\\s+init\\s+fish(?:\\s+--config\\s+${THEME_CONFIG_ARGUMENT})?\\s*\\|\\s*source\\s*$`,
);
const POWERSHELL_INIT_PATTERN = new RegExp(
  `^oh-my-posh\\s+init\\s+(?:pwsh|powershell)(?:\\s+--config\\s+${THEME_CONFIG_ARGUMENT})?\\s*\\|\\s*Invoke-Expression\\s*$`,
  "i",
);
const ALL_SHELLS: Shell[] = ["pwsh", "powershell", "bash", "zsh", "fish"];

function resolveProfilePath(): string {
  return getProfilePath(getConfiguredProfilePath());
}

export function getProfilePathStr(): string {
  return resolveProfilePath();
}

export function readProfile(): string {
  const profilePath = resolveProfilePath();
  if (!existsSync(profilePath)) return "";
  return readFileSync(profilePath, "utf-8");
}

export function backupProfile(): string {
  const profilePath = resolveProfilePath();
  const content = readProfile();
  return createProfileBackup(profilePath, content);
}

export function hasActiveOhMyPoshInitialization(
  content: string,
  shell?: Shell,
): boolean {
  const shells = shell ? [shell] : ALL_SHELLS;
  return getProfileLines(content).some((line) =>
    shells.some((candidate) => isThemeInitializationLine(line, candidate)),
  );
}

export function switchTheme(newThemePath: string): {
  success: boolean;
  error?: string;
  backupPath?: string;
} {
  if (!existsSync(newThemePath)) {
    return { success: false, error: `Theme file not found: ${newThemePath}` };
  }

  const profilePath = resolveProfilePath();
  const content = readProfile();

  try {
    mkdirSync(dirname(profilePath), { recursive: true });
    const backupPath = createProfileBackup(profilePath, content);
    const newInitLine = getThemeInitializationLine(getConfiguredShell(), newThemePath);
    const newContent = replaceThemeInitialization(content, getConfiguredShell(), newInitLine);

    writeFileSync(profilePath, newContent, "utf-8");
    return { success: true, backupPath };
  } catch (error) {
    return {
      success: false,
      error: `Failed to write profile: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function getCurrentThemePath(): string | null {
  const initLine = getProfileLines(readProfile()).find((line) => {
    const trimmed = line.trim();
    return !isCommentedProfileLine(trimmed) && /\boh-my-posh\s+init\s+[^\s]+/.test(trimmed);
  });
  if (!initLine) return null;

  const configMatch = initLine.match(
    /--config\s+"((?:\\.|[^"])*)"|--config\s+'((?:\\.|[^'])*)'|--config\s+([^\s]+)/,
  );
  return configMatch?.[1] || configMatch?.[2] || configMatch?.[3] || null;
}

function createProfileBackup(profilePath: string, content: string): string {
  const backupPath = profilePath + `.backup.${Date.now()}`;
  writeFileSync(backupPath, content, "utf-8");
  return backupPath;
}

function replaceThemeInitialization(
  content: string,
  shell: Shell,
  newInitLine: string,
): string {
  const lines = getProfileLines(content);
  const index = lines.findIndex((line) => isThemeInitializationLine(line, shell));
  const newline = content.includes("\r\n") ? "\r\n" : "\n";

  if (index >= 0) {
    lines[index] = newInitLine;
    return lines.join(newline);
  }

  const separator = content && !content.endsWith("\n") ? newline : "";
  return `${content}${separator}${newInitLine}${newline}`;
}

function isThemeInitializationLine(line: string, shell: Shell): boolean {
  const trimmed = line.trim();
  if (!trimmed || isCommentedProfileLine(trimmed)) return false;

  switch (shell) {
    case "bash":
    case "zsh":
      return BASH_ZSH_EVAL_PATTERN.test(trimmed) || BASH_ZSH_SOURCE_PATTERN.test(trimmed);
    case "fish":
      return FISH_SOURCE_PATTERN.test(trimmed);
    case "pwsh":
    case "powershell":
      return POWERSHELL_INIT_PATTERN.test(trimmed);
  }
}

function isCommentedProfileLine(line: string): boolean {
  return line.startsWith("#");
}

function getProfileLines(content: string): string[] {
  return content.split(/\r?\n/);
}

function getThemeInitializationLine(shell: Shell, themePath: string): string {
  const quotedThemePath = quoteForShell(themePath, shell);

  switch (shell) {
    case "bash":
      return `eval "$(oh-my-posh init bash --config ${quotedThemePath})"`;
    case "zsh":
      return `eval "$(oh-my-posh init zsh --config ${quotedThemePath})"`;
    case "fish":
      return `oh-my-posh init fish --config ${quotedThemePath} | source`;
    case "powershell":
      return `oh-my-posh init powershell --config ${quotedThemePath} | Invoke-Expression`;
    case "pwsh":
      return `oh-my-posh init pwsh --config ${quotedThemePath} | Invoke-Expression`;
  }
}

function quoteForShell(value: string, shell: Shell): string {
  if (shell === "bash" || shell === "zsh" || shell === "fish") {
    return `'${value.replace(/'/g, "'\\\"'\\\"'")}'`;
  }

  return `"${value.replace(/"/g, '`"')}"`;
}
