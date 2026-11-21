// Types for the seller-studio API responses, shared by the routes and the screens.
import type { WeekHours } from "@/lib/v2/hours";

export type ProductDto = {
  id: string;
  name: string;
  description: string;
  category: string;
  priceUsd: number;
  colors: string[];
  sizes: string[];
  stock: number;
  imageUrl: string | null;
  active: boolean;
  updatedAt: string;
};

export type FaqDto = { id: string; q: string; a: string };
export type GlossaryDto = { id: string; term: string; rule: "keep" | "fixed"; note: string };
export type CannedDto = { id: string; title: string; body: string };

export type Tone = "formal" | "neutral" | "friendly";

export type SettingsDto = {
  name: string;
  agentName: string; // the AI assistant's name; empty means the default "<Shop> Assistant"
  tagline: string;
  about: string;
  country: string;
  languages: string[];
  hours: string;
  tone: Tone;
  businessHours: WeekHours; // opening times per weekday; an empty object means the shop is always open
  timezone: string; // IANA zone the business hours are written in
  awayMessage: string; // shown to customers while the shop is closed
  responseTargetMin: number;
  shipping: { freeAbove: number; fee: number; worldwideDays: string; domesticDays: string; notes: string };
  policies: { returns: string; payment: string; customOrders: string; discounts: string; giftWrap: string; care: string };
  slug: string;
  shareUrlPath: string;
};

export type TeamMemberDto = {
  id: string;
  name: string;
  role: "owner" | "agent";
  languages: string[];
  skills: string[];
  maxConcurrent: number;
  available: boolean;
  online: boolean;
  lastSeen: string | null;
  activeThreads: number;
};

export type InviteDto = { code: string; createdAt: string; createdByName: string | null };

export const ORDER_STATUSES = ["proposed", "confirmed", "packed", "shipped", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderDto = {
  id: string;
  status: OrderStatus;
  total: number;
  subtotal: number | null;
  shipping: number | null;
  createdAt: string;
  confirmedAt: string | null;
  courier: string | null;
  tracking: string | null;
  buyerLabel: string;
  threadId: string | null;
  lines: { name: string; qty: number; amount: number }[];
  notified?: boolean;
};

export type ThreadStatus = "ai" | "waiting" | "assigned" | "resolved";
export type ThreadPriority = "normal" | "high" | "critical";

export type OverviewDto = {
  openThreads: number;
  waitingForAgent: number;
  aiResolvedPercent: number | null;
  ordersToday: number;
  confirmedOrders: number;
  ordersToFulfil: number;
  lowStock: { id: string; name: string; stock: number }[];
  recentThreads: { id: string; buyerLabel: string; subject: string; status: ThreadStatus; priority: ThreadPriority; lastAt: string }[];
};

export type AnalyticsDto = {
  days: number;
  totals: {
    threads: number;
    buyerMessages: number;
    aiMessages: number;
    staffMessages: number;
    handoffRate: number | null;
    aiResolvedPercent: number | null;
    avgFirstResponseMinutes: number | null;
    avgResolutionMinutes: number | null;
    avgRating: number | null;
    ratingCount: number;
    revenueUsd: number;
  };
  daily: { day: string; threads: number; buyerMessages: number }[];
  languages: { language: string; count: number }[];
  topics: { topic: string; count: number }[];
  agents: { id: string; name: string; handled: number; avgFirstResponseMinutes: number | null }[];
  funnel: { conversations: number; handoffs: number; ordersProposed: number; ordersConfirmed: number };
};

export type GlossaryTestDto = {
  label: string;
  reply: string;
  language: string;
  buyerMessageEnglish: string;
  needsAgent: boolean;
  blocked: boolean;
};

export const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  nl: "Dutch",
  pl: "Polish",
  ru: "Russian",
  tr: "Turkish",
  ar: "Arabic",
  hi: "Hindi",
  ta: "Tamil",
  bn: "Bengali",
  ur: "Urdu",
  id: "Indonesian",
  th: "Thai",
  vi: "Vietnamese",
  zh: "Chinese",
  ja: "Japanese",
  ko: "Korean",
  sw: "Swahili",
};

export const languageName = (code: string) => LANGUAGE_NAMES[code] ?? code.toUpperCase();

// What PUT /api/desk/settings accepts: the stored settings without the read-only storefront fields.
export function settingsPayload(s: SettingsDto) {
  return {
    name: s.name,
    agentName: s.agentName,
    tagline: s.tagline,
    about: s.about,
    country: s.country,
    languages: s.languages,
    hours: s.hours,
    businessHours: s.businessHours,
    timezone: s.timezone,
    awayMessage: s.awayMessage,
    tone: s.tone,
    responseTargetMin: s.responseTargetMin,
    shipping: s.shipping,
    policies: s.policies,
  };
}

export const formatUsd = (n: number) => `$${n.toLocaleString("en-US")}`;

export const formatDateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";

export const PRIORITY_LABEL: Record<"normal" | "high" | "critical", string> = { normal: "Normal", high: "High", critical: "Critical" };

export function formatMinutes(minutes: number | null): string {
  if (minutes === null) return "No data yet";
  if (minutes < 1) return "Under 1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
