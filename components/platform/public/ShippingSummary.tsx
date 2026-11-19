import { Price } from "@/components/platform/Prefs";
import type { ShopDetail } from "@/components/platform/public/types";

type Shipping = ShopDetail["seller"]["shipping"];

export function hasShipping(s: Shipping): boolean {
  return Boolean(s.fee || s.freeAbove || s.worldwideDays || s.domesticDays || s.notes);
}

// Only the details the shop has filled in are listed.
export function ShippingSummary({ shipping, testId }: { shipping: Shipping; testId: string }) {
  if (!hasShipping(shipping)) {
    return (
      <p className="mt-2 text-sm text-slate-500" data-testid={`${testId}-empty`}>
        The shop has not published shipping details yet. Start a conversation to ask.
      </p>
    );
  }
  return (
    <ul className="mt-2 space-y-1 text-sm leading-relaxed text-slate-600" data-testid={testId}>
      {Boolean(shipping.fee) && (
        <li>
          Shipping fee: <Price usd={shipping.fee ?? 0} />
        </li>
      )}
      {Boolean(shipping.freeAbove) && (
        <li>
          Free shipping on orders above <Price usd={shipping.freeAbove ?? 0} />
        </li>
      )}
      {shipping.domesticDays && <li>Domestic delivery: {shipping.domesticDays}</li>}
      {shipping.worldwideDays && <li>Worldwide delivery: {shipping.worldwideDays}</li>}
      {shipping.notes && <li>{shipping.notes}</li>}
    </ul>
  );
}
