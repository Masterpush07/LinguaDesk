import type { OrderCard } from "@/lib/catalog";
import type { TranslationReportDto } from "@/lib/v2/translation-report";

// Shared by the desk API routes and the desk screens. Types only, so it is safe in both server and client code.

export type ThreadStatus = "ai" | "waiting" | "assigned" | "resolved";
export type ThreadPriority = "normal" | "high" | "critical";
export type ThreadFilter = "all" | "unassigned" | "mine" | "critical";

export type ThreadSummary = {
  id: string;
  buyer: { id: string; label: string };
  status: ThreadStatus;
  priority: ThreadPriority;
  language: string | null;
  subject: string;
  summary: string | null;
  assignedStaff: { id: string; name: string } | null;
  lastText: string;
  lastAt: string;
  handoffAt: string | null;
  slaDueAt: string | null;
  productName: string | null;
  unrepliedBuyerMessages: number;
};

export type ThreadHead = ThreadSummary & {
  createdAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
};

export type DeskMessage = {
  id: string;
  sender: "buyer" | "ai" | "staff" | "system";
  text: string;
  textEn: string | null;
  lang: string | null;
  voiceSeconds: number | null;
  numbersVerified: boolean;
  confidence: number | null;
  createdAt: string;
  staffName: string | null;
  order: OrderCard | null;
};

export type DeskNote = { id: string; text: string; staffName: string | null; createdAt: string };
export type DeskEvent = { type: string; actor: string; payload: Record<string, unknown>; at: string };
export type DeskOrder = { id: string; status: string; total: number; createdAt: string };

export type TeamMember = {
  id: string;
  name: string;
  role: "owner" | "agent";
  languages: string[];
  online: boolean;
  available: boolean;
  load: number;
  maxConcurrent: number;
};

export type RosterMember = TeamMember & { skills: string[] };

export type ThreadDetail = {
  thread: ThreadHead;
  buyer: { id: string; label: string; name: string | null; language: string | null };
  messages: DeskMessage[];
  notes: DeskNote[];
  events: DeskEvent[];
  orders: DeskOrder[];
  product: { id: string; name: string; priceUsd: number; imageUrl: string | null } | null;
  selection: { colour?: string; qty?: number } | null; // what the buyer picked on the product page
  team: TeamMember[];
  reports: TranslationReportDto[]; // translations the buyer flagged as wrong
};

export type CatalogItem = { id: string; name: string; priceUsd: number; stock: number };

export type PreviewResult = { translated: string; backTranslated: string | null; numbersOk: boolean; language: string; sameLanguage: boolean };

export type DispatchData = {
  stats: { waiting: number; unassigned: number; breached: number; resolvedToday: number; onlineStaff: number };
  columns: { unassigned: ThreadSummary[]; assigned: ThreadSummary[]; resolved: ThreadSummary[] };
  roster: RosterMember[];
};

export type DeskCustomer = {
  id: string;
  threadId: string;
  label: string;
  language: string | null;
  threads: number;
  orders: number;
  spentUsd: number;
  lastAt: string;
  lastStatus: ThreadStatus;
};
