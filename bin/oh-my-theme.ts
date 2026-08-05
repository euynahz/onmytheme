import { execFileSync, spawn } from "child_process";
import { createServer } from "net";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { createRequire } from "module";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { Command } from "commander";
import prompts from "prompts";
import {
  DEFAULT_PORT,
  DEFAULT_THEMES_DIR,
  getConfigPath,
  isInitialized,
  loadConfig,
  resolvePath,
  type OhMyThemeConfig,
  type Shell,
  saveConfig,
} from "../src/lib/config";
import { downloadTheme } from "../src/lib/github";
import { getBuiltinThemesDir, getProfilePath, getThemePath, isManagedTheme, listThemes } from "../src/lib/omp";
import { hasActiveOhMyPoshInitialization, switchTheme } from "../src/lib/profile";
import { normalizeThemeName } from "../src/lib/theme-name";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as {
  version: string;
};
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STANDALONE_ROOT = join(PROJECT_ROOT, ".next", "standalone");
const STANDALONE_SERVER = join(STANDALONE_ROOT, "server.js");
const INIT_LINE_MARKER = "# Added by oh-my-theme";

interface UiOptions {
  port?: string;
  open?: boolean;
}

interface InstallOptions {
  apply?: boolean;
}

interface SelectOptions {
  apply?: boolean;
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("oh-my-theme")
    .description("Browse, install, and apply Oh My Posh themes.")
    .version(packageJson.version)
    .addHelpText(
      "after",
      "\nShort alias: omt\n\nRun `oh-my-theme init` once before using the other commands.",
    );

  program
    .command("init")
    .description("Configure oh-my-theme interactively.")
    .action(async () => {
      await initialize();
    });

  program
    .command("ui")
    .description("Start the local theme browser and open it in your browser.")
    .option("-p, --port <port>", "Local port to use", String(DEFAULT_PORT))
    .option("--no-open", "Do not open the browser automatically")
    .action(async (options: UiOptions) => {
      await launchUi(options);
    });

  program
    .command("ls")
    .alias("list")
    .description("List available local and built-in themes.")
    .option("--json", "Print machine-readable JSON")
    .action((options: { json?: boolean }) => {
      requireInitialization();
      printThemes(Boolean(options.json));
    });

  program
    .command("install <name>")
    .description("Download an official Oh My Posh theme into your themes directory.")
    .option("--apply", "Apply the theme after installing it")
    .action(async (name: string, options: InstallOptions) => {
      requireInitialization();
      await installTheme(name, Boolean(options.apply));
    });

  program
    .command("apply <name>")
    .description("Apply an installed theme to the configured shell profile.")
    .action((name: string) => {
      requireInitialization();
      applyTheme(name);
    });

  program
    .command("select")
    .description("Choose an installed theme interactively.")
    .option("--no-apply", "Choose a theme without applying it")
    .action(async (options: SelectOptions) => {
      requireInitialization();
      await selectTheme(options.apply !== false);
    });

  program
    .command("config")
    .description("Print the current configuration.")
    .action(() => {
      const config = loadConfig();
      console.log(JSON.stringify({ configPath: getConfigPath(), ...config }, null, 2));
    });

  await program.parseAsync(process.argv);
}

