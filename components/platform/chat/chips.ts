import type { LangCode } from "@/lib/platform/types";

// Fixed wording for the three starter questions every shop can answer. The AI reads the buyer's language, so these are sent as written.
type Local = Record<LangCode, string>;
export type ChipKey = "price" | "ship" | "returns";

export const CHIPS: Record<ChipKey, Local> = {
  price: {
    en: "How much is it?",
    es: "¿Cuánto cuesta?",
    ja: "いくらですか？",
    hi: "इसकी कीमत कितनी है?",
    ar: "كم سعره؟",
    fr: "Combien ça coûte ?",
    ta: "இதன் விலை என்ன?",
    pt: "Quanto custa?",
    ko: "얼마예요?",
    zh: "多少钱？",
  },
  ship: {
    en: "How long does shipping take?",
    es: "¿Cuánto tarda el envío?",
    ja: "配送にはどのくらいかかりますか？",
    hi: "शिपिंग में कितना समय लगता है?",
    ar: "كم يستغرق الشحن؟",
    fr: "Quel est le délai de livraison ?",
    ta: "டெலிவரிக்கு எவ்வளவு நாட்கள் ஆகும்?",
    pt: "Quanto tempo leva o envio?",
    ko: "배송은 얼마나 걸리나요?",
    zh: "配送需要多长时间？",
  },
  returns: {
    en: "What is the return policy?",
    es: "¿Cuál es la política de devoluciones?",
    ja: "返品ポリシーを教えてください。",
    hi: "रिटर्न नीति क्या है?",
    ar: "ما هي سياسة الإرجاع؟",
    fr: "Quelle est la politique de retour ?",
    ta: "திருப்பி அனுப்பும் கொள்கை என்ன?",
    pt: "Qual é a política de devolução?",
    ko: "반품 정책이 어떻게 되나요?",
    zh: "退货政策是什么？",
  },
};

// With a product in context the name is appended, because the AI only sees the message text.
export function chipText(key: ChipKey, language: LangCode, productName: string | null): string {
  if (key === "price" && productName) return language === "en" ? `How much is ${productName}?` : `${CHIPS.price[language]} (${productName})`;
  return CHIPS[key][language];
}
