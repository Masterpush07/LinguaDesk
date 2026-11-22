import type { Message } from "@nexconn/chat";
import { parseOrderCard, type OrderCard } from "@/lib/catalog";

// Browser-only wrapper around the Nexconn Web SDK, shared by the customer chat and the owner dashboard.

export type Session = { userId: string; token: string };
export type ChatMessage = {
  id: string;
  from: string;
  text: string;
  time: number;
  mine: boolean;
  ai: boolean;
  translation?: string; // English version shown to the owner under a customer's message
  translationLabel?: string;
  numberWarning?: boolean; // the numbers in the translation differ from the original
  order?: OrderCard; // set when the message carries an order card in its metadata
  confirmsOrder?: string; // set on the automatic message that confirms an order, so its card can show "confirmed"
};
export type Conversation = {
  peerId: string;
  unread: number;
  lastText: string;
  time: number;
};

type Sdk = typeof import("@nexconn/chat");
let sdk: Sdk | null = null;
let boot: Promise<string> | null = null;
let myId = "";

const messageListeners = new Set<(m: ChatMessage) => void>();
const connectionListeners = new Set<(connected: boolean) => void>();
const channelSyncListeners = new Set<() => void>();
const typingListeners = new Set<(userId: string) => void>();

function toChat(m: Message): ChatMessage | null {
  const text = (m.content as { text?: string }).text;
  if (!sdk || m.messageType !== sdk.MessageType.TEXT || text === undefined)
    return null;
  return {
    id: m.messageId,
    from: m.senderUserId,
    text,
    time: m.sentTime,
    mine: m.senderUserId === myId,
    ai: m.metadata?.get("ai") === "1", // set by the server when the bot wrote the message
    order: parseOrderCard(m.metadata?.get("order")) ?? undefined,
    confirmsOrder: m.metadata?.get("orderConfirmed") || undefined,
  };
}

function requireSdk(): Sdk {
  if (!sdk) throw new Error("Chat is not connected yet");
  return sdk;
}

// Cached promise: the SDK must be initialised once, and React dev mode runs effects twice.
export function connect(session: Session): Promise<string> {
  boot ??= (async () => {
    const lib = await import("@nexconn/chat");
    sdk = lib;
    lib.NCEngine.initialize({
      appKey: process.env.NEXT_PUBLIC_NEXCONN_APP_KEY!,
      areaCode: lib.AreaCode.SG,
    });
    lib.NCEngine.addConnectionStatusHandler(
      "app",
      new lib.ConnectionStatusHandler({
        onConnectionStatusChanged({ status }) {
          connectionListeners.forEach((l) =>
            l(status === lib.ConnectionStatus.CONNECTED),
          );
        },
      }),
    );
    lib.NCEngine.addMessageHandler(
      "app",
      new lib.MessageHandler({
        onMessageReceived({ messages }) {
          for (const m of messages) {
            const chat = toChat(m);
            if (chat) messageListeners.forEach((l) => l(chat));
          }
        },
      }),
    );
    // The channel list only exists after the SDK finishes syncing it from the server.
    lib.NCEngine.addChannelHandler(
      "app",
      new lib.ChannelHandler({
        onChannelsSyncComplete() {
          channelSyncListeners.forEach((l) => l());
        },
        // Fires while the other person is typing in a one-to-one channel with this user.
        onTypingStatusChanged({ channelIdentifier, userTypingStatus }) {
          if (channelIdentifier.channelType !== lib.ChannelType.DIRECT) return;
          for (const t of userTypingStatus) if (t.userId !== myId) typingListeners.forEach((l) => l(t.userId));
        },
      }),
    );
    const res = await lib.NCEngine.connect({ token: session.token });
    if (!res.isOk)
      throw new Error(`Could not connect to chat (code ${res.code})`);
    myId = res.data!.userId;
    return myId;
  })();
  return boot;
}

export function onMessage(listener: (m: ChatMessage) => void) {
  messageListeners.add(listener);
  return () => {
    messageListeners.delete(listener);
  };
}

