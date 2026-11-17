"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  onConnection,
  onMessage,
  signOutOwner,
  type ChatMessage,
} from "@/lib/nexconn-client";
import { sameNumbers } from "@/lib/number-check";

export type OwnerConversation = {
  customer_id: string;
  status: "ai" | "waiting" | "human";
  language: string | null;
  summary: string | null;
  last_text: string;
  last_at: string;
};
type OwnerMessage = {
  id: string;
  sender: "customer" | "ai" | "owner";
  text: string;
  text_en: string | null;
  created_at: string;
};

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
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(() => {
    getJson<OwnerConversation[]>("/api/owner/conversations")
      .then((list) => {
        setConversations(list);
        setError("");
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);
  useRefreshTriggers(refresh);

  return { conversations, error, loaded, refresh };
}

function toChat(m: OwnerMessage): ChatMessage {
  const fromCustomer = m.sender === "customer";
  // For an owner reply, text_en is the owner's own English and text is what the customer received.
  const sentInEnglish = m.sender === "owner" && m.text_en;
  const translation = fromCustomer
    ? m.text_en && m.text_en !== m.text
      ? m.text_en
      : undefined
    : sentInEnglish
      ? m.text
      : undefined;
  return {
    id: m.id,
    from: m.sender,
    text: sentInEnglish ? m.text_en! : m.text,
    time: new Date(m.created_at).getTime(),
    mine: !fromCustomer, // owner and AI both speak for the shop
    ai: m.sender === "ai",
    translation,
    translationLabel: sentInEnglish ? "Sent to customer" : undefined,
    numberWarning:
      fromCustomer &&
      translation !== undefined &&
      !sameNumbers(m.text, translation),
  };
}

export function useOwnerThread(peerId: string, onChanged: () => void) {
  const [data, setData] = useState<{
    conversation: OwnerConversation;
    messages: OwnerMessage[];
  } | null>(null);
  const [connected, setConnected] = useState(true);

  const refresh = useCallback(() => {
    getJson<{ conversation: OwnerConversation; messages: OwnerMessage[] }>(
      `/api/owner/conversations/${peerId}`,
    )
      .then(setData)
      .catch(() => {});
    onChanged();
  }, [peerId, onChanged]);

  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => onConnection(setConnected), []);
  useRefreshTriggers(refresh);

  const messages = useMemo(() => (data?.messages ?? []).map(toChat), [data]);

  // The server translates, number-checks, sends and stores the reply, so the thread just reloads afterwards.
  const send = useCallback(
    async (text: string) => {
      const res = await fetch("/api/owner/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: peerId, text }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `Could not send (${res.status})`);
      }
      refresh();
    },
    [peerId, refresh],
  );

  // On-demand AI draft of the owner's next reply; it only fills the message box and is never sent on its own.
  const suggest = useCallback(async () => {
    const res = await fetch("/api/owner/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: peerId }),
    });
    const body = (await res.json().catch(() => null)) as { draft?: string; note?: string; error?: string } | null;
    if (!res.ok || !body?.draft) throw new Error(body?.error ?? `Could not draft a reply (${res.status})`);
    return { text: body.draft, note: body.note };
  }, [peerId]);

  const handBack = useCallback(async () => {
    await getJson(`/api/owner/conversations/${peerId}`, { method: "POST" });
    refresh();
  }, [peerId, refresh]);

  return {
    conversation: data?.conversation,
    messages,
    connected,
    send,
    suggest,
    handBack,
  };
}
