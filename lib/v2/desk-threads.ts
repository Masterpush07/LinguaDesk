import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Staff } from "@/lib/v2/session";
import type { DeskOrder, TeamMember, ThreadFilter, ThreadHead, ThreadStatus, ThreadSummary } from "@/lib/v2/desk-types";

// Server-only. Queries shared by the /api/desk routes. Every query takes the seller id from the signed-in staff member.

export const ONLINE_SECONDS = 90; // matches lib/v2/threads.ts

export type Bucket = "unassigned" | "assigned" | "resolved" | "";

export const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

const iso = (v: unknown): string => new Date(v as string | number | Date).toISOString();
const isoOrNull = (v: unknown): string | null => (v ? iso(v) : null);

export const buyerLabel = (id: string, name: string | null) => name?.trim() || `Customer ${id.slice(-6)}`;

type Row = Record<string, unknown>;

export function toSummary(r: Row): ThreadSummary {
  const buyerId = r.buyer_id as string;
  return {
    id: r.id as string,
    buyer: { id: buyerId, label: buyerLabel(buyerId, r.buyer_name as string | null) },
    status: r.status as ThreadStatus,
    priority: r.priority as ThreadSummary["priority"],
    language: (r.language as string | null) ?? null,
    subject: r.subject as string,
    summary: (r.summary as string | null) ?? null,
    assignedStaff: r.assigned_staff_id ? { id: r.assigned_staff_id as string, name: r.staff_name as string } : null,
    lastText: r.last_text as string,
    lastAt: iso(r.last_at),
    handoffAt: isoOrNull(r.handoff_at),
    slaDueAt: r.status === "waiting" || r.status === "assigned" ? (r.first_response_at ? null : isoOrNull(r.sla_due_at)) : null, // no countdown once someone has replied
    productName: (r.product_name as string | null) ?? null,
    unrepliedBuyerMessages: Number(r.unreplied ?? 0),
  };
}

export function toHead(r: Row): ThreadHead {
  return { ...toSummary(r), createdAt: iso(r.created_at), firstResponseAt: isoOrNull(r.first_response_at), resolvedAt: isoOrNull(r.resolved_at) };
}

const escapeLike = (q: string) => q.replace(/[\\%_]/g, (c) => `\\${c}`);

type ListOptions = { filter?: ThreadFilter; q?: string; bucket?: Bucket; limit?: number; threadId?: string };

// One query for the inbox, the dispatch columns and a single thread, so they always agree on status, SLA and ordering.
export async function listThreads(staff: Pick<Staff, "id" | "sellerId">, options: ListOptions = {}): Promise<Row[]> {
  const filter = options.filter ?? "all";
  const q = escapeLike((options.q ?? "").trim().slice(0, 80));
  const bucket = options.bucket ?? "";
  const limit = options.limit ?? 200;
  const threadId = options.threadId ?? "";
  return db()`SELECT * FROM (
      SELECT t.id, t.status, t.priority, t.language, t.subject, t.summary, t.last_text, t.last_at, t.handoff_at, t.sla_due_at,
        t.first_response_at, t.resolved_at, t.created_at, t.assigned_staff_id, t.product_id,
        b.id AS buyer_id, b.name AS buyer_name, st.name AS staff_name, p.name AS product_name,
        (t.status IN ('waiting', 'assigned') AND t.first_response_at IS NULL AND t.sla_due_at < now()) AS breached,
        CASE WHEN t.status IN ('waiting', 'assigned') THEN (
          SELECT count(*) FROM thread_messages m WHERE m.thread_id = t.id AND m.sender = 'buyer'
            AND m.created_at > COALESCE(
              (SELECT max(s.created_at) FROM thread_messages s WHERE s.thread_id = t.id AND s.sender = 'staff'),
              t.handoff_at - interval '2 minutes', now())
        )::int ELSE 0 END AS unreplied
      FROM threads t
      JOIN buyers b ON b.id = t.buyer_id
      LEFT JOIN staff st ON st.id = t.assigned_staff_id
      LEFT JOIN products p ON p.id = t.product_id
      WHERE t.seller_id = ${staff.sellerId} AND (${threadId}::text = '' OR t.id = ${threadId})
    ) x
    WHERE (${q}::text = '' OR x.buyer_name ILIKE '%' || ${q}::text || '%' OR x.subject ILIKE '%' || ${q}::text || '%'
        OR x.last_text ILIKE '%' || ${q}::text || '%' OR right(x.buyer_id, 6) ILIKE '%' || ${q}::text || '%')
      AND (${filter}::text = 'all'
        OR (${filter}::text = 'unassigned' AND x.status = 'waiting' AND x.assigned_staff_id IS NULL)
        OR (${filter}::text = 'mine' AND x.assigned_staff_id = ${staff.id})
        OR (${filter}::text = 'critical' AND x.status <> 'resolved' AND (x.priority = 'critical' OR x.breached)))
      AND (${bucket}::text = ''
        OR (${bucket}::text = 'unassigned' AND x.status = 'waiting' AND x.assigned_staff_id IS NULL)
        OR (${bucket}::text = 'assigned' AND x.status = 'assigned')
        OR (${bucket}::text = 'resolved' AND x.status = 'resolved'))
    ORDER BY CASE WHEN x.status = 'resolved' THEN 4 WHEN x.breached OR x.priority = 'critical' THEN 0
        WHEN x.priority = 'high' THEN 1 WHEN x.status = 'waiting' THEN 2 ELSE 3 END, x.last_at DESC
    LIMIT ${limit}`;
}

// Returns the thread only when it belongs to the staff member's shop, so another shop's id looks like a missing one.
export async function loadHead(staff: Pick<Staff, "id" | "sellerId">, threadId: string): Promise<ThreadHead | null> {
  const [row] = await listThreads(staff, { threadId, limit: 1 });
  return row ? toHead(row) : null;
}

export async function loadTeam(sellerId: string): Promise<(TeamMember & { skills: string[] })[]> {
  const rows = await db()`SELECT st.id, st.name, st.role, st.languages, st.skills, st.max_concurrent, st.available,
      (st.last_seen IS NOT NULL AND st.last_seen > now() - make_interval(secs => ${ONLINE_SECONDS})) AS online,
      (SELECT count(*) FROM threads t WHERE t.assigned_staff_id = st.id AND t.status = 'assigned')::int AS load
    FROM staff st WHERE st.seller_id = ${sellerId} ORDER BY (st.role = 'owner') DESC, st.name`;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    role: r.role,
    languages: r.languages,
    skills: r.skills,
    online: r.online,
    available: r.available,
    load: r.load,
    maxConcurrent: r.max_concurrent,
  }));
}

export async function loadBuyerOrders(sellerId: string, buyerId: string): Promise<DeskOrder[]> {
  const rows = await db()`SELECT id, status, total, created_at FROM orders_v2 WHERE seller_id = ${sellerId} AND buyer_id = ${buyerId} ORDER BY created_at DESC LIMIT 20`;
  return rows.map((r) => ({ id: r.id, status: r.status, total: r.total, createdAt: iso(r.created_at) }));
}

// Owners work any conversation of the shop; agents work unassigned ones and their own.
export function canWork(staff: Staff, thread: Pick<ThreadHead, "assignedStaff">): boolean {
  return staff.role === "owner" || !thread.assignedStaff || thread.assignedStaff.id === staff.id;
}

export const NOT_YOURS = "This conversation is assigned to another agent. Ask them or the owner to transfer it to you.";

// Parses a JSON object body; returns null when it is missing or malformed.
export async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  const body = (await req.json().catch(() => null)) as unknown;
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}

export const iso8601 = iso;
