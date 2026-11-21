import { buyerLabel, iso } from "@/lib/v2/seller-api";
import { RETURN_REASON_LABEL, type ReturnDto, type ReturnStatus } from "@/lib/v2/returns-types";

// Server-only. Maps a return_requests row joined with its order (o.total) to what the seller screen shows. Buyer ids are never exposed.
export function returnDto(r: Record<string, unknown>): ReturnDto {
  return {
    id: r.id as string,
    orderId: r.order_id as string,
    orderTotal: r.total === null || r.total === undefined ? null : Number(r.total),
    buyerLabel: buyerLabel(r.buyer_id as string),
    reason: r.reason as string,
    reasonLabel: RETURN_REASON_LABEL[r.reason as string] ?? (r.reason as string),
    details: (r.details as string | null) ?? "",
    photoUrl: r.photo_asset_id ? `/api/assets/${r.photo_asset_id as string}` : null,
    status: r.status as ReturnStatus,
    sellerNote: (r.seller_note as string | null) ?? "",
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}
