import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";

// The link in the confirmation email. Only an address whose owner clicked this ever receives notifications.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const ok = /^[a-f0-9]{48}$/.test(token) && (await db()`UPDATE buyer_emails SET verified_at = now() WHERE token = ${token} RETURNING buyer_id`).length > 0;
  const title = ok ? "Email confirmed" : "This link is not valid";
  const text = ok ? "You will get an email when a shop replies to you while you are away. You can close this tab." : "It may have expired or already been replaced. Ask for a new confirmation email from the chat.";
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="font-family:Arial,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#0f172a"><h1>${title}</h1><p>${text}</p><p><a href="/marketplace">Back to LinguaDesk</a></p></body>`;
  return new NextResponse(html, { status: ok ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
