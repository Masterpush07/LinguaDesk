// Shared by server and browser: what a buyer can report about a translation, and how a report is shown to the shop.

export const REPORT_REASONS = ["wrong_meaning", "wrong_number", "rude", "missing", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  wrong_meaning: "The meaning is wrong",
  wrong_number: "A number, price or date is wrong",
  rude: "It sounds rude or strange",
  missing: "Part of the message is missing",
  other: "Something else",
};

export const REPORT_COMMENT_MAX = 300;

export type TranslationReportDto = {
  id: string;
  messageId: string;
  reason: ReportReason;
  comment: string;
  sender: "buyer" | "ai" | "staff";
  originalText: string; // what the writer wrote
  translatedText: string; // what the other side was shown
  status: "open" | "reviewed";
  createdAt: string;
};
