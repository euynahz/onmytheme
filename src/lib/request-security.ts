import { NextResponse } from "next/server";

const UI_REQUEST_HEADER = "x-oh-my-theme-request";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

export function requireLocalUiRequest(request: Request): NextResponse | null {
  if (request.headers.get(UI_REQUEST_HEADER) !== "1") {
    return NextResponse.json({ error: "Invalid UI request" }, { status: 403 });
  }

  const origin = request.headers.get("origin");
  if (!origin) return null;

  const host = request.headers.get("host");
  if (!host) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  try {
    const originUrl = new URL(origin);
    if (
      originUrl.protocol !== "http:" ||
      !LOOPBACK_HOSTS.has(originUrl.hostname) ||
      originUrl.host !== host
    ) {
      return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  return null;
}
