import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { slugify } from "@/lib/v2/crypto";
import { requireStaff } from "@/lib/v2/guard";
import { Check, fail, invalidBody, readJson } from "@/lib/v2/seller-api";
import type { SettingsDto } from "@/lib/v2/seller-types";

const TONES = ["formal", "neutral", "friendly"] as const;
const POLICY_KEYS = ["returns", "payment", "customOrders", "discounts", "giftWrap", "care"] as const;
const POLICY_LABELS: Record<(typeof POLICY_KEYS)[number], string> = {
  returns: "Returns policy",
  payment: "Payment information",
  customOrders: "Custom orders policy",
  discounts: "Discounts policy",
  giftWrap: "Gift wrapping policy",
  care: "Care instructions",
};

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

async function load(sellerId: string): Promise<SettingsDto | null> {
  const [s] = await db()`SELECT slug, shop_name, agent_name, tagline, about, country, languages, hours, tone, response_target_min, shipping, policies
    FROM sellers WHERE id = ${sellerId}`;
  if (!s) return null;
  const ship = (s.shipping ?? {}) as Record<string, unknown>;
  const pol = (s.policies ?? {}) as Record<string, unknown>;
  return {
    name: s.shop_name,
    agentName: s.agent_name ?? "",
    tagline: s.tagline,
    about: s.about,
    country: s.country,
    languages: s.languages,
    hours: s.hours,
    tone: TONES.includes(s.tone) ? s.tone : "neutral",
    responseTargetMin: s.response_target_min,
    shipping: {
      freeAbove: num(ship.freeAbove),
      fee: num(ship.fee),
      worldwideDays: str(ship.worldwideDays),
      domesticDays: str(ship.domesticDays),
      notes: str(ship.notes),
    },
    policies: {
      returns: str(pol.returns),
      payment: str(pol.payment),
      customOrders: str(pol.customOrders),
      discounts: str(pol.discounts),
      giftWrap: str(pol.giftWrap),
      care: str(pol.care),
    },
    slug: s.slug,
    shareUrlPath: `/s/${s.slug}`,
  };
}

export async function GET() {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const settings = await load(auth.staff.sellerId);
  return settings ? NextResponse.json(settings) : fail("Shop not found.", 404);
}

export async function PUT(req: NextRequest) {
  const auth = await requireStaff({ owner: true });
  if ("error" in auth) return auth.error;
  const body = await readJson(req);
  if (!body) return invalidBody();
  const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
  const ship = obj(body.shipping);
  const pol = obj(body.policies);

  const check = new Check();
  const name = check.text(body.name, "Shop name", 60, true);
  // Optional and only changed when sent, so a client that does not know about the field never clears the owner's choice.
  const agentName = body.agentName === undefined ? null : check.text(body.agentName, "Assistant name", 40);
  const tagline = check.text(body.tagline, "Tagline", 200);
  const about = check.text(body.about, "About", 600);
  const country = check.text(body.country, "Country", 100);
  const hours = check.text(body.hours, "Support hours", 120);
  const languages = check.languages(body.languages ?? ["en"], "Languages", true);
  const tone = check.oneOf(body.tone, "Tone", TONES);
  const responseTargetMin = check.whole(body.responseTargetMin, "Response target (minutes)", 1, 1440);
  const shipping = {
    freeAbove: check.whole(ship.freeAbove ?? 0, "Free shipping threshold", 0, 100000),
    fee: check.whole(ship.fee ?? 0, "Shipping fee", 0, 1000),
    worldwideDays: check.text(ship.worldwideDays, "Worldwide delivery time", 60),
    domesticDays: check.text(ship.domesticDays, "Home-country delivery time", 60),
    notes: check.text(ship.notes, "Shipping notes", 400),
  };
  const policies = Object.fromEntries(POLICY_KEYS.map((k) => [k, check.text(pol[k], POLICY_LABELS[k], 500)]));
  if (!check.ok) return check.response;

  const sql = db();
  const clash = await sql`SELECT 1 FROM sellers WHERE id <> ${auth.staff.sellerId} AND (lower(shop_name) = ${name.toLowerCase()} OR slug = ${slugify(name)})`;
  if (clash.length > 0) return fail("Another shop already uses this name. Choose a different shop name.", 409);

  const rows = await sql`UPDATE sellers SET shop_name = ${name}, agent_name = COALESCE(${agentName}, agent_name), tagline = ${tagline}, about = ${about}, country = ${country},
      languages = ${languages}, hours = ${hours}, tone = ${tone}, response_target_min = ${responseTargetMin},
      shipping = ${JSON.stringify(shipping)}::jsonb, policies = ${JSON.stringify(policies)}::jsonb
    WHERE id = ${auth.staff.sellerId} RETURNING id`;
  if (rows.length === 0) return fail("Shop not found.", 404);
  const saved = await load(auth.staff.sellerId);
  return NextResponse.json(saved);
}
