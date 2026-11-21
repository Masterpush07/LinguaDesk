import type { Agent, Currency, Lang, LangCode } from "@/lib/platform/types";

// Shared display helpers. Shop, product, conversation and order data now comes from the database, never from this file.

export const LANGS: Record<LangCode, Lang> = {
  en: { code: "en", name: "English", native: "English", flag: "🇬🇧" },
  es: { code: "es", name: "Spanish", native: "Español", flag: "🇪🇸" },
  ja: { code: "ja", name: "Japanese", native: "日本語", flag: "🇯🇵" },
  hi: { code: "hi", name: "Hindi", native: "हिन्दी", flag: "🇮🇳" },
  ar: { code: "ar", name: "Arabic", native: "العربية", flag: "🇸🇦", rtl: true },
  fr: { code: "fr", name: "French", native: "Français", flag: "🇫🇷" },
  ta: { code: "ta", name: "Tamil", native: "தமிழ்", flag: "🇮🇳" },
  pt: { code: "pt", name: "Portuguese", native: "Português", flag: "🇧🇷" },
  ko: { code: "ko", name: "Korean", native: "한국어", flag: "🇰🇷" },
  zh: { code: "zh", name: "Chinese", native: "中文", flag: "🇨🇳" },
};

export const MARKETPLACE_BANNER =
  "https://images.pexels.com/photos/17565491/pexels-photo-17565491.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

// Characters used only by the scripted walkthrough on /demo.
export const AGENTS: Agent[] = [
  {
    id: "amina",
    name: "Amina El-Sayed",
    role: "Senior Multilingual Support Lead",
    languages: ["ar", "fr", "en"],
    skills: ["Refunds", "Escalations", "Custom orders"],
    avatar: "https://images.unsplash.com/photo-1766066014237-00645c74e9c6?crop=entropy&cs=srgb&fm=jpg&q=85",
    rating: 4.98,
    status: "online",
    load: 3,
    capacity: 5,
    email: "",
  },
  {
    id: "kenji",
    name: "Kenji Takahashi",
    role: "AI Verification Specialist",
    languages: ["ja", "zh", "en"],
    skills: ["Translation review", "Product questions"],
    avatar: "https://images.unsplash.com/photo-1714079761488-e0c9b9ac4138?crop=entropy&cs=srgb&fm=jpg&q=85",
    rating: 4.95,
    status: "busy",
    load: 5,
    capacity: 5,
    email: "",
  },
  {
    id: "priya",
    name: "Priya Sharma",
    role: "Global Merchant Operations",
    languages: ["hi", "ta", "es", "en"],
    skills: ["Order tracking", "Shipping", "Payments"],
    avatar: "https://images.unsplash.com/photo-1626863905121-3b0c0ed7b94c?crop=entropy&cs=srgb&fm=jpg&q=85",
    rating: 4.99,
    status: "online",
    load: 2,
    capacity: 6,
    email: "",
  },
];

export const getAgent = (id?: string) => AGENTS.find((a) => a.id === id);

export const CURRENCIES: { code: Currency; symbol: string; label: string }[] = [
  { code: "USD", symbol: "$", label: "US dollar" },
  { code: "INR", symbol: "₹", label: "Indian rupee" },
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "GBP", symbol: "£", label: "British pound" },
  { code: "JPY", symbol: "¥", label: "Japanese yen" },
  { code: "AED", symbol: "AED ", label: "UAE dirham" },
  { code: "AUD", symbol: "A$", label: "Australian dollar" },
  { code: "CAD", symbol: "C$", label: "Canadian dollar" },
];

// Used until live rates load, and when the rate service cannot be reached. Orders are always charged in US dollars.
export const FALLBACK_RATES: Record<Currency, number> = { USD: 1, INR: 92.9, EUR: 0.91, GBP: 0.76, JPY: 159, AED: 3.67, AUD: 1.5, CAD: 1.43 };
const SYMBOLS = Object.fromEntries(CURRENCIES.map((c) => [c.code, c.symbol])) as Record<Currency, string>;

export function formatPrice(usd: number, currency: Currency = "USD", rates?: Partial<Record<string, number>>): string {
  const rate = (currency === "USD" ? 1 : rates?.[currency]) ?? FALLBACK_RATES[currency];
  const value = usd * rate;
  const digits = currency === "JPY" || currency === "INR" ? 0 : 2;
  return `${SYMBOLS[currency]}${value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
