"use client";

import { useEffect, useState } from "react";

// Throwaway test page: two tabs connect as guests and message each other to prove the Nexconn pipeline works.

type Listener = (line: string) => void;
const listeners = new Set<Listener>();
const emit = (line: string) => listeners.forEach((l) => l(line));

let myUserId = "";
let boot: Promise<string> | null = null;

// Module-level promise so React StrictMode's double effect cannot initialise the SDK twice.
function bootNexconn(): Promise<string> {
  boot ??= (async () => {
    const { NCEngine, AreaCode, ConnectionStatusHandler, MessageHandler } = await import("@nexconn/chat");

    const res = await fetch("/api/token", { method: "POST" });
    if (!res.ok) throw new Error("Token request failed");
    const { token } = (await res.json()) as { userId: string; token: string };

    NCEngine.initialize({ appKey: process.env.NEXT_PUBLIC_NEXCONN_APP_KEY!, areaCode: AreaCode.SG });

    // Handlers are registered before connect so no early event is missed.
    NCEngine.addConnectionStatusHandler(
      "spike",
      new ConnectionStatusHandler({
        onConnectionStatusChanged({ status, code }) {
          emit(`connection: ${String(status)} (code ${code ?? "-"})`);
        },
      }),
    );
    NCEngine.addMessageHandler(
      "spike",
      new MessageHandler({
        onMessageReceived({ messages }) {
          for (const m of messages) {
            const text = (m.content as { text?: string }).text;
            emit(`from ${m.senderUserId}: ${text ?? `[${m.messageType}]`}`);
          }
        },
      }),
    );

    const connected = await NCEngine.connect({ token });
    if (!connected.isOk) throw new Error(`Connect failed, code ${connected.code}`);
    myUserId = connected.data!.userId;
    return myUserId;
  })();
  return boot;
}

export default function SpikePage() {
  const [me, setMe] = useState(myUserId);
  const [target, setTarget] = useState("");
  const [text, setText] = useState("Hello from LinguaDesk");
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    const onLine: Listener = (line) => setLog((prev) => [...prev, line]);
    listeners.add(onLine);
    bootNexconn()
      .then(setMe)
      .catch((err: Error) => onLine(`error: ${err.message}`));
    return () => {
      listeners.delete(onLine);
    };
  }, []);

  async function send() {
    const { DirectChannel, SendTextMessageParams } = await import("@nexconn/chat");
    const channel = new DirectChannel(target.trim());
    const result = await channel.sendMessage(new SendTextMessageParams({ text }));
    emit(result.isOk ? `sent to ${target}: ${text}` : `send failed, code ${result.code}`);
  }

  return (
    <main className="min-h-screen bg-white p-6 font-mono text-sm text-gray-900">
      <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-bold">Nexconn connection test</h1>
      <p>
        My user ID: <b>{me || "connecting..."}</b>
      </p>
      <input
        className="w-full rounded border border-gray-400 bg-white p-2 text-gray-900"
        placeholder="Other tab's user ID"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
      />
      <input
        className="w-full rounded border border-gray-400 bg-white p-2 text-gray-900"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-40"
        disabled={!me || !target.trim()}
        onClick={send}
      >
        Send
      </button>
      <pre className="min-h-40 whitespace-pre-wrap rounded bg-gray-100 p-3 text-gray-900">{log.join("\n")}</pre>
      </div>
    </main>
  );
}