async function initialize(): Promise<void> {
  const existingConfig = loadConfig();

  if (isInitialized()) {
    console.log(`Existing configuration found at ${getConfigPath()}.`);
  } else {
    console.log("Welcome to oh-my-theme. Let’s configure your local theme workspace.");
  }

  const answers = await prompts(
    [
      {
        type: "text",
        name: "themesDir",
        message: "Where should downloaded themes be stored?",
        initial: existingConfig.themesDir || DEFAULT_THEMES_DIR,
        validate: (value) =>
          value.trim() ? true : "A theme directory is required.",
      },
      {
        type: "select",
        name: "shell",
        message: "Which shell should receive applied themes?",
        initial: shellChoices.findIndex((choice) => choice.value === existingConfig.shell),
        choices: shellChoices,
      },
      {
        type: "text",
        name: "profilePath",
        message: "Which shell profile should be updated?",
        initial: getProfilePath(existingConfig.profilePath),
        validate: (value) =>
          value.trim() ? true : "A shell profile path is required.",
      },
    ],
    {
      onCancel: () => {
        console.log("\nSetup cancelled. No changes were made.");
        process.exitCode = 1;
        return false;
      },
    },
  );

  if (!answers.themesDir || !answers.shell || !answers.profilePath) return;

  const config: OhMyThemeConfig = {
    themesDir: resolvePath(answers.themesDir),
    shell: answers.shell as Shell,
    profilePath: resolvePath(answers.profilePath),
  };

  mkdirSync(config.themesDir, { recursive: true });
  saveConfig(config);

  console.log(`\nSaved configuration to ${getConfigPath()}.`);
  console.log(`Themes directory: ${config.themesDir}`);
  console.log(`Shell profile: ${config.profilePath}`);

  const builtinCount = linkBuiltinThemes(config.themesDir);
  if (builtinCount > 0) {
    console.log(`Linked ${builtinCount} built-in themes to ${config.themesDir}.`);
  }

  if (!isOhMyPoshAvailable()) {
    console.log(
      "\nOh My Posh was not found on PATH. Install it before applying or previewing themes: https://ohmyposh.dev/docs/installation",
    );
  }

  const setup = await prompts({
    type: "confirm",
    name: "installInit",
    message: "Add the Oh My Posh initialization line to this shell profile now?",
    initial: true,
  }, {
    onCancel: () => {
      console.log("\nProfile setup cancelled. No changes were made to the shell profile.");
      return false;
    },
  });

  if (setup.installInit) {
    const profileResult = ensureProfileInitialization(config);
    console.log(profileResult.message);
  }

  console.log("\nNext steps:");
  console.log("  oh-my-theme install jandedobbeleer --apply");
  console.log("  oh-my-theme ui");
  console.log("  omt ls");
}

async function launchUi(options: UiOptions): Promise<void> {
  requireInitialization();
  const requestedPort = parsePort(options.port);
  const port = await getAvailablePort(requestedPort);
  const url = `http://127.0.0.1:${port}`;

  if (port !== requestedPort) {
    console.log(`Port ${requestedPort} is in use; using ${port} instead.`);
  }

  console.log(`Starting Oh My Theme at ${url}`);
  const child = spawnNextServer(port);

  let stopped = false;
  const stop = (signal: NodeJS.Signals) => {
    if (stopped) return;
    stopped = true;
    child.kill(signal);
  };

  process.once("SIGINT", () => stop("SIGINT"));
  process.once("SIGTERM", () => stop("SIGTERM"));

  try {
    await waitForServer(url, child);
    console.log(`Open ${url} in your browser. Press Ctrl+C to stop the server.`);
    if (options.open !== false) {
      openBrowser(url);
    }
  } catch (error) {
    child.kill();
    throw error;
  }

  await new Promise<void>((resolveProcess) => {
    child.once("exit", () => resolveProcess());
  });
}

function spawnNextServer(port: number) {
  if (!existsSync(STANDALONE_SERVER)) {
    throw new Error(
      "The bundled UI is missing. Reinstall oh-my-theme or report this packaging issue.",
    );
  }

  return spawn(process.execPath, [STANDALONE_SERVER], {
    cwd: STANDALONE_ROOT,
    env: { ...process.env, PORT: String(port), HOSTNAME: "127.0.0.1" },
    stdio: "inherit",
  });
}

function printThemes(asJson: boolean): void {
  const themes = listThemes();

  if (asJson) {
    console.log(JSON.stringify(themes, null, 2));
    return;
  }

  if (themes.length === 0) {
    console.log("No themes found.");
    console.log(`Install one with: oh-my-theme install <name>`);
    return;
  }

  console.log(`Themes (${themes.length})\n`);
  for (const theme of themes) {
    const active = theme.isActive ? " * active" : "";
    console.log(`${theme.name.padEnd(30)} ${theme.path}${active}`);
  }
}

async function installTheme(rawName: string, shouldApply: boolean): Promise<void> {
  const name = normalizeThemeName(rawName);
  if (!name) {
    throw new Error("Theme names may only contain letters, numbers, dots, underscores, and hyphens.");
  }

  const { themesDir } = loadConfig();
  console.log(`Installing ${name} into ${themesDir}…`);
  const result = await downloadTheme(name, themesDir);

  if (!result.success || !result.path) {
    throw new Error(result.error || `Unable to install ${name}.`);
  }

  console.log(`Installed ${name}: ${result.path}`);
  if (shouldApply) {
    applyTheme(name);
  } else {
    console.log(`Apply it with: oh-my-theme apply ${name}`);
  }
}

