import { BCP47 } from "@/components/platform/DualBubble";

// Read-aloud for chat messages. The device's own voice is used when it has one for the language (instant, free).
// Otherwise the server turns the message into speech (see /api/buyer/threads/[id]/speak) and the browser plays it.

export type ListenState = "idle" | "loading" | "playing" | "error";

type Current = { stop: () => void; onState: (s: ListenState, message?: string) => void };
let current: Current | null = null;

export function stopListening() {
  const c = current;
  current = null;
  if (!c) return;
  c.stop();
  c.onState("idle");
}

// Voices load a moment after the page opens, so an empty list is given a short chance to fill.
async function hasLocalVoice(code: string): Promise<SpeechSynthesisVoice | null> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const base = code.split("-")[0].toLowerCase();
  const find = () => window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().split(/[-_]/)[0] === base) ?? null;
  let voice = find();
  if (!voice && window.speechSynthesis.getVoices().length === 0) {
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      window.speechSynthesis.addEventListener("voiceschanged", done, { once: true });
      setTimeout(done, 600);
    });
    voice = find();
  }
  return voice;
}

type Options = {
  threadPath: string; // /api/buyer/threads/<id>
  messageId: string;
  variant: "shown" | "english";
  text: string;
  lang: string | null; // a language code such as "ta"; null when unknown, which skips the device voice
  onState: (state: ListenState, message?: string) => void;
};

export async function listen({ threadPath, messageId, variant, text, lang, onState }: Options) {
  stopListening();
  let cancelled = false;
  let stopAudio: () => void = () => undefined;
  current = {
    stop: () => {
      cancelled = true;
      stopAudio();
    },
    onState,
  };
  const mine = current;
  const finish = (state: ListenState, message?: string) => {
    if (current === mine) current = null;
    onState(state, message);
  };

  const code = BCP47[lang ?? ""] ?? "en-US";
  const voice = lang ? await hasLocalVoice(code) : null;
  if (cancelled) return;
  if (voice) {
    const ok = await new Promise<boolean>((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice;
      u.lang = voice.lang;
      u.onend = () => resolve(true);
      u.onerror = (e) => resolve(e.error === "canceled" || e.error === "interrupted");
      stopAudio = () => window.speechSynthesis.cancel();
      onState("playing");
      window.speechSynthesis.speak(u);
    });
    if (cancelled) return;
    if (ok) return finish("idle");
    // The device voice failed: fall through to the server voice.
  }

  onState("loading");
  try {
    const res = await fetch(`${threadPath}/speak`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId, variant }) });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "Read-aloud is not available right now.");
    }
    const url = URL.createObjectURL(await res.blob());
    if (cancelled) return URL.revokeObjectURL(url);
    const audio = new Audio(url);
    stopAudio = () => {
      audio.pause();
      URL.revokeObjectURL(url);
    };
    audio.onended = () => {
      URL.revokeObjectURL(url);
      finish("idle");
    };
    audio.onerror = () => finish("error", "The audio could not be played.");
    await audio.play();
    if (!cancelled) onState("playing");
  } catch (err) {
    if (!cancelled) finish("error", err instanceof Error ? err.message : "Read-aloud is not available right now.");
  }
}
