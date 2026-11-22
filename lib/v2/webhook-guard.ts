// Small guards shared by the webhook route and both bots.
import type { WebhookEvent } from "@/lib/bot";

export const MAX_WEBHOOK_BYTES = 512 * 1024;
export const AI_DEADLINE_MS = 25_000;

// Rejects after ms so a slow AI cannot hold a buyer's message until the platform kills the function.
export function withDeadline<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} took longer than ${ms} ms`)), ms);
  });
  return Promise.race([work, limit]).finally(() => clearTimeout(timer));
}

// Only what the handlers rely on is checked: other event types and message kinds must still be acknowledged.
export function isWebhookEvent(value: unknown): value is WebhookEvent {
  if (!value || typeof value !== "object") return false;
  const e = value as { type?: unknown; id?: unknown; data?: unknown };
  if (typeof e.type !== "string") return false;
  if (e.type !== "message:send") return true;
  return typeof e.id === "string" && e.id !== "" && Array.isArray(e.data);
}

export const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));
