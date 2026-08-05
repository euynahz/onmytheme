import { NextResponse } from "next/server";
import { fetchGitHubThemes } from "@/lib/github";

export const dynamic = "force-dynamic";

let cachedThemes: Array<{
  name: string;
  downloadUrl: string;
  htmlUrl: string;
  size: number;
}> | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  try {
    if (cachedThemes && Date.now() - cacheTime < CACHE_TTL) {
      return NextResponse.json({ themes: cachedThemes });
    }

    const themes = await fetchGitHubThemes();
    cachedThemes = themes;
    cacheTime = Date.now();

    return NextResponse.json({ themes });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch GitHub themes" },
      { status: 500 },
    );
  }
}