function applyTheme(rawName: string): void {
  const name = normalizeThemeName(rawName);
  if (!name) {
    throw new Error("Theme names may only contain letters, numbers, dots, underscores, and hyphens.");
  }

  const localThemePath = getThemePath(name);
  if (!localThemePath || !isManagedTheme(localThemePath)) {
    throw new Error(`Theme “${rawName}” is not installed. Run: oh-my-theme install ${rawName}`);
  }

  const config = loadConfig();
  const result = switchTheme(localThemePath);
  if (!result.success) {
    throw new Error(result.error || "Failed to apply theme.");
  }

  console.log(`Applied ${name} to ${config.profilePath || getProfilePath()}.`);
  if (result.backupPath) {
    console.log(`Profile backup: ${result.backupPath}`);
  }
}

async function selectTheme(shouldApply: boolean): Promise<void> {
  const themes = listThemes();
  if (themes.length === 0) {
    throw new Error("No themes found. Install one first with: oh-my-theme install <name>");
  }

  const answer = await prompts({
    type: "autocomplete",
    name: "theme",
    message: "Choose a theme",
    choices: themes.map((theme) => ({
      title: `${theme.name}${theme.isActive ? " (active)" : ""}`,
      value: theme.name,
    })),
  });

  if (!answer.theme) return;
  if (shouldApply) {
    applyTheme(answer.theme);
  } else {
    console.log(`Selected ${answer.theme}. Apply it with: oh-my-theme apply ${answer.theme}`);
  }
}

