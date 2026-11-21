import { randomInt } from "crypto";
import { db } from "@/lib/db";
import { hashPasscode } from "@/lib/v2/crypto";

// Server-only. The recovery code is shown to the owner once; only a hash of its normalized form is stored.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const GROUPS = 3;
const GROUP_LENGTH = 4;

export function generateRecoveryCode(): string {
  const group = () => Array.from({ length: GROUP_LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return Array.from({ length: GROUPS }, group).join("-");
}

export const normalizeRecoveryCode = (input: string): string => input.toUpperCase().replace(/[\s-]+/g, "");

// Compared against when the account or its code does not exist, so every failure takes about the same time.
export const DUMMY_HASH = "00000000000000000000000000000000:0000000000000000000000000000000000000000000000000000000000000000";

// Replaces the owner's recovery code and returns the new one in its display format.
export async function issueRecoveryCode(staffId: string): Promise<string> {
  const code = generateRecoveryCode();
  const hash = await hashPasscode(normalizeRecoveryCode(code));
  await db()`UPDATE staff SET recovery_hash = ${hash} WHERE id = ${staffId}`;
  return code;
}
