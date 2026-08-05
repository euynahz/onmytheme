import { NextResponse } from "next/server";
import { basename } from "path";
import {
  getActiveThemePath,
  getThemeContent,
  getThemePath,
  isManagedTheme,
} from "@/lib/omp";
import { isValidThemeName } from "@/lib/theme-name";
import type { ThemeDetail } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  if (!isValidThemeName(name)) {
    return NextResponse.json({ error: "Theme not found" }, { status: 404 });
  }

  const rawContent = getThemeContent(name);
  if (!rawContent) {
    return NextResponse.json({ error: "Theme not found" }, { status: 404 });
  }

  const path = getThemePath(name);
  const isActive = path === getActiveThemePath();
  let content: Record<string, unknown> = {};
  try {
    content = JSON.parse(rawContent);
  } catch {
    // YAML or unparseable
  }

  const detail: ThemeDetail = {
    name,
    filename: path ? basename(path) : name + ".omp.json",
    path: path || "",
    isActive,
    isInstalled: path ? isManagedTheme(path) : false,
    previewUrl: `/api/themes/${encodeURIComponent(name)}/preview`,
    segmentTypes: [],
    colors: [],
    content,
    rawContent,
  };

  return NextResponse.json(detail);
}
