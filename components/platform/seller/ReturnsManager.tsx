"use client";

import { useState } from "react";
import { CheckCircle2, ImageIcon, Undo2, XCircle } from "lucide-react";
import { BTN_GHOST, BTN_PRIMARY, Card, Dialog, ErrorBlock, FOCUS, INPUT, Label, LoadingBlock, Notice } from "@/components/platform/seller/ui";
import { EmptyState } from "@/components/platform/ui";
import { api } from "@/lib/v2/client";
import { errorMessage, useApi } from "@/lib/v2/seller-hooks";
import { formatDateTime, formatUsd } from "@/lib/v2/seller-types";
import {
  RETURN_NOTE_MAX,
  RETURN_STATUSES,
  RETURN_STATUS_LABEL,
  RETURN_TRANSITIONS,
  type ReturnAction,
  type ReturnDto,
  type ReturnStatus,
  type ReturnsResponse,
} from "@/lib/v2/returns-types";

const STATUS_STYLE: Record<ReturnStatus, string> = {
  requested: "bg-amber-50 text-amber-700 ring-amber-200",
  approved: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  rejected: "bg-red-50 text-red-700 ring-red-200",
  refunded: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  closed: "bg-slate-100 text-slate-600 ring-slate-200",
};

const ACTION_LABEL: Record<ReturnAction, string> = {
  approved: "Approve return",
  rejected: "Reject return",
  refunded: "Mark as refunded",
  closed: "Close request",
};

const ACTION_DONE: Record<ReturnAction, string> = {
  approved: "approved",
  rejected: "rejected",
  refunded: "marked as refunded",
  closed: "closed",
};

function countStatuses(list: ReturnDto[]): Record<ReturnStatus, number> {
  return Object.fromEntries(RETURN_STATUSES.map((s) => [s, list.filter((r) => r.status === s).length])) as Record<ReturnStatus, number>;
}

