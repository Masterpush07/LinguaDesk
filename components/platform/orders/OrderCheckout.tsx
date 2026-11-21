"use client";

import Link from "next/link";
import { CheckCircle2, CreditCard, ExternalLink, MapPin, ShieldCheck } from "lucide-react";
import { Price } from "@/components/platform/Prefs";
import type { BuyerOrder } from "@/lib/v2/buyer-types";
import { formatDelivery } from "@/lib/v2/delivery";
import { shortDate } from "./orderStatus";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2";

// Where the order is going, as the buyer entered it. Only the buyer and the shop team can read this.
export function DeliveryCard({ order }: { order: BuyerOrder }) {
  if (!order.delivery) return null;
  return (
    <section aria-labelledby="delivery-heading" className="rounded-2xl border border-slate-200 bg-white p-5" data-testid="order-delivery-card">
      <h2 id="delivery-heading" className="flex items-center gap-2 font-heading text-base font-semibold text-slate-900">
        <MapPin className="h-4 w-4 text-cyan-600" aria-hidden="true" /> Delivery address
      </h2>
      <p data-testid="order-delivery-address" className="mt-3 whitespace-pre-line text-sm text-slate-800">
        {formatDelivery(order.delivery)}
      </p>
      <p className="mt-3 text-xs text-slate-500">Need to change it? Tell the shop in your conversation before the order ships.</p>
    </section>
  );
}

function hostOf(link: string): string {
  try {
    return new URL(link).hostname;
  } catch {
    return "";
  }
}

// The shop takes payment on its own page. LinguaDesk never handles the money, and says so.
export function PaymentCard({ order }: { order: BuyerOrder }) {
  const open = order.status !== "proposed" && order.status !== "cancelled";
  if (!open) return null;

  if (order.paidAt) {
    return (
      <section aria-labelledby="payment-heading" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5" data-testid="order-payment-card" data-state="paid">
        <h2 id="payment-heading" className="flex items-center gap-2 font-heading text-base font-semibold text-emerald-900">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Paid
        </h2>
        <p data-testid="order-paid-note" className="mt-2 text-sm text-emerald-900">
          The shop confirmed your payment on {shortDate(order.paidAt)}. Thank you.
        </p>
      </section>
    );
  }

  const pay = order.payment;
  const host = pay?.link ? hostOf(pay.link) : "";
  return (
    <section aria-labelledby="payment-heading" className="rounded-2xl border border-slate-200 bg-white p-5" data-testid="order-payment-card" data-state="unpaid">
      <h2 id="payment-heading" className="flex items-center gap-2 font-heading text-base font-semibold text-slate-900">
        <CreditCard className="h-4 w-4 text-cyan-600" aria-hidden="true" /> Pay the shop
      </h2>
      {pay ? (
        <>
          <p className="mt-2 text-sm text-slate-700">
            Amount to pay: <Price usd={order.total} className="font-semibold text-slate-900" />
          </p>
          {pay.instructions && (
            <p data-testid="order-payment-instructions" className="mt-2 whitespace-pre-line rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-800">
              {pay.instructions}
            </p>
          )}
          {pay.link && (
            <a
              href={pay.link}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="order-pay-link"
              className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 motion-reduce:transition-none ${FOCUS}`}
            >
              Open the shop&apos;s payment page <ExternalLink className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
          {host && (
            <p data-testid="order-pay-host" className="mt-2 text-center text-xs text-slate-500">
              Opens {host}
            </p>
          )}
        </>
      ) : (
        <p data-testid="order-payment-none" className="mt-2 text-sm text-slate-700">
          The shop will tell you how to pay in your conversation.{" "}
          <Link href={`/chat/${order.seller.slug}`} className={`rounded font-medium text-indigo-700 hover:underline ${FOCUS}`}>
            Open the conversation
          </Link>
        </p>
      )}
      <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-500">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
        <span>Payments go directly to the shop. LinguaDesk does not process or hold any money. Only pay through links you trust. Once the shop has your payment it marks the order as paid here.</span>
      </p>
    </section>
  );
}
