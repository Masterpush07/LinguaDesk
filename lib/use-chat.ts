"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearUnread,
  listConversations,
  loadHistory,
  onChannelsSynced,
  onConnection,
  onMessage,
  sendText,
  type ChatMessage,
  type Conversation,
} from "@/lib/nexconn-client";

// Merging by message ID keeps a live message and the history fetch from ever duplicating each other.
function merge(prev: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(prev.map((m) => [m.id, m]));
  incoming.forEach((m) => byId.set(m.id, m));
  return [...byId.values()].sort((a, b) => a.time - b.time);
}

// Render it under a key={peerId} parent so switching conversations remounts and resets the state.
export function useConversation(peerId: string, markRead = false) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    let alive = true;
    loadHistory(peerId).then((history) => {
      if (alive) setMessages((prev) => merge(prev, history));
    });
    const offMessage = onMessage((m) => {
      if (m.from !== peerId) return;
      setMessages((prev) => merge(prev, [m]));
      if (markRead) void clearUnread(peerId);
    });
    const offConnection = onConnection(setConnected);
    if (markRead) void clearUnread(peerId);
    return () => {
      alive = false;
      offMessage();
      offConnection();
    };
  }, [peerId, markRead]);

  const send = useCallback(
    async (text: string) => {
      const sent = await sendText(peerId, text);
      setMessages((prev) => merge(prev, [sent]));
    },
    [peerId],
  );

  return { messages, connected, send };
}

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    const list = await listConversations();
    if (mounted.current) setConversations(list);
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    // The first query can run before the SDK has synced the channel list, so refresh on sync and retry once.
    const offSync = onChannelsSynced(() => void refresh());
    const retry = setTimeout(() => void refresh(), 2500);
    // Short delay lets the SDK update its channel list before we read it.
    const off = onMessage(() => {
      setTimeout(() => void refresh(), 400);
    });
    return () => {
      mounted.current = false;
      clearTimeout(retry);
      offSync();
      off();
    };
  }, [refresh]);

  return { conversations, refresh };
}
