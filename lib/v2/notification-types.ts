// Shapes returned by /api/desk/notifications. Plain types only, so server and browser code can both import them.

export type NotificationKind = "needs_reply" | "handoff_requested" | "order_confirmed";

export type NotificationDto = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  threadId: string | null;
  createdAt: string;
  read: boolean;
};

export type NotificationsDto = { unread: number; items: NotificationDto[] };
