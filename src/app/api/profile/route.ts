import { NextResponse } from "next/server";
import { getProfilePath } from "@/lib/omp";
import { getCurrentThemePath, readProfile } from "@/lib/profile";

export async function GET() {
  try {
    const profilePath = getProfilePath();
    const content = readProfile();
    const activeThemePath = getCurrentThemePath();
    const activeTheme = activeThemePath
      ? activeThemePath.split("\\").pop()?.replace(/\.omp\.(json|yaml)$/, "") || null
      : null;

    return NextResponse.json({
      profilePath,
      content: content || "",
      activeTheme,
      activeThemePath,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read profile" },
      { status: 500 },
    );
  }
}
