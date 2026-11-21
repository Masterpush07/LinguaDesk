import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/v2/guard";
import type { NotificationDto, NotificationKind, NotificationsDto } from "@/lib/v2/notification-types";
import { fail, invalidBody, iso, readJson } from "@/lib/v2/seller-api";

const LIST_LIMIT = 30;
const MAX_IDS = 100;

// The shop's alerts, newest first, with how many are still unread. Shared by everyone on the shop's team.
export async function GET() {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const sql = db();
  const [rows, [count]] = await Promise.all([
    sql`SELECT id, kind, title, body, thread_id, created_at, read_at FROM notifications
      WHERE seller_id = ${auth.staff.sellerId} ORDER BY created_at DESC LIMIT ${LIST_LIMIT}`,
    sql`SELECT count(*)::int AS n FROM notifications WHERE seller_id = ${auth.staff.sellerId} AND read_at IS NULL`,
  ]);
  const body: NotificationsDto = {
    unread: count.n,
    items: rows.map(
      (r): NotificationDto => ({
        id: r.id,
        kind: r.kind as NotificationKind,
        title: r.title,
        body: r.body,
        threadId: r.thread_id ?? null,
        createdAt: iso(r.created_at) as string,
        read: !!r.read_at,
      }),
    ),
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}

// Marks alerts as read: { all: true } for every unread one, or { ids: [...] } for specific ones.
export async function POST(req: NextRequest) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const body = await readJson(req);
  if (!body) return invalidBody();

  const sql = db();
  if (body.all === true) {
    await sql`UPDATE notifications SET read_at = now() WHERE seller_id = ${auth.staff.sellerId} AND read_at IS NULL`;
    return NextResponse.json({ ok: true });
  }
  if (!Array.isArray(body.ids) || body.ids.length === 0 || body.ids.length > MAX_IDS || !body.ids.every((id) => typeof id === "string")) {
    return fail("Send { all: true } or a list of notification ids.");
  }
  await sql`UPDATE notifications SET read_at = now() WHERE seller_id = ${auth.staff.sellerId} AND read_at IS NULL AND id = ANY(${body.ids as string[]})`;
  return NextResponse.json({ ok: true });
}
