import type { GitHubTheme } from "./types";

const GITHUB_THEMES_URL =
  "https://api.github.com/repos/JanDeDobbeleer/oh-my-posh/contents/themes";

export async function fetchGitHubThemes(): Promise<GitHubTheme[]> {
  const res = await fetch(GITHUB_THEMES_URL, {
    headers: { Accept: "application/vnd.github.v3+json" },
  });

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status}`);
  }

  const data = (await res.json()) as Array<{
    name: string;
    download_url: string;
    html_url: string;
    size: number;
    type: string;
  }>;

  return data
    .filter(
      (item) =>
        item.type === "file" &&
        (item.name.endsWith(".omp.json") || item.name.endsWith(".omp.yaml")),
    )
    .map((item) => ({
      name: item.name.replace(/\.omp\.(json|yaml)$/, ""),
      downloadUrl: item.download_url,
      htmlUrl: item.html_url,
      size: item.size,
    }));
}

export async function downloadTheme(
  themeName: string,
  destDir: string,
): Promise<{ success: boolean; path?: string; error?: string }> {
  const { existsSync, writeFileSync, mkdirSync } = await import("fs");
  const { join } = await import("path");

  // Try JSON first, then YAML
  for (const ext of [".omp.json", ".omp.yaml"]) {
    const filename = themeName + ext;
    const url = `https://raw.githubusercontent.com/JanDeDobbeleer/oh-my-posh/main/themes/${filename}`;

    try {
      const res = await fetch(url);
      if (!res.ok) continue;

      const content = await res.text();

      // Validate JSON if applicable
      if (ext === ".omp.json") {
        try {
          JSON.parse(content);
        } catch {
          return { success: false, error: "Invalid JSON content" };
        }
      }

      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true });
      }

      const destPath = join(destDir, filename);
      writeFileSync(destPath, content, "utf-8");
      return { success: true, path: destPath };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return { success: false, error: `Theme "${themeName}" not found on GitHub` };
}
