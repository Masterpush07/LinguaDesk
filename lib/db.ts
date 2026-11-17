import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// Created on first use, not at import time, so builds without DATABASE_URL still succeed.
let client: NeonQueryFunction<false, false> | null = null;

export function db() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("Missing env var DATABASE_URL");
    client = neon(url);
  }
  return client;
}
