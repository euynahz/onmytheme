import { NextResponse } from "next/server";
import { getThemePath, generatePreviewImage, generatePreviewText } from "@/lib/omp";
import { isValidThemeName } from "@/lib/theme-name";
import { existsSync, readFileSync, mkdirSync, statSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const PREVIEWS_DIR = join(tmpdir(), "oh-my-theme", "previews");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  if (!isValidThemeName(name)) {
    return NextResponse.json({ error: "Theme not found" }, { status: 404 });
  }

  const themePath = getThemePath(name);

  if (!themePath) {
    return NextResponse.json({ error: "Theme not found" }, { status: 404 });
  }

  // Ensure previews directory exists
  if (!existsSync(PREVIEWS_DIR)) {
    mkdirSync(PREVIEWS_DIR, { recursive: true });
  }

  // Check disk cache — serve cached PNG if it's newer than the theme file
  const cachedPng = join(PREVIEWS_DIR, `${name}.png`);
  if (existsSync(cachedPng)) {
    const cacheStat = statSync(cachedPng);
    const themeStat = statSync(themePath);
    if (cacheStat.mtimeMs > themeStat.mtimeMs) {
      const buffer = readFileSync(cachedPng);
      return new Response(buffer, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=86400, immutable",
          "X-Cache": "HIT",
        },
      });
    }
  }

  // Try image generation
  const imageBuffer = generatePreviewImage(themePath, cachedPng);
  if (imageBuffer) {
    return new Response(new Uint8Array(imageBuffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, immutable",
        "X-Cache": "MISS",
      },
    });
  }

  // Fallback: generate text preview as SVG
  const textPreview = generatePreviewText(themePath);
  if (textPreview) {
    const svg = generateSvgFromText(textPreview);
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  }

  // Final fallback: placeholder SVG
  const placeholder = generatePlaceholderSvg(name);
  return new Response(placeholder, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

function generateSvgFromText(text: string): string {
  // Strip ANSI codes for display
  const cleanText = text
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/\x1b\].*?\x07/g, "")
    .trim();

  const displayText = cleanText || "Preview unavailable";
  const escaped = displayText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="60" viewBox="0 0 600 60">
  <rect width="600" height="60" rx="8" fill="#1e1e2e"/>
  <text x="16" y="38" font-family="Cascadia Code, Fira Code, monospace" font-size="16" fill="#cdd6f4">${escaped}</text>
</svg>`;
}

function generatePlaceholderSvg(name: string): string {
  const escaped = name
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="60" viewBox="0 0 600 60">
  <rect width="600" height="60" rx="8" fill="#1e1e2e"/>
  <text x="300" y="35" text-anchor="middle" font-family="system-ui, sans-serif" font-size="14" fill="#6c7086">${escaped}</text>
</svg>`;
}
