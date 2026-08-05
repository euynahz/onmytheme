export interface ThemeInfo {
  name: string;
  filename: string;
  path: string;
  isActive: boolean;
  isInstalled: boolean;
  previewUrl: string;
  segmentTypes: string[];
  colors: string[];
}

export interface ThemeDetail extends ThemeInfo {
  content: Record<string, unknown>;
  rawContent: string;
}

export interface ProfileInfo {
  profilePath: string;
  content: string;
  activeTheme: string | null;
  activeThemePath: string | null;
}

export interface GitHubTheme {
  name: string;
  downloadUrl: string;
  htmlUrl: string;
  size: number;
}

export interface DownloadThemeRequest {
  themeName: string;
}