export default function ReturnsManager() {
  const { data, error, loading, reload, update } = useApi<ReturnsResponse>("/api/desk/returns");
  const [filter, setFilter] = useState<ReturnStatus | "all">("all");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);

  const list = data?.returns ?? [];
  const rows = list.filter((r) => filter === "all" || r.status === filter);

  const act = async (r: ReturnDto, to: ReturnAction) => {
    setBusyId(r.id);
    setActionError(null);
    setNotice("");
    try {
      const saved = await api<ReturnDto>(`/api/desk/returns/${r.id}`, { method: "PATCH", json: { status: to, sellerNote: (notes[r.id] ?? r.sellerNote).trim() } });
      update((prev) => {
        const next = prev.returns.map((x) => (x.id === r.id ? saved : x));
        return { returns: next, counts: countStatuses(next) };
      });
      setNotice(`The return request for order ${r.orderId} was ${ACTION_DONE[to]}. The customer was notified in the conversation.`);
    } catch (err) {
      setActionError({ id: r.id, message: errorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div role="group" aria-label="Filter return requests by status" className="mb-4 flex flex-wrap gap-2" data-testid="return-filter">
        {(["all", ...RETURN_STATUSES] as const).map((s) => {
          const active = filter === s;
          const count = s === "all" ? list.length : (data?.counts[s] ?? 0);
          return (
            <button
              key={s}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(s)}
              data-testid={`return-filter-${s}`}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 ${active ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50"} ${FOCUS}`}
            >
              {s === "all" ? "All requests" : RETURN_STATUS_LABEL[s]}
              {data && <span className={`ml-1.5 text-xs ${active ? "text-indigo-100" : "text-slate-400"}`}>{count}</span>}
            </button>
          );
        })}
      </div>
      <Notice message={notice} testId="returns-confirmation" />

      {loading && <LoadingBlock label="Loading return requests" testId="returns-loading" />}
      {error && !data && <ErrorBlock message={error} onRetry={reload} testId="returns-error" />}
      {data && list.length === 0 && (
        <EmptyState title="No return requests yet" text="When a customer asks to return a delivered order, the request appears here for you to approve or reject." href="/seller/orders" cta="Go to orders" />
      )}
      {data && list.length > 0 && rows.length === 0 && (
        <p data-testid="returns-filter-empty" className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No return requests match this filter.
        </p>
      )}

      {rows.length > 0 && (
        <ul className="space-y-3" data-testid="return-list">
          {rows.map((r) => {
            const actions = RETURN_TRANSITIONS[r.status];
            const busy = busyId === r.id;
            const note = notes[r.id] ?? r.sellerNote;
            return (
              <li key={r.id} data-testid={`return-${r.id}`}>
                <Card className="!p-4">
                  <div className="flex flex-wrap items-start gap-4">
                    {r.photoUrl && (
                      <button
                        type="button"
                        onClick={() => setPhoto(r.photoUrl)}
                        data-testid={`return-photo-${r.id}`}
                        aria-label={`View the photo for the return of order ${r.orderId}`}
                        className={`h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 ${FOCUS}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={r.photoUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                      </button>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                        <span>
                          Order <span className="font-mono">{r.orderId}</span>
                        </span>
                        <span data-testid={`return-status-${r.id}`} className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${STATUS_STYLE[r.status]}`}>
                          {RETURN_STATUS_LABEL[r.status]}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500" data-testid={`return-meta-${r.id}`}>
                        {r.buyerLabel} · requested {formatDateTime(r.createdAt)}
                        {r.updatedAt && r.updatedAt !== r.createdAt ? ` · updated ${formatDateTime(r.updatedAt)}` : ""}
                        {r.orderTotal !== null ? ` · order total ${formatUsd(r.orderTotal)}` : ""}
                      </p>
                      <p className="mt-2 text-sm font-medium text-slate-800" data-testid={`return-reason-${r.id}`}>{r.reasonLabel}</p>
                      {r.details && <p className="mt-1 whitespace-pre-line text-sm text-slate-600" data-testid={`return-details-${r.id}`}>{r.details}</p>}
                      {!r.photoUrl && (
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-400">
                          <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" /> No photo attached
                        </p>
                      )}
                      {r.sellerNote && actions.length === 0 && (
                        <p className="mt-2 text-sm text-slate-600" data-testid={`return-note-saved-${r.id}`}>
                          <span className="font-medium text-slate-800">Your note:</span> {r.sellerNote}
                        </p>
                      )}
                    </div>
                  </div>

                  {actions.length > 0 && (
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <Label htmlFor={`return-note-${r.id}`} hint="The customer sees this note in the conversation and in the notification.">
                        Note to the customer (optional)
                      </Label>
                      <input
                        id={`return-note-${r.id}`}
                        value={note}
                        maxLength={RETURN_NOTE_MAX}
                        onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                        data-testid={`return-note-${r.id}`}
                        className={INPUT}
                        placeholder="For example: please send the item back within 7 days"
                      />
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {actions.map((to) => (
                          <button
                            key={to}
                            type="button"
                            disabled={busy}
                            onClick={() => act(r, to)}
                            data-testid={`return-action-${to}-${r.id}`}
                            className={to === "approved" || to === "refunded" ? `${BTN_PRIMARY} !px-3 !py-1.5` : `${BTN_GHOST} !px-3 !py-1.5`}
                          >
                            {to === "approved" || to === "refunded" ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : to === "rejected" ? <XCircle className="h-4 w-4" aria-hidden="true" /> : <Undo2 className="h-4 w-4" aria-hidden="true" />}
                            {ACTION_LABEL[to]}
                          </button>
                        ))}
                      </div>
                      {r.status === "approved" && (
                        <p className="mt-2 text-xs text-slate-500">Marking a request as refunded only records that you refunded the customer yourself. No money moves through LinguaDesk.</p>
                      )}
                      <p role="alert" data-testid={`return-error-${r.id}`} className="mt-2 min-h-4 text-xs font-medium text-red-600">
                        {actionError?.id === r.id ? actionError.message : ""}
                      </p>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {photo && (
        <Dialog title="Return photo" description="Photo supplied by the customer." onClose={() => setPhoto(null)} testId="return-photo-dialog">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="Photo supplied by the customer for the return request" data-testid="return-photo-large" className="max-h-[70dvh] w-full rounded-xl object-contain" />
        </Dialog>
      )}
    </div>
  );
}
