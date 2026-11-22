import { NextResponse } from "next/server";

// The original single-shop app (/chat and /owner pages, /api/owner/*, /api/token, /api/shop, /api/order/confirm and its webhook bot)
// is retired: its pages redirect to the platform. Its endpoints stay off unless ENABLE_LEGACY_SINGLE_SHOP=1 is set on purpose.
export const legacyEnabled = (): boolean => process.env.ENABLE_LEGACY_SINGLE_SHOP === "1";

export const legacyOff = () => NextResponse.json({ error: "Not found" }, { status: 404 });
