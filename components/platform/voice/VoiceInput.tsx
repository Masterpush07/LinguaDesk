"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Mic, RotateCcw, Send, Square, X } from "lucide-react";

export type VoiceResult = { text: string; language: string | null; seconds: number };

type Props = {
  languageHint?: string; // ISO 639-1 code of the language the speaker is expected to use
  confirmLabel?: string;
  onConfirm: (result: VoiceResult) => void | Promise<void>;
  onClose: () => void;
};

type Stage = "idle" | "recording" | "transcribing" | "review" | "error";

const MAX_SECONDS = 60;
const BARS = 32;
const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

const pickMime = () => (typeof MediaRecorder === "undefined" ? "" : (MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? ""));

// Choosing the spoken language skips Whisper's automatic detection, which can confuse related languages such as Kannada and Telugu.
const SPOKEN_LANGUAGES: [code: string, name: string][] = [
  ["en", "English"], ["kn", "Kannada"], ["te", "Telugu"], ["ta", "Tamil"], ["ml", "Malayalam"], ["hi", "Hindi"], ["mr", "Marathi"],
  ["bn", "Bengali"], ["gu", "Gujarati"], ["pa", "Punjabi"], ["ur", "Urdu"], ["es", "Spanish"], ["fr", "French"], ["pt", "Portuguese"],
  ["ar", "Arabic"], ["ja", "Japanese"], ["ko", "Korean"], ["zh", "Chinese"],
];
const SPOKEN_KEY = "linguadesk.spoken-language";
const languageName = (code: string) => SPOKEN_LANGUAGES.find(([c]) => c === code)?.[1] ?? code.toUpperCase();

