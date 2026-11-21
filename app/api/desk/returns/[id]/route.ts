import { NextResponse, after, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { addSystemMessage } from "@/lib/v2/buyer-api";
import { requireStaff } from "@/lib/v2/guard";
import { alertBuyer } from "@/lib/v2/buyer-alert";
import { RETURN_ACTIONS, RETURN_NOTE_MAX, RETURN_TRANSITIONS, type ReturnStatus } from "@/lib/v2/returns-types";
import { Check, fail, invalidBody, readJson } from "@/lib/v2/seller-api";
import { returnDto } from "@/lib/v2/seller-returns";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = await readJson(req);
  if (!body) return invalidBody();

  const check = new Check();
  const to = check.oneOf(body.status, "Status", RETURN_ACTIONS);
  const note = "sellerNote" in body ? check.text(body.sellerNote, "Note", RETURN_NOTE_MAX) : "";
  if (!check.ok) return check.response;

  const sql = db();
  const [current] = await sql`SELECT status, seller_note FROM return_requests WHERE id = ${id} AND seller_id = ${auth.staff.sellerId}`;
  if (!current) return fail("Return request not found.", 404);
  const from = current.status as ReturnStatus;
  const savedNote = "sellerNote" in body ? note : ((current.seller_note as string | null) ?? "");
  if (!RETURN_TRANSITIONS[from].includes(to)) {
    const allowed = RETURN_TRANSITIONS[from];
    return fail(
      allowed.length === 0
        ? `This return request is ${from} and cannot be changed.`
        : `This return request is ${from}, so it cannot be marked as ${to}. It can be marked as: ${allowed.join(", ")}.`,
      409,
    );
  }

  // The status in WHERE makes concurrent updates safe: only one of two simultaneous requests can move the request.
  const [updated] = await sql`UPDATE return_requests SET status = ${to}, seller_note = ${savedNote}, updated_at = now()
    WHERE id = ${id} AND seller_id = ${auth.staff.sellerId} AND status = ${from}
    RETURNING id`;
  if (!updated) return fail("This return request was changed by someone else. Reload and try again.", 409);

  const [row] = await sql`SELECT r.id, r.order_id, r.buyer_id, r.reason, r.details, r.photo_asset_id, r.status, r.seller_note, r.created_at, r.updated_at, o.total, o.thread_id
    FROM return_requests r JOIN orders_v2 o ON o.id = r.order_id WHERE r.id = ${id}`;

  const orderId = row.order_id as string;
  const text = `Your return request for order ${orderId} was ${to}.${savedNote ? ` ${savedNote}` : ""}`;
  if (row.thread_id) await addSystemMessage(row.thread_id as string, text).catch((err: unknown) => console.error("Return message failed:", err instanceof Error ? err.message : err));
  const alert = () =>
    alertBuyer({
      buyerId: row.buyer_id as string,
      kind: "return",
      ref: orderId,
      shopName: auth.staff.sellerName,
      path: `/orders/${orderId}`,
      push: { title: "Return request update", body: text, url: `/orders/${orderId}`, tag: `return-${id}` },
    });
  try {
    after(alert);
  } catch {
    void alert();
  }

  return NextResponse.json(returnDto(row));
}
