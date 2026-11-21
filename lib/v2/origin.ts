import type { NextRequest } from "next/server";

// The public address of this site as the visitor sees it, including behind a proxy.
export function requestOrigin(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (host && (proto === "https" || proto === "http") && /^[A-Za-z0-9.:-]+$/.test(host)) return `${proto}://${host}`;
  return req.nextUrl.origin;
}
