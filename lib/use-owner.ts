"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { onConnection, onMessage, sendText, signOutOwner, type ChatMessage } from "@/lib/nexconn-client";

export type OwnerConversation = {
  customer_id: string;
  status: "ai" | "waiting" | "human";
  language: string | null;
  summary: string | null;
  last_text: string;
  last_at: string;
};
type OwnerMessage = { id: string; sender: "customer" | "ai" | "owner"; text: string; text_en: string | null; created_at: string };

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (res.status === 401) {
    signOutOwner(); // the signed login cookie expired, so go back to the passcode screen
    location.reload();
  }
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as T;
}

// No interval polling on purpose: the free database only sleeps when nothing keeps asking it questions.
function useRefreshTriggers(refresh: () => void) {
  useEffect(() => {
    // The webhook writes the row a moment after the live message, and the AI reply comes a few seconds later.
    const offMessage = onMessage(() => {
      setTimeout(refresh, 1500);
      setTimeout(refresh, 7000);
    });
    window.addEventListener("focus", refresh);
    return () => {
      offMessage();
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);
}

export function useOwnerInbox() {
  const [conversations, setConversations] = useState<OwnerConversation[]>([]);
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    getJson<OwnerConversation[]>("/api/owner/conversations")
      .then((list) => {
        setConversations(list);
        setError("");
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);
  useRefreshTriggers(refresh);

  return { conversations, error, refresh };
}

function toChat(m: OwnerMessage): ChatMessage {
  return {
    id: m.id,
    from: m.sender,
    text: m.text,
    time: new Date(m.created_at).getTime(),
    mine: m.sender !== "customer", // owner and AI both speak for the shop
    ai: m.sender === "ai",
    translation: m.sender === "customer" && m.text_en && m.text_en !== m.text ? m.text_en : undefined,
  };
}

export function useOwnerThread(peerId: string, onChanged: () => void) {
  const [data, setData] = useState<{ conversation: OwnerConversation; messages: OwnerMessage[] } | null>(null);
  const [pending, setPending] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(true);

  const refresh = useCallback(() => {
    getJson<{ conversation: OwnerConversation; messages: OwnerMessage[] }>(`/api/owner/conversations/${peerId}`)
      .then(setData)
      .catch(() => {});
    onChanged();
  }, [peerId, onChanged]);

  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => onConnection(setConnected), []);
  useRefreshTriggers(refresh);

  // A just-sent reply is shown at once and dropped when the database copy arrives via the webhook.
  const messages = useMemo(() => {
    const stored = (data?.messages ?? []).map(toChat);
    const waiting = pending.filter(
      (p) => !stored.some((s) => s.mine && !s.ai && s.text === p.text && s.time >= p.time - 5000),
    );
    return [...stored, ...waiting];
  }, [data, pending]);

  const send = useCallback(
    async (text: string) => {
      const sent = await sendText(peerId, text);
      setPending((prev) => [...prev, sent]);
      setTimeout(refresh, 1500);
      setTimeout(refresh, 5000);
    },
    [peerId, refresh],
  );

  const handBack = useCallback(async () => {
    await getJson(`/api/owner/conversations/${peerId}`, { method: "POST" });
    refresh();
  }, [peerId, refresh]);

  return { conversation: data?.conversation, messages, connected, send, handBack };
}
