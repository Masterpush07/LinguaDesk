import { createHash, randomBytes, randomUUID, timingSafeEqual } from "crypto";

// Server-only helper: signs and sends Nexconn Platform Chat API calls. Never import it in client code.

export class NexconnApiError extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message);
  }
}

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

// Signature = sha1(AppSecret + Nonce + Timestamp), per the Nexconn auth docs.
function signedHeaders() {
  const nonce = randomBytes(8).toString("hex"); // 16 chars, limit is 18
  const timestamp = Date.now().toString();
  const signature = createHash("sha1")
    .update(env("NEXCONN_APP_SECRET") + nonce + timestamp)
    .digest("hex");
  return {
    "App-Key": env("NEXT_PUBLIC_NEXCONN_APP_KEY"),
    Nonce: nonce,
    Timestamp: timestamp,
    Signature: signature,
    "X-Request-ID": randomUUID().replace(/-/g, ""),
    "Content-Type": "application/json",
  };
}

// Primary domain first, backup on timeout or 5xx, as the Base URL docs recommend.
function domains(): string[] {
  return [
    process.env.NEXCONN_API_PRIMARY ?? "api.sg-light-api.com",
    process.env.NEXCONN_API_BACKUP ?? "api-b.sg-light-api.com",
  ];
}

export async function nexconnPost<T>(path: string, body: unknown): Promise<T> {
  let lastError: unknown;
  for (const host of domains()) {
    try {
      const res = await fetch(`https://${host}${path}`, {
        method: "POST",
        headers: signedHeaders(), // fresh nonce/signature on every attempt
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      });
      if (res.status >= 500) throw new Error(`HTTP ${res.status} from ${host}`);
      const json = await res.json();
      if (json.code !== 0) {
        throw new NexconnApiError(
          json.code,
          json.errorMessage ?? `HTTP ${res.status}`,
        );
      }
      return json.result as T;
    } catch (err) {
      if (err instanceof NexconnApiError) throw err; // real API errors are not retried
      lastError = err;
    }
  }
  throw lastError;
}

// Registers the user (if new) and returns the access token the browser SDK connects with.
export function issueAccessToken(userId: string, name: string) {
  return nexconnPost<{ userId: string; accessToken: string }>(
    "/v4/auth/access-token/issue",
    { userId, name },
  );
}

// Sends a plain text message as fromUserId, e.g. the shop's bot answering a customer.
export function sendDirectText(
  fromUserId: string,
  toUserId: string,
  text: string,
  options: { ai?: boolean; metadata?: Record<string, string> } = {},
) {
  const metadata = { ...(options.ai ? { ai: "1" } : {}), ...options.metadata }; // ai: lets the UI label AI-written messages
  return nexconnPost<{ messageIds?: { userId: string; messageId: string }[] }>(
    "/v4/direct-channel/message/send",
    {
      fromUserId,
      toUserIds: [toUserId],
      messageType: "RC:TxtMsg",
      content: JSON.stringify({ content: text }), // wire format uses "content", the client SDK maps it to "text"
      isEchoToSender: 1, // also show it on the sender's own devices, e.g. the owner dashboard
      ...(Object.keys(metadata).length > 0 ? { hasMetadata: true, metadata } : {}),
    },
  );
}

// Webhooks carry the same sha1(secret + nonce + timestamp) signature, but in AppKey/Nonce/Timestamp/Signature headers.
export function verifyWebhook(headers: Headers): boolean {
  const nonce = headers.get("nonce");
  const timestamp = headers.get("timestamp");
  const signature = headers.get("signature");
  if (!nonce || !timestamp || !signature) return false;
  const age = Math.abs(Date.now() - Number(timestamp));
  if (!Number.isFinite(age) || age > 5 * 60 * 1000) return false; // blocks replays of old requests
  const expected = Buffer.from(
    createHash("sha1")
      .update(env("NEXCONN_APP_SECRET") + nonce + timestamp)
      .digest("hex"),
  );
  const received = Buffer.from(signature.toLowerCase());
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}
