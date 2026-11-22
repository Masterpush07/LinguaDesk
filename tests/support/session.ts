import { NextRequest } from "next/server";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { jar } from "./next-headers";

// Signs a test staff member in through the real login route, so the settings route sees a real session cookie.
export async function signInAs(shop: string, name: string, passcode = "correct horse"): Promise<void> {
  jar.clear();
  const res = await loginRoute(new NextRequest("http://localhost/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-real-ip": "192.0.2.1" }, body: JSON.stringify({ shop, name, passcode }) }));
  if (res.status !== 200) throw new Error(`test sign-in failed (${res.status})`);
}