function SpokenLanguage({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <label htmlFor="voice-spoken-language" className="text-xs font-medium text-slate-300">
        I will speak
      </label>
      <select
        id="voice-spoken-language"
        data-testid="voice-language-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
      >
        <option value="">Detect automatically</option>
        {SPOKEN_LANGUAGES.map(([code, name]) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}

// Records from the microphone, sends the audio for transcription, then lets the speaker correct the text before it is sent.
export default function VoiceInput({ languageHint, confirmLabel = "Send", onConfirm, onClose }: Props) {
  const [stage, setStage] = useState<Stage>("idle");
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array.from({ length: BARS }, () => 0.08));
  const [text, setText] = useState("");
  const [language, setLanguage] = useState<string | null>(null);
  const [english, setEnglish] = useState<{ value: string; loading: boolean; failed: boolean; edited: boolean }>({ value: "", loading: false, failed: false, edited: false });
  const [sendAs, setSendAs] = useState<"original" | "english">("original");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  // The component only renders after a click in the browser, so reading storage here cannot mismatch server markup.
  const [spoken, setSpoken] = useState<string>(() => languageHint ?? (typeof localStorage !== "undefined" ? (localStorage.getItem(SPOKEN_KEY) ?? "") : ""));
  const chooseSpoken = (code: string) => {
    setSpoken(code);
    try {
      localStorage.setItem(SPOKEN_KEY, code);
    } catch {
      // storage unavailable: the choice just will not persist
    }
  };

  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const audioCtx = useRef<AudioContext | null>(null);
  const frame = useRef<number | null>(null);
  const startedAt = useRef(0);
  const cancelled = useRef(false);

  const cleanup = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void audioCtx.current?.close().catch(() => {});
    audioCtx.current = null;
  }, []);

  useEffect(() => {
    // Reset on every mount: React development mode unmounts and remounts once, which would otherwise leave this flag set.
    cancelled.current = false;
    return () => {
      cancelled.current = true;
      if (recorder.current?.state === "recording") recorder.current.stop();
      cleanup();
    };
  }, [cleanup]);

  const fail = (message: string) => {
    setError(message);
    setStage("error");
  };

  async function upload(blob: Blob, length: number) {
    setStage("transcribing");
    try {
      const form = new FormData();
      form.append("audio", blob, "voice");
      if (spoken) form.append("language", spoken);
      const res = await fetch("/api/voice/transcribe", { method: "POST", body: form });
      const body = (await res.json().catch(() => null)) as { text?: string; language?: string | null; english?: string | null; error?: string } | null;
      if (cancelled.current) return;
      if (!res.ok || !body?.text) return fail(body?.error ?? "The recording could not be transcribed. Please try again.");
      setText(body.text);
      setEnglish({ value: body.english ?? "", loading: false, failed: !body.english, edited: false });
      setSendAs("original");
      setLanguage(body.language ?? null);
      setSeconds(length);
      setStage("review");
    } catch {
      if (!cancelled.current) fail("The connection was interrupted. Please check your network and try again.");
    }
  }

  async function start() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      return fail("This browser does not support voice recording. Please type your message instead.");
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      stream.current = media;
      const mime = pickMime();
      const rec = new MediaRecorder(media, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
      rec.onstop = () => {
        const length = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
        const blob = new Blob(chunks.current, { type: rec.mimeType || mime || "audio/webm" });
        cleanup();
        if (!cancelled.current) void upload(blob, length);
      };

      // Live level meter from the real microphone signal.
      const ctx = new AudioContext();
      audioCtx.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      ctx.createMediaStreamSource(media).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const draw = () => {
        analyser.getByteFrequencyData(data);
        const step = Math.max(1, Math.floor(data.length / BARS));
        setLevels(Array.from({ length: BARS }, (_, i) => Math.max(0.08, (data[i * step] ?? 0) / 255)));
        const elapsed = Math.round((Date.now() - startedAt.current) / 1000);
        setSeconds(elapsed);
        if (elapsed >= MAX_SECONDS && rec.state === "recording") rec.stop();
        else frame.current = requestAnimationFrame(draw);
      };

      startedAt.current = Date.now();
      rec.start();
      recorder.current = rec;
      setSeconds(0);
      setStage("recording");
      frame.current = requestAnimationFrame(draw);
    } catch (err) {
      cleanup();
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        // "denied" means the user (or a saved site setting) refused; otherwise the prompt was dismissed or the page policy blocked it.
        const state = await navigator.permissions?.query({ name: "microphone" as PermissionName }).then((p) => p.state).catch(() => "unknown");
        fail(
          state === "denied"
            ? "Microphone access is blocked for this site. Select the lock icon in the address bar, allow the microphone, then reload the page."
            : "The browser did not grant microphone access. Reload the page and select Allow when it asks, or type your message instead.",
        );
      } else {
        fail(name === "NotFoundError" ? "No microphone was found. Connect a microphone or type your message instead." : "The microphone could not be started. Please check that no other app is using it, or type your message instead.");
      }
    }
  }

  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  function discard() {
    cancelled.current = true;
    if (recorder.current?.state === "recording") recorder.current.stop();
    cleanup();
    onClose();
  }

  const translateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keeps the English text in step with the corrected transcript, unless the speaker has edited the English themselves.
  function onTranscriptChange(value: string) {
    setText(value);
    if (translateTimer.current) clearTimeout(translateTimer.current);
    if (english.edited) return;
    if (!value.trim()) return setEnglish({ value: "", loading: false, failed: false, edited: false });
    if (language === "en") return setEnglish({ value, loading: false, failed: false, edited: false });
    setEnglish((e) => ({ ...e, loading: true, failed: false }));
    translateTimer.current = setTimeout(() => {
      fetch("/api/voice/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: value }) })
        .then((r) => r.json().then((b: { english?: string }) => (r.ok && b.english ? b.english : null)))
        .then((en) => setEnglish((e) => (e.edited ? e : { value: en ?? "", loading: false, failed: !en, edited: false })))
        .catch(() => setEnglish((e) => (e.edited ? e : { value: "", loading: false, failed: true, edited: false })));
    }, 900);
  }

  // Editing the English means the speaker wants that version sent.
  function onEnglishChange(value: string) {
    if (translateTimer.current) clearTimeout(translateTimer.current);
    setEnglish({ value, loading: false, failed: false, edited: true });
    setSendAs("english");
  }

  async function confirm() {
    const useEnglish = sendAs === "english" && language !== "en" && english.value.trim() !== "";
    const final = (useEnglish ? english.value : text).trim();
    if (!final || sending) return;
    setSending(true);
    try {
      await onConfirm({ text: final, language: useEnglish ? "en" : language, seconds });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The message could not be sent. Please try again.");
      setSending(false);
    }
  }

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <section
      aria-label="Voice message"
      data-testid="voice-input"
      onKeyDown={(e) => e.key === "Escape" && discard()}
      className="rounded-2xl bg-[#0F172A] p-4 text-slate-100 ring-1 ring-slate-700"
    >
      {(stage === "idle" || stage === "recording") && (
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={stage === "recording" ? stop : () => void start()}
            aria-label={stage === "recording" ? "Stop recording" : "Start recording"}
            data-testid="voice-record-btn"
            className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition hover:bg-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F172A]"
          >
            {stage === "recording" && <span className="absolute inset-0 animate-ping rounded-full bg-red-500/40 motion-reduce:animate-none" />}
            {stage === "recording" ? <Square className="relative h-5 w-5 fill-current" /> : <Mic className="relative h-6 w-6" />}
          </button>
          <div className="min-w-0 flex-1">
            <svg viewBox={`0 0 ${BARS * 6} 40`} className="h-10 w-full" aria-hidden="true" data-testid="voice-waveform">
              {levels.map((l, i) => {
                const h = Math.max(3, l * 38);
                return <rect key={i} x={i * 6 + 1} y={(40 - h) / 2} width="3.5" height={h} rx="1.75" fill={stage === "recording" ? "#22D3EE" : "#475569"} />;
              })}
            </svg>
            <p className="mt-1 text-xs text-slate-400" role="status" data-testid="voice-status">
              {stage === "recording" ? (
                <>
                  <span className="font-mono text-red-300">{mmss}</span> Recording. Select stop when you have finished (maximum {MAX_SECONDS} seconds).
                </>
              ) : (
                "Choose the language you will speak, select the microphone and speak. You can review and edit the text before it is sent."
              )}
            </p>
            {stage === "idle" && <SpokenLanguage value={spoken} onChange={chooseSpoken} />}
          </div>
          <button type="button" onClick={discard} aria-label="Close voice message" data-testid="voice-close-btn" className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {stage === "transcribing" && (
        <div className="flex items-center gap-3 py-2" role="status" data-testid="voice-transcribing">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-cyan-400 motion-reduce:animate-none" />
          <p className="text-sm text-slate-300">Transcribing your recording…</p>
        </div>
      )}

      {stage === "review" && (
        <div className="space-y-3" data-testid="voice-review">
          <label htmlFor="voice-transcript" className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Transcript{language ? ` (detected: ${languageName(language)})` : ""}. Correct any mistakes, especially numbers.
          </label>
          {!spoken && language && (
            <p className="text-xs text-amber-300" data-testid="voice-wrong-language">
              Wrong language? Select Record again, choose the language you speak, and record once more.
            </p>
          )}
          <textarea
            id="voice-transcript"
            data-testid="voice-transcript"
            rows={3}
            value={text}
            maxLength={1000}
            onChange={(e) => onTranscriptChange(e.target.value)}
            dir="auto"
            className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          />
          {language !== "en" && (
            <div data-testid="voice-english" className="space-y-2 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-2.5">
              <label htmlFor="voice-english-text" className="block text-[11px] font-semibold uppercase tracking-wide text-cyan-300">
                English translation. You can edit it.
              </label>
              <textarea
                id="voice-english-text"
                data-testid="voice-english-text"
                rows={2}
                value={english.loading ? "" : english.value}
                placeholder={english.loading ? "Translating…" : english.failed ? "The English translation is unavailable. You can type the English yourself." : ""}
                maxLength={1000}
                onChange={(e) => onEnglishChange(e.target.value)}
                className="w-full resize-none rounded-lg border border-cyan-500/30 bg-slate-900 p-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              />
              <fieldset className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-200">
                <legend className="sr-only">Which version should be sent?</legend>
                <span className="text-slate-400">Send:</span>
                <label className="inline-flex items-center gap-1.5">
                  <input type="radio" name="voice-send-as" value="original" checked={sendAs === "original"} onChange={() => setSendAs("original")} data-testid="voice-send-original" className="accent-cyan-400" />
                  The transcript above{language ? ` (${languageName(language)})` : ""}
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input type="radio" name="voice-send-as" value="english" checked={sendAs === "english"} onChange={() => setSendAs("english")} disabled={!english.value.trim()} data-testid="voice-send-english" className="accent-cyan-400" />
                  The English translation
                </label>
              </fieldset>
            </div>
          )}
          {error && (
            <p role="alert" className="text-xs text-red-300">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => { setError(""); setStage("idle"); }} data-testid="voice-rerecord-btn" className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
              <RotateCcw className="h-3.5 w-3.5" /> Record again
            </button>
            <div className="ml-auto flex gap-2">
              <button type="button" onClick={discard} data-testid="voice-discard-btn" className="rounded-full px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
                Discard
              </button>
              <button type="button" onClick={() => void confirm()} disabled={!text.trim() || sending} data-testid="voice-send-btn" className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-50">
                {sending ? <Check className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />} {sending ? "Sending…" : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {stage === "error" && (
        <div className="space-y-3" data-testid="voice-error">
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setError(""); setStage("idle"); }} data-testid="voice-retry-btn" className="rounded-full bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
              Try again
            </button>
            <button type="button" onClick={discard} data-testid="voice-dismiss-btn" className="rounded-full px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
              Close
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
