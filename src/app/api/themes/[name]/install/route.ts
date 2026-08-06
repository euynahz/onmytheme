import { NextResponse } from "next/server";
import { ensureOsc99, getThemePath, installTheme, isManagedTheme } from "@/lib/omp";
import { isValidThemeName } from "@/lib/theme-name";
import { requireLocalUiRequest } from "@/lib/request-security";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const requestError = requireLocalUiRequest(request);
  if (requestError) return requestError;

  try {
    const { name } = await params;
    if (!isValidThemeName(name)) {
      return NextResponse.json({ error: "Theme not found" }, { status: 404 });
    }

    const themePath = getThemePath(name);

    if (!themePath) {
      return NextResponse.json({ error: "Theme not found" }, { status: 404 });
    }

    const installedPath = isManagedTheme(themePath) ? themePath : installTheme(themePath);

    let body: { osc99?: boolean } | null = null;
    try {
      body = (await request.json()) as { osc99?: boolean } | null;
    } catch {
      // no body is fine
    }

    if (body?.osc99) {
      ensureOsc99(installedPath);
    }

    return NextResponse.json({ success: true, path: installedPath });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to install theme" },
      { status: 500 },
    );
  }
}
