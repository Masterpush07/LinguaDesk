"use client";

import { useRef, useState } from "react";
import { AlertCircle, CheckCircle2, ImagePlus, RotateCcw, Star, X } from "lucide-react";
import { api } from "@/lib/v2/client";
import { uploadImage, type UploadedImage } from "@/lib/v2/image-upload";
import { RETURN_REASONS, RETURN_WINDOW_DAYS, type BuyerOrder, type BuyerReview, type BuyerReturn, type ReturnReason, type ReturnStatus } from "@/lib/v2/buyer-types";
import { shortDate } from "./orderStatus";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2";
const FIELD = `w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 ${FOCUS}`;
const PRIMARY = `inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 motion-reduce:transition-none disabled:cursor-not-allowed disabled:bg-slate-300 ${FOCUS}`;
const SECONDARY = `inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS}`;

const message = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

export const RETURN_REASON_LABEL: Record<ReturnReason, string> = {
  damaged: "The item arrived damaged",
  wrong_item: "I received the wrong item",
  not_as_described: "The item is not as described",
  changed_mind: "I changed my mind",
  other: "Another reason",
};

const RETURN_STATUS: Record<ReturnStatus, { label: string; cls: string; detail: string }> = {
  requested: { label: "Requested", cls: "bg-amber-50 text-amber-800 ring-amber-200", detail: "The shop has your request and will respond in your conversation." },
  approved: { label: "Approved", cls: "bg-emerald-50 text-emerald-800 ring-emerald-200", detail: "The shop approved your return. Follow its instructions in your conversation." },
  rejected: { label: "Rejected", cls: "bg-red-50 text-red-800 ring-red-200", detail: "The shop did not approve this return. You can ask about it in your conversation." },
  refunded: {
    label: "Refunded",
    cls: "bg-indigo-50 text-indigo-800 ring-indigo-200",
    detail: "The shop recorded that it refunded you outside LinguaDesk. LinguaDesk does not process payments or refunds, so check the refund with the shop.",
  },
  closed: { label: "Closed", cls: "bg-slate-100 text-slate-700 ring-slate-200", detail: "The shop closed this return request." },
};

export function CancelOrder({ order, onDone }: { order: BuyerOrder; onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (order.status !== "proposed" && order.status !== "confirmed") return null;

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      await api<{ ok: boolean }>(`/api/buyer/orders/${encodeURIComponent(order.id)}/cancel`, { method: "POST", json: { reason: reason.trim() || undefined } });
      await onDone();
    } catch (err) {
      setError(message(err, "The order could not be cancelled. Please try again."));
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} data-testid="order-cancel-btn" className={`${SECONDARY} w-full border-red-200 text-red-700 hover:bg-red-50`}>
        Cancel order
      </button>
    );
  }

  return (
    <div data-testid="order-cancel-confirm" className="space-y-3 rounded-xl border border-red-200 bg-red-50/60 p-4">
      <p className="text-sm font-semibold text-slate-900">Cancel this order?</p>
      <p className="text-sm text-slate-600">The shop is told straight away. You can cancel only until the shop packs the order.</p>
      <div>
        <label htmlFor="order-cancel-reason" className="text-sm font-medium text-slate-900">
          Reason <span className="font-normal text-slate-500">(optional)</span>
        </label>
        <input id="order-cancel-reason" data-testid="order-cancel-reason" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} disabled={busy} className={`mt-1 ${FIELD}`} />
      </div>
      {error && (
        <p role="alert" data-testid="order-cancel-error" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void cancel()} disabled={busy} data-testid="order-cancel-confirm-btn" className={`${PRIMARY} bg-red-600 hover:bg-red-700`}>
          {busy ? "Cancelling..." : "Yes, cancel order"}
        </button>
        <button type="button" onClick={() => setOpen(false)} disabled={busy} data-testid="order-cancel-keep-btn" className={SECONDARY}>
          Keep order
        </button>
      </div>
    </div>
  );
}