function ensureProfileInitialization(config: OhMyThemeConfig): {
  success: boolean;
  message: string;
} {
  const profilePath = config.profilePath || getProfilePath();
  const profileDirectory = dirname(profilePath);

  try {
    mkdirSync(profileDirectory, { recursive: true });
    const existing = existsSync(profilePath) ? readFileSync(profilePath, "utf-8") : "";
    const initLine = getInitializationLine(config.shell);

    if (hasActiveOhMyPoshInitialization(existing, config.shell)) {
      const cleaned = cleanExternalConfigPaths(existing, config);
      if (cleaned !== existing) {
        writeFileSync(profilePath, cleaned, "utf-8");
        return { success: true, message: `Updated Oh My Posh initialization in ${profilePath} to remove external theme paths.` };
      }
      return { success: true, message: "Oh My Posh initialization is already present in the shell profile." };
    }

    const separator = existing && !existing.endsWith("\n") ? "\n" : "";
    writeFileSync(
      profilePath,
      `${existing}${separator}${INIT_LINE_MARKER}\n${initLine}\n`,
      "utf-8",
    );

    // Verify the write succeeded
    const written = readFileSync(profilePath, "utf-8");
    if (!written.includes(initLine)) {
      return {
        success: false,
        message: `Failed to verify the initialization line in ${profilePath}. The file may not have been updated correctly.`,
      };
    }

    return { success: true, message: `Added Oh My Posh initialization to ${profilePath}.` };
  } catch (error) {
    return {
      success: false,
      message: `Unable to update shell profile: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function getInitializationLine(shell: Shell): string {
  switch (shell) {
    case "fish":
      return "oh-my-posh init fish | source";
    case "bash":
      return 'eval "$(oh-my-posh init bash)"';
    case "zsh":
      return 'eval "$(oh-my-posh init zsh)"';
    case "powershell":
      return "oh-my-posh init powershell | Invoke-Expression";
    case "pwsh":
      return "oh-my-posh init pwsh | Invoke-Expression";
  }
}

function linkBuiltinThemes(themesDir: string): number {
  const builtinDir = getBuiltinThemesDir();
  if (!builtinDir) return 0;

  let count = 0;
  let entries: string[];
  try {
    entries = readdirSync(builtinDir);
  } catch {
    return 0;
  }

  for (const filename of entries) {
    if (!filename.endsWith(".omp.json") && !filename.endsWith(".omp.yaml")) continue;
    const src = join(builtinDir, filename);
    const dest = join(themesDir, filename);
    if (!existsSync(dest)) {
      try {
        copyFileSync(src, dest);
        count++;
      } catch {
        // Skip files that cannot be copied.
      }
    }
  }

  return count;
}

const THEME_CONFIG_ARGUMENT = "(?:\"(?:\\\\.|[^\"])*\"|'(?:\\\\.|[^'])*'|[^\\s]+)";

function cleanExternalConfigPaths(content: string, config: OhMyThemeConfig): string {
  const lines = content.split(/\r?\n/);
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const themeConfigPattern = new RegExp(
    `^(oh-my-posh\\s+init\\s+(?:pwsh|powershell|bash|zsh|fish))(\\s+--config\\s+${THEME_CONFIG_ARGUMENT})(.*)$`,
    "i",
  );

  let changed = false;
  const cleaned = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;

    const match = trimmed.match(themeConfigPattern);
    if (!match) return line;

    const configPath = extractConfigPath(trimmed);
    if (!configPath) return line;

    // If the config path is already inside the user's themes directory, leave it alone.
    if (isPathUnderDirectory(configPath, config.themesDir)) return line;

    // Remove the --config argument so oh-my-posh uses its default theme.
    // Future theme switches via oh-my-theme will add the correct --config path.
    changed = true;
    return `${match[1]}${match[3]}`.trimEnd();
  });

  return changed ? cleaned.join(newline) : content;
}

function extractConfigPath(line: string): string | null {
  const configMatch = line.match(
    /--config\s+"((?:\\.|[^"])*)"|--config\s+'((?:\\.|[^'])*)'|--config\s+([^\s]+)/,
  );
  return configMatch?.[1] || configMatch?.[2] || configMatch?.[3] || null;
}

function isPathUnderDirectory(targetPath: string, directory: string): boolean {
  // Normalize paths for comparison.
  const normalizedTarget = targetPath.replace(/\\/g, "/").toLowerCase();
  const normalizedDir = directory.replace(/\\/g, "/").toLowerCase();
  return normalizedTarget.startsWith(normalizedDir.endsWith("/") ? normalizedDir : normalizedDir + "/");
}

function isOhMyPoshAvailable(): boolean {
  try {
    execFileSync("oh-my-posh", ["version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function requireInitialization(): void {
  if (!isInitialized()) {
    throw new Error("oh-my-theme is not initialized. Run: oh-my-theme init");
  }
}

function parsePort(value: string | undefined): number {
  const port = Number(value || DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("Port must be an integer between 1 and 65535.");
  }

  return port;
}

function getAvailablePort(requestedPort: number): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code !== "EADDRINUSE") {
        reject(error);
        return;
      }

      findAvailablePort(requestedPort + 1, resolvePort, reject);
    });
    server.listen({ host: "127.0.0.1", port: requestedPort }, () => {
      server.close(() => resolvePort(requestedPort));
    });
  });
}

function findAvailablePort(
  startPort: number,
  resolvePort: (port: number) => void,
  reject: (error: Error) => void,
): void {
  if (startPort > 65_535) {
    reject(new Error("No available local port found."));
    return;
  }

  getAvailablePort(startPort).then(resolvePort, reject);
}

function waitForServer(url: string, child: ReturnType<typeof spawn>): Promise<void> {
  return new Promise((resolveReady, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("The UI server did not become ready within 30 seconds."));
    }, 30_000);

    const poll = async () => {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
        if (response.ok) {
          cleanup();
          resolveReady();
          return;
        }
      } catch {
        // The server is still starting.
      }

      setTimeout(poll, 250);
    };

    const onExit = (code: number | null) => {
      cleanup();
      reject(new Error(`The UI server exited before it became ready (code ${code ?? "unknown"}).`));
    };

    const cleanup = () => {
      clearTimeout(timeout);
      child.off("exit", onExit);
    };

    child.once("exit", onExit);
    void poll();
  });
}

function openBrowser(url: string): void {
  const command = process.platform === "win32"
    ? "cmd"
    : process.platform === "darwin"
      ? "open"
      : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.unref();
}

const shellChoices: Array<{ title: string; value: Shell }> = [
  { title: "PowerShell 7 (pwsh)", value: "pwsh" },
  { title: "Windows PowerShell", value: "powershell" },
  { title: "zsh", value: "zsh" },
  { title: "bash", value: "bash" },
  { title: "fish", value: "fish" },
];

main().catch((error: unknown) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
