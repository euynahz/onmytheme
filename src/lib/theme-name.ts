const THEME_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function isValidThemeName(name: string): boolean {
  return THEME_NAME_PATTERN.test(name) && !name.includes("..");
}

export function normalizeThemeName(value: string): string | null {
  const name = value.replace(/\.omp\.(json|yaml)$/i, "").trim();
  return isValidThemeName(name) ? name : null;
}
