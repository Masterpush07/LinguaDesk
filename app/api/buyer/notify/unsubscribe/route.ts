import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";

// The "stop these emails" link in every notification email. It works without signing in, because the token is the proof.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const ok = /^[a-f0-9]{48}$/.test(token) && (await db()`DELETE FROM buyer_emails WHERE token = ${token} RETURNING buyer_id`).length > 0;
  const title = ok ? "You are unsubscribed" : "This link is not valid";
  const text = ok ? "You will no longer get emails from LinguaDesk about replies." : "You may already be unsubscribed.";
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="font-family:Arial,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#0f172a"><h1>${title}</h1><p>${text}</p><p><a href="/marketplace">Back to LinguaDesk</a></p></body>`;
  return new NextResponse(html, { status: ok ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
