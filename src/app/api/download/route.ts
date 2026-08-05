import { NextResponse } from "next/server";
import { downloadTheme } from "@/lib/github";
import { getThemesDir } from "@/lib/config";
import { normalizeThemeName } from "@/lib/theme-name";
import { requireLocalUiRequest } from "@/lib/request-security";

export async function POST(request: Request) {
  const requestError = requireLocalUiRequest(request);
  if (requestError) return requestError;

  try {
    const body = (await request.json()) as { themeName: string };
    const themeName = normalizeThemeName(body.themeName || "");

    if (!themeName) {
      return NextResponse.json(
        { error: "themeName is required" },
        { status: 400 },
      );
    }

    const result = await downloadTheme(themeName, getThemesDir());

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Theme "${themeName}" downloaded successfully`,
        path: result.path,
      });
    }

    return NextResponse.json(
      { error: result.error },
      { status: 500 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to download theme" },
      { status: 500 },
    );
  }
}
