import type { OrderCard } from "@/lib/catalog";
import type { Delivery } from "@/lib/v2/delivery";

// Shapes returned by the /api/buyer routes. Plain types only, so server and browser code can both import them.

export type ThreadStatus = "ai" | "waiting" | "assigned" | "resolved";
export type OrderStatus = "proposed" | "confirmed" | "packed" | "shipped" | "delivered" | "cancelled";

export type BuyerMessage = {
  id: string;
  sender: "buyer" | "ai" | "staff" | "system";
  text: string; // the buyer's language
  textEn: string | null; // the English counterpart, when one exists
  lang: string | null;
  voiceSeconds: number | null;
  numbersVerified: boolean;
  confidence: number | null;
  createdAt: string;
  staffName: string | null;
  order: OrderCard | null;
  orderId: string | null;
  orderStatus: OrderStatus | null;
  reported?: boolean; // the buyer already reported this message's translation
};

export type BuyerThreadView = {
  thread: {
    id: string;
    status: ThreadStatus;
    language: string | null;
    assignedStaff: { name: string } | null;
    handoffAt: string | null;
    slaDueAt: string | null;
    rating: number | null;
  };
  seller: {
    slug: string;
    name: string;
    assistantName: string; // the owner's name for the shop's AI assistant
    nexconnUserId: string;
    country: string;
    languages: string[];
    teamOnline: boolean;
    responseTargetMin: number;
    hours: { configured: boolean; openNow: boolean; nextOpening: string | null; timeZone: string; awayMessage: string };
  };
  product: { id: string; name: string; priceUsd: number; imageUrl: string | null; stock: number } | null;
  selection: BuyerSelection | null; // what the buyer picked on the product page
  messages: BuyerMessage[];
};

export type BuyerSelection = { colour?: string; qty?: number };

export type BuyerThreadSummary = {
  id: string;
  seller: { slug: string; name: string; country: string };
  status: ThreadStatus;
  lastText: string;
  lastAt: string;
  lastSender: BuyerMessage["sender"] | null;
  productName: string | null;
  unread: number; // messages from the shop or its assistant the buyer has not seen yet
};

export type BuyerOrder = {
  id: string;
  seller: { slug: string; name: string };
  threadId: string | null;
  status: OrderStatus;
  total: number;
  createdAt: string;
  confirmedAt: string | null;
  courier: string | null;
  tracking: string | null;
  card: OrderCard | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  delivery: Delivery | null; // given by the buyer when confirming
  paidAt: string | null; // set by the shop once the money has arrived
  payment: { link: string; instructions: string } | null; // the shop's own way to pay; only sent for a confirmed, unpaid order
  returnEligible: boolean; // delivered within the last 30 days with no return request yet
  returnRequest: BuyerReturn | null;
  review: BuyerReview | null;
};

export const RETURN_REASONS = ["damaged", "wrong_item", "not_as_described", "changed_mind", "other"] as const;
export const RETURN_WINDOW_DAYS = 30;
export type ReturnReason = (typeof RETURN_REASONS)[number];
export type ReturnStatus = "requested" | "approved" | "rejected" | "refunded" | "closed";

export type BuyerReturn = {
  id: string;
  status: ReturnStatus;
  reason: ReturnReason;
  details: string;
  photoUrl: string | null;
  sellerNote: string;
  createdAt: string;
};

export type BuyerReview = { rating: number; body: string; createdAt: string };
