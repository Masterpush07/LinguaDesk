"use client";

import Link from "next/link";
import { CheckCircle2, Copy, ExternalLink, RefreshCw, Star, UserRound } from "lucide-react";
import { Price } from "@/components/platform/Prefs";
import { Avatar, StatusBadge } from "@/components/platform/ui";
import type { OrderCard } from "@/lib/catalog";
import type { BuyerThreadView, OrderStatus } from "@/lib/v2/buyer-types";

export const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2";

export function TypingIndicator({ label }: { label: string }) {
  return (
    <div data-testid="typing-indicator" role="status" className="flex items-center gap-2 px-1 text-xs text-slate-500">
      <span className="flex items-center gap-1 rounded-full bg-violet-50 px-3 py-2 ring-1 ring-violet-200" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ animationDelay: `${i * 150}ms` }} className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-500 motion-reduce:animate-pulse" />
        ))}
      </span>
      <span>{label}</span>
    </div>
  );
}

type BannerProps = {
  view: BuyerThreadView;
  busy: boolean;
  onHandoff: () => void;
  onCancel: () => void;
  onNewQuestion: () => void;
  onRate: (rating: number) => void;
};

// Says what is happening, what happens next, and offers one clear action.
export function StatusBanner({ view, busy, onHandoff, onCancel, onNewQuestion, onRate }: BannerProps) {
  const { status, assignedStaff, slaDueAt, rating } = view.thread;
  const staffName = assignedStaff?.name ?? "A member of the shop team";
  const assistant = view.seller.assistantName;
  const btn = `shrink-0 rounded-full px-4 py-2 text-sm font-medium transition motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS}`;
  const secondary = `${btn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;

  return (
    <section aria-label="Conversation status" data-testid="chat-status-banner" data-status={status} className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3">
        {status === "assigned" ? (
          <Avatar name={staffName} size="h-10 w-10" />
        ) : (
          <span
            aria-hidden="true"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${status === "waiting" ? "bg-amber-50 text-amber-600 ring-1 ring-amber-200" : status === "resolved" ? "bg-slate-100 text-slate-500 ring-1 ring-slate-200" : "bg-violet-50 text-violet-600 ring-1 ring-violet-200"}`}
          >
            <UserRound className={`h-5 w-5 ${status === "waiting" ? "animate-pulse motion-reduce:animate-none" : ""}`} />
          </span>
        )}
        <div className="min-w-0 flex-1 basis-64" role="status" data-testid="chat-status-text">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
            {status === "ai" && `${assistant} is answering`}
            {status === "waiting" && "Your question has been passed to the shop"}
            {status === "assigned" && `${staffName} has joined`}
            {status === "resolved" && "This conversation is resolved"}
            <StatusBadge status={status} />
          </p>
          <p className={`mt-0.5 text-sm text-slate-600 ${status === "ai" || status === "assigned" ? "max-sm:hidden" : ""}`}>
            {status === "ai" && `${assistant} answers from this shop's products, policies and FAQs. If it cannot help, your question goes to the shop owner. You can also select Ask the shop owner at any time.`}
            {status === "waiting" && `The shop owner has been notified and will reply in this conversation. ${assistant} can keep helping in the meantime, and you may add more details while you wait.`}
            {status === "assigned" && `${staffName} can see this whole conversation. Write your question below and the reply will appear here.`}
            {status === "resolved" && "Thank you for contacting the shop. How was your experience?"}
          </p>
          {view.seller.hours.configured && !view.seller.hours.openNow && (
            <div data-testid="chat-shop-away" className="mt-0.5 text-sm text-slate-600">
              <p data-testid="chat-shop-away-text">
                The shop team is away.{view.seller.hours.nextOpening ? ` They are back ${view.seller.hours.nextOpening} (${view.seller.hours.timeZone}).` : ""}
              </p>
              {view.seller.hours.awayMessage && (
                <p data-testid="chat-shop-away-message" className="mt-0.5">{view.seller.hours.awayMessage}</p>
              )}
            </div>
          )}
          {status === "waiting" && slaDueAt && (
            <p data-testid="chat-response-target" className="mt-0.5 text-xs text-slate-500">
              The shop aims to reply within {view.seller.responseTargetMin} minutes.
            </p>
          )}
          {status === "resolved" && (
            <div role="group" aria-label="Rate this conversation" data-testid="chat-rating" className="mt-2 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => {
                const filled = (rating ?? 0) >= n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onRate(n)}
                    disabled={busy}
                    aria-label={`Rate ${n} out of 5`}
                    aria-pressed={rating === n}
                    data-testid={`chat-rating-star-${n}`}
                    className={`rounded-full p-1 disabled:cursor-not-allowed ${FOCUS}`}
                  >
                    <Star className={`h-5 w-5 ${filled ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} aria-hidden="true" />
                  </button>
                );
              })}
              {rating !== null && (
                <span data-testid="chat-rating-thanks" className="ml-1 text-xs text-slate-500">
                  Thank you for your rating.
                </span>
              )}
            </div>
          )}
        </div>
        {status === "ai" && (
          <button type="button" onClick={onHandoff} disabled={busy} data-testid="handoff-btn" className={`${btn} bg-indigo-600 text-white hover:bg-indigo-700`}>
            Ask the shop owner
          </button>
        )}
        {status === "waiting" && (
          <button type="button" onClick={onCancel} disabled={busy} data-testid="cancel-handoff-btn" className={secondary}>
            Cancel request
          </button>
        )}
        {status === "assigned" && (
          <button type="button" onClick={onCancel} disabled={busy} data-testid="return-to-ai-btn" className={secondary}>
            Back to {assistant}
          </button>
        )}
        {status === "resolved" && (
          <button type="button" onClick={onNewQuestion} data-testid="new-question-btn" className={secondary}>
            Start a new question
          </button>
        )}
      </div>
    </section>
  );
}

export function SendFailedPanel({ id, text, onRetry, onCopy, onDiscard }: { id: string; text: string; onRetry: () => void; onCopy: () => void; onDiscard: () => void }) {
  const small = `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${FOCUS}`;
  return (
    <div role="alert" data-testid={`send-failed-${id}`} className="max-w-[85%] rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 sm:max-w-[75%]">
      <p className="text-sm font-semibold text-amber-900">Your message was not sent.</p>
      <p className="mt-0.5 text-xs text-amber-800">Check your connection and try again. You can also copy the text so nothing is lost.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={onRetry} data-testid={`send-retry-${id}`} className={`${small} bg-indigo-600 text-white hover:bg-indigo-700`}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Retry
        </button>
        <button type="button" onClick={onCopy} aria-label={`Copy text: ${text.slice(0, 40)}`} data-testid={`send-copy-${id}`} className={`${small} border border-amber-300 bg-white text-amber-900 hover:bg-amber-100`}>
          <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copy text
        </button>
        <button type="button" onClick={onDiscard} data-testid={`send-discard-${id}`} className={`${small} text-amber-900 hover:bg-amber-100`}>
          Discard
        </button>
      </div>
    </div>
  );
}

export function ProductBar({ product, sellerSlug }: { product: NonNullable<BuyerThreadView["product"]>; sellerSlug: string }) {
  return (
    <div data-testid="chat-product-bar" className="border-b border-slate-200 bg-slate-50 px-4 py-2 sm:px-6">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt={product.name} referrerPolicy="no-referrer" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
        ) : (
          <span aria-hidden="true" className="h-11 w-11 shrink-0 rounded-lg bg-gradient-to-br from-indigo-100 via-violet-100 to-cyan-100" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 max-sm:hidden">You are asking about</p>
          <p data-testid="chat-product-name" className="truncate text-sm font-semibold text-slate-900">
            {product.name}
          </p>
        </div>
        <Price usd={product.priceUsd} className="font-heading text-sm font-semibold text-slate-900" />
        <Link
          href={`/s/${sellerSlug}/p/${product.id}`}
          data-testid="chat-product-link"
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 ${FOCUS}`}
        >
          View product <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

export const ORDER_STATUS_TEXT: Record<OrderStatus, string> = {
  proposed: "Waiting for your confirmation",
  confirmed: "Confirmed. The shop will arrange payment and shipping.",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled by the shop",
};

type OrderProps = {
  order: OrderCard;
  orderId: string;
  status: OrderStatus | null;
  busy: boolean;
  error: string | null;
  onConfirm: (orderId: string) => void;
};

// The order the shop proposed in the conversation. Amounts are shown in US dollars exactly as the shop priced them.
export function OrderCardView({ order, orderId, status, busy, error, onConfirm }: OrderProps) {
  const proposed = status === "proposed";
  return (
    <section aria-label="Order summary" data-testid={`order-card-${orderId}`} data-state={status ?? "unknown"} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-cyan-700">{order.labels.title}</p>
      <ul className="mt-2 divide-y divide-slate-100">
        {order.lines.map((l, i) => (
          <li key={`${l.name}-${i}`} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
            <span className="min-w-0 text-slate-800">
              {l.name} <span className="text-slate-500">× {l.qty}</span>
            </span>
            <span className="shrink-0 font-medium text-slate-900">${l.amount}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-500">{order.labels.subtotal}</dt>
          <dd className="text-slate-800">${order.subtotal}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">{order.labels.shipping}</dt>
          <dd className="text-slate-800">{order.shipping === 0 ? order.labels.free : `$${order.shipping}`}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-semibold text-slate-900">{order.labels.total}</dt>
          <dd data-testid={`order-card-total-${orderId}`} className="font-heading text-base font-semibold text-slate-900">
            ${order.total}
          </dd>
        </div>
      </dl>
      {status === null ? null : proposed ? (
        <button
          type="button"
          onClick={() => onConfirm(orderId)}
          disabled={busy}
          data-testid={`order-confirm-btn-${orderId}`}
          className={`mt-3 w-full rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 motion-reduce:transition-none disabled:cursor-not-allowed disabled:bg-slate-300 ${FOCUS}`}
        >
          {busy ? "Confirming..." : order.labels.confirm}
        </button>
      ) : (
        <div className="mt-3 space-y-2">
          <p role="status" data-testid={`order-card-status-${orderId}`} className={`flex items-center gap-2 text-sm font-semibold ${status === "cancelled" ? "text-slate-600" : "text-emerald-700"}`}>
            {status !== "cancelled" && <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
            {ORDER_STATUS_TEXT[status]}
          </p>
          <Link href={`/orders/${encodeURIComponent(orderId)}`} data-testid={`order-card-view-${orderId}`} className={`inline-flex rounded-full text-sm font-medium text-indigo-700 hover:underline ${FOCUS}`}>
            View order status
          </Link>
        </div>
      )}
      {error && (
        <p role="alert" data-testid={`order-card-error-${orderId}`} className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
