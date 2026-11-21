// Shared by the seller returns API and screen. Safe to import in the browser.

export const RETURN_STATUSES = ["requested", "approved", "rejected", "refunded", "closed"] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

export const RETURN_ACTIONS = ["approved", "rejected", "refunded", "closed"] as const;
export type ReturnAction = (typeof RETURN_ACTIONS)[number];

export const RETURN_NOTE_MAX = 300;

// Which statuses a request can move to from each status.
export const RETURN_TRANSITIONS: Record<ReturnStatus, readonly ReturnAction[]> = {
  requested: ["approved", "rejected"],
  approved: ["refunded", "closed"],
  rejected: ["closed"],
  refunded: ["closed"],
  closed: [],
};

export const RETURN_REASON_LABEL: Record<string, string> = {
  damaged: "Item arrived damaged",
  wrong_item: "Wrong item received",
  not_as_described: "Not as described",
  changed_mind: "Changed my mind",
  other: "Other reason",
};

export const RETURN_STATUS_LABEL: Record<ReturnStatus, string> = {
  requested: "Requested",
  approved: "Approved",
  rejected: "Rejected",
  refunded: "Refunded",
  closed: "Closed",
};

export type ReturnDto = {
  id: string;
  orderId: string;
  orderTotal: number | null;
  buyerLabel: string;
  reason: string;
  reasonLabel: string;
  details: string;
  photoUrl: string | null;
  status: ReturnStatus;
  sellerNote: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ReturnsResponse = { returns: ReturnDto[]; counts: Record<ReturnStatus, number> };
