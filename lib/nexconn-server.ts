import { createHash, randomBytes, randomUUID } from "crypto";

// Server-only helper: signs and sends Nexconn Platform Chat API calls. Never import it in client code.

export class NexconnApiError extends Error {
  constructor(public code: number, message: string) {
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
        throw new NexconnApiError(json.code, json.errorMessage ?? `HTTP ${res.status}`);
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