function ReturnStatusCard({ request }: { request: BuyerReturn }) {
  const s = RETURN_STATUS[request.status];
  return (
    <div data-testid="order-return-status" data-status={request.status} className="space-y-2 rounded-xl bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">Return request</p>
        <span data-testid={`order-return-status-${request.status}`} className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${s.cls}`}>
          {s.label}
        </span>
      </div>
      <p className="text-sm text-slate-600" data-testid="order-return-status-detail">
        {s.detail}
      </p>
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Requested</dt>
          <dd className="text-slate-900">{shortDate(request.createdAt)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Reason</dt>
          <dd className="text-right text-slate-900" data-testid="order-return-reason">
            {RETURN_REASON_LABEL[request.reason]}
          </dd>
        </div>
      </dl>
      {request.details && (
        <p className="text-sm text-slate-700" data-testid="order-return-details">
          {request.details}
        </p>
      )}
      {request.photoUrl && (
        <a href={request.photoUrl} target="_blank" rel="noopener noreferrer" data-testid="order-return-photo-link" className={`inline-block rounded text-sm font-medium text-indigo-700 hover:underline ${FOCUS}`}>
          View the photo you sent
        </a>
      )}
      {request.sellerNote && (
        <div data-testid="order-return-seller-note" className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Note from the shop</p>
          <p className="mt-1">{request.sellerNote}</p>
        </div>
      )}
    </div>
  );
}

export function ReturnSection({ order, onDone }: { order: BuyerOrder; onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReturnReason | "">("");
  const [details, setDetails] = useState("");
  const [photo, setPhoto] = useState<UploadedImage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (order.status !== "delivered" || (!order.returnRequest && !order.returnEligible)) return null;

  async function pick(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      setPhoto(await uploadImage(file, "return"));
    } catch (err) {
      setError(message(err, "The photo could not be uploaded."));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submit() {
    if (!reason) {
      setError("Choose a reason for the return.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api<{ ok: boolean }>(`/api/buyer/orders/${encodeURIComponent(order.id)}/return`, {
        method: "POST",
        json: { reason, details: details.trim(), photoAssetId: photo?.id },
      });
      await onDone();
      setOpen(false);
      setReason("");
      setDetails("");
      setPhoto(null);
    } catch (err) {
      setError(message(err, "The return could not be requested. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="return-heading" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5" data-testid="order-return-card">
      <h2 id="return-heading" className="flex items-center gap-2 font-heading text-base font-semibold text-slate-900">
        <RotateCcw className="h-4 w-4 text-cyan-600" aria-hidden="true" /> Returns
      </h2>
      {order.returnRequest && <ReturnStatusCard request={order.returnRequest} />}
      {order.returnEligible && !open && (
        <>
          {!order.returnRequest && <p className="text-sm text-slate-600">You can ask the shop for a return within {RETURN_WINDOW_DAYS} days of delivery.</p>}
          <button type="button" onClick={() => setOpen(true)} data-testid="order-return-open-btn" className={`${SECONDARY} w-full`}>
            {order.returnRequest ? "Request another return" : "Request a return"}
          </button>
        </>
      )}
      {order.returnEligible && open && (
        <form
          data-testid="order-return-form"
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div>
            <label htmlFor="order-return-reason" className="text-sm font-medium text-slate-900">
              Reason
            </label>
            <select
              id="order-return-reason"
              data-testid="order-return-reason-select"
              value={reason}
              onChange={(e) => setReason(e.target.value as ReturnReason | "")}
              disabled={busy}
              className={`mt-1 ${FIELD}`}
            >
              <option value="">Choose a reason</option>
              {RETURN_REASONS.map((r) => (
                <option key={r} value={r}>
                  {RETURN_REASON_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="order-return-details-input" className="text-sm font-medium text-slate-900">
              Details <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <textarea
              id="order-return-details-input"
              data-testid="order-return-details-input"
              rows={3}
              maxLength={500}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              disabled={busy}
              placeholder="Tell the shop what happened"
              className={`mt-1 ${FIELD}`}
            />
            <p className="mt-1 text-xs text-slate-500">{details.length} of 500 characters</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              Photo <span className="font-normal text-slate-500">(optional)</span>
            </p>
            {photo ? (
              <div className="mt-2 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt="Photo of the item for the return" data-testid="order-return-photo-preview" className="h-20 w-20 rounded-lg border border-slate-200 object-cover" />
                <button type="button" onClick={() => setPhoto(null)} disabled={busy} data-testid="order-return-photo-remove" className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 ${FOCUS}`}>
                  <X className="h-4 w-4" aria-hidden="true" /> Remove photo
                </button>
              </div>
            ) : (
              <>
                <input ref={fileRef} id="order-return-photo-input" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" data-testid="order-return-photo-input" onChange={(e) => void pick(e.target.files?.[0])} />
                <label
                  htmlFor="order-return-photo-input"
                  data-testid="order-return-photo-btn"
                  className={`mt-2 inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-indigo-500 ${uploading ? "pointer-events-none opacity-60" : ""}`}
                >
                  <ImagePlus className="h-4 w-4" aria-hidden="true" /> {uploading ? "Uploading..." : "Add a photo"}
                </label>
              </>
            )}
          </div>
          {error && (
            <p role="alert" data-testid="order-return-error" className="flex items-start gap-1.5 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy || uploading} data-testid="order-return-submit" className={PRIMARY}>
              {busy ? "Sending..." : "Send return request"}
            </button>
            <button type="button" onClick={() => setOpen(false)} disabled={busy} data-testid="order-return-cancel" className={SECONDARY}>
              Close
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function Stars({ value, size = "h-5 w-5" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`${size} ${n <= value ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
      ))}
    </span>
  );
}

function SubmittedReview({ review }: { review: BuyerReview }) {
  return (
    <div data-testid="order-review-submitted" className="space-y-2 rounded-xl bg-slate-50 p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700" role="status" data-testid="order-review-thanks">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Thank you for your review
      </p>
      <div className="flex items-center gap-2">
        <Stars value={review.rating} />
        <span className="text-sm text-slate-700" data-testid="order-review-rating">
          {review.rating} out of 5 stars
        </span>
      </div>
      {review.body && (
        <p className="text-sm text-slate-700" data-testid="order-review-body">
          {review.body}
        </p>
      )}
      <p className="text-xs text-slate-500">Submitted {shortDate(review.createdAt)}</p>
    </div>
  );
}

export function ReviewSection({ order, onDone }: { order: BuyerOrder; onDone: () => Promise<void> }) {
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (order.status !== "delivered") return null;

  async function submit() {
    if (rating < 1) {
      setError("Choose a rating from 1 to 5 stars.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api<{ ok: boolean }>(`/api/buyer/orders/${encodeURIComponent(order.id)}/review`, { method: "POST", json: { rating, body: body.trim() } });
      await onDone();
    } catch (err) {
      setError(message(err, "Your review could not be sent. Please try again."));
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="review-heading" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5" data-testid="order-review-card">
      <h2 id="review-heading" className="font-heading text-base font-semibold text-slate-900">
        {order.review ? "Your review" : "Review this order"}
      </h2>
      {order.review ? (
        <SubmittedReview review={order.review} />
      ) : (
        <form
          data-testid="order-review-form"
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div>
            <p id="order-review-rating-label" className="text-sm font-medium text-slate-900">
              Your rating
            </p>
            <div role="group" aria-labelledby="order-review-rating-label" className="mt-1 flex gap-1" data-testid="order-review-stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  disabled={busy}
                  aria-pressed={rating === n}
                  aria-label={`${n} ${n === 1 ? "star" : "stars"} out of 5`}
                  data-testid={`order-review-star-${n}`}
                  className={`rounded-md p-1 ${FOCUS}`}
                >
                  <Star className={`h-7 w-7 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="order-review-text" className="text-sm font-medium text-slate-900">
              Comment <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <textarea
              id="order-review-text"
              data-testid="order-review-text"
              rows={3}
              maxLength={600}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={busy}
              placeholder="Share how the order went"
              className={`mt-1 ${FIELD}`}
            />
            <p className="mt-1 text-xs text-slate-500">{body.length} of 600 characters</p>
          </div>
          {error && (
            <p role="alert" data-testid="order-review-error" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} data-testid="order-review-submit" className={PRIMARY}>
            {busy ? "Sending..." : "Submit review"}
          </button>
        </form>
      )}
    </section>
  );
}