export function onConnection(listener: (connected: boolean) => void) {
  connectionListeners.add(listener);
  return () => {
    connectionListeners.delete(listener);
  };
}

export function onChannelsSynced(listener: () => void) {
  channelSyncListeners.add(listener);
  return () => {
    channelSyncListeners.delete(listener);
  };
}

export function onTyping(listener: (userId: string) => void) {
  typingListeners.add(listener);
  return () => {
    typingListeners.delete(listener);
  };
}

// Tells the other person "typing…". Best effort: a failure here must never affect writing or sending.
export function sendTyping(peerId: string): void {
  if (!sdk) return;
  void new sdk.DirectChannel(peerId).sendTypingStatus("RC:TxtMsg").catch(() => undefined);
}

export async function sendText(
  peerId: string,
  text: string,
): Promise<ChatMessage> {
  const lib = requireSdk();
  const res = await new lib.DirectChannel(peerId).sendMessage(
    new lib.SendTextMessageParams({ text }),
  );
  const chat = res.isOk && res.data ? toChat(res.data) : null;
  if (!chat) throw new Error(`Message not sent (code ${res.code})`);
  return chat;
}

// Newest 50 messages, returned oldest first for display.
export async function loadHistory(peerId: string): Promise<ChatMessage[]> {
  const lib = requireSdk();
  const query = lib.BaseChannel.createMessagesQuery({
    channelIdentifier: new lib.DirectChannel(peerId).identifier,
    startTime: Date.now(),
    pageSize: 50,
    isAscending: false,
  });
  const res = await query.loadNextPage();
  if (!res.isOk || !res.data) return [];
  return res.data.data
    .map(toChat)
    .filter((m): m is ChatMessage => m !== null)
    .reverse();
}

export async function listConversations(): Promise<Conversation[]> {
  const lib = requireSdk();
  const res = await lib.BaseChannel.createChannelsQuery({
    pageSize: 50,
  }).loadNextPage();
  if (!res.isOk || !res.data) return [];
  return res.data.data
    .filter((c) => c.channelType === lib.ChannelType.DIRECT)
    .map((c) => ({
      peerId: c.channelId,
      unread: c.unreadCount,
      lastText: c.latestMessage
        ? (toChat(c.latestMessage)?.text ?? "[attachment]")
        : "",
      time: c.operationTime,
    }))
    .sort((a, b) => b.time - a.time);
}

export async function clearUnread(peerId: string): Promise<void> {
  await new (requireSdk().DirectChannel)(peerId).clearUnreadCount();
}

// Guests keep one identity per browser; a new ID on every reload would inflate the monthly-user count.
const GUEST_KEY = "linguadesk.guest";
const OWNER_KEY = "linguadesk.owner";
let guestSession: Promise<Session> | null = null;

export function getGuestSession(): Promise<Session> {
  guestSession ??= (async () => {
    const saved = localStorage.getItem(GUEST_KEY);
    if (saved) return JSON.parse(saved) as Session;
    const res = await fetch("/api/token", { method: "POST" });
    if (!res.ok) throw new Error("Could not start chat");
    const session = (await res.json()) as Session;
    localStorage.setItem(GUEST_KEY, JSON.stringify(session));
    return session;
  })();
  return guestSession;
}

// Used when a stored token stops working, so the next load registers a fresh guest.
export function forgetGuest() {
  localStorage.removeItem(GUEST_KEY);
}

export async function getOwnerSession(passcode: string): Promise<Session> {
  const res = await fetch("/api/owner/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passcode }),
  });
  if (res.status === 401) throw new Error("Wrong passcode");
  if (!res.ok) throw new Error("Owner login failed");
  const session = (await res.json()) as Session;
  sessionStorage.setItem(OWNER_KEY, JSON.stringify(session)); // per-tab, cleared when the tab closes
  return session;
}

export function savedOwnerSession(): Session | null {
  const saved = sessionStorage.getItem(OWNER_KEY);
  return saved ? (JSON.parse(saved) as Session) : null;
}

export function signOutOwner() {
  sessionStorage.removeItem(OWNER_KEY);
}
