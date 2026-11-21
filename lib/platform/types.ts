// Types for the prototype pages under app/(platform). Everything here is mock data: no backend is called.

export type LangCode = "en" | "es" | "ja" | "hi" | "ar" | "fr" | "ta" | "pt" | "ko" | "zh";
export type Currency = "USD" | "INR" | "EUR" | "GBP" | "JPY" | "AED" | "AUD" | "CAD";

export type Lang = { code: LangCode; name: string; native: string; flag: string; rtl?: boolean };

export type Seller = {
  slug: string;
  name: string;
  origin: string;
  flag: string;
  tagline: string;
  about: string;
  categories: string[];
  languages: LangCode[];
  online: boolean;
  responseTime: string;
  rating: number;
  reviews: number;
  hours: string;
  shipping: string;
  returns: string;
};

export type Product = {
  id: string;
  seller: string; // Seller.slug
  name: string;
  category: string;
  description: string;
  priceUsd: number;
  image?: string;
  colors: string[];
  stock: number;
  rating: number;
  reviews: number;
};

// One chat message. Every message keeps its original text and the translation side by side.
export type ChatSender = "customer" | "ai" | "agent" | "system";
export type Msg = {
  id: string;
  from: ChatSender;
  original_text: string;
  original_lang: LangCode;
  translated_text: string;
  target_lang: LangCode;
  is_ai_generated: boolean;
  confidence_score: number; // 0 to 1
  audio_url?: string;
  voice_seconds?: number;
  time: string;
  numbersVerified?: boolean;
};

export type Priority = "urgent" | "high" | "normal";
export type ConvStatus = "ai" | "waiting" | "assigned" | "resolved";

export type Conversation = {
  id: string;
  customerId: string;
  customerName: string;
  country: string;
  flag: string;
  lang: LangCode;
  priority: Priority;
  status: ConvStatus;
  assignedTo?: string; // Agent.id
  slaSeconds: number; // remaining until the first-response target; negative = breached
  seller: string; // Seller.slug
  productId?: string;
  orderId?: string;
  subject: string;
  summary: string;
  notes: string[];
  messages: Msg[];
};

export type Agent = {
  id: string;
  name: string;
  role: string;
  languages: LangCode[];
  skills: string[];
  avatar: string;
  rating: number;
  status: "online" | "busy" | "away";
  load: number;
  capacity: number;
  email: string;
};

export type OrderStep = { key: string; label: string; detail: string; at?: string; done: boolean };
export type Order = {
  id: string;
  customerId: string;
  customerName: string;
  seller: string;
  items: { productId: string; qty: number }[];
  shippingUsd: number;
  status: "processing" | "packed" | "shipped" | "out-for-delivery" | "delivered";
  placed: string;
  eta: string;
  courier: string;
  tracking: string;
  steps: OrderStep[];
};

export type Customer = {
  id: string;
  name: string;
  country: string;
  flag: string;
  lang: LangCode;
  orders: number;
  spentUsd: number;
  lastSeen: string;
  tags: string[];
};

export type GlossaryTerm = {
  id: string;
  term: string;
  rule: "keep" | "translate-fixed";
  note: string;
};

export type Faq = { id: string; q: string; a: string; langs: Partial<Record<LangCode, "ready" | "pending">> };
