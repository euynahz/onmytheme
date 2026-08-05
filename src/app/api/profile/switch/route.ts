import { NextResponse } from "next/server";
import { switchTheme } from "@/lib/profile";
import { getThemePath, isManagedTheme } from "@/lib/omp";
import { normalizeThemeName } from "@/lib/theme-name";
import { requireLocalUiRequest } from "@/lib/request-security";

export async function POST(request: Request) {
  const requestError = requireLocalUiRequest(request);
  if (requestError) return requestError;

  try {
    const body = (await request.json()) as { themeName?: string };
    const themeName = body.themeName ? normalizeThemeName(body.themeName) : null;
    const resolvedPath = themeName ? getThemePath(themeName) : null;

    if (!resolvedPath) {
      return NextResponse.json(
        { error: "Theme not found. Provide a valid theme name." },
        { status: 400 },
      );
    }

    if (!isManagedTheme(resolvedPath)) {
      return NextResponse.json(
        { error: "Install this theme before applying it." },
        { status: 400 },
      );
    }

    const result = switchTheme(resolvedPath);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Theme switched to ${themeName || resolvedPath}`,
        backupPath: result.backupPath,
      });
    }

    return NextResponse.json(
      { error: result.error },
      { status: 500 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to switch theme" },
      { status: 500 },
    );
  }
}
