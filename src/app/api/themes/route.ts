import { NextResponse } from "next/server";
import { listThemes } from "@/lib/omp";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const themes = listThemes();
    return NextResponse.json({ themes });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list themes" },
      { status: 500 },
    );
  }
}
