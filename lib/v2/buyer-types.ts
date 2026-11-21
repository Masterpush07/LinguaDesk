import type { OrderCard } from "@/lib/catalog";

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
  };
  product: { id: string; name: string; priceUsd: number; imageUrl: string | null; stock: number } | null;
  messages: BuyerMessage[];
};

export type BuyerThreadSummary = {
  id: string;
  seller: { slug: string; name: string; country: string };
  status: ThreadStatus;
  lastText: string;
  lastAt: string;
  lastSender: BuyerMessage["sender"] | null;
  productName: string | null;
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
};
