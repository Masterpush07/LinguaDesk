// One table for turning the language the AI reports ("Spanish") into the ISO code the rest of the app uses ("es").
// Unknown names give null: guessing from the first letters would route a Bengali buyer to a Belarusian-speaking team member.
const NAMES: Record<string, string> = {
  english: "en", spanish: "es", french: "fr", german: "de", italian: "it", portuguese: "pt", dutch: "nl", russian: "ru",
  arabic: "ar", hindi: "hi", tamil: "ta", telugu: "te", bengali: "bn", bangla: "bn", urdu: "ur", japanese: "ja", korean: "ko",
  chinese: "zh", mandarin: "zh", cantonese: "zh", thai: "th", vietnamese: "vi", indonesian: "id", turkish: "tr", polish: "pl",
  kannada: "kn", malayalam: "ml", marathi: "mr", gujarati: "gu", punjabi: "pa", nepali: "ne", sinhala: "si", sinhalese: "si",
  persian: "fa", farsi: "fa", hebrew: "he", greek: "el", ukrainian: "uk", czech: "cs", slovak: "sk", swedish: "sv", norwegian: "no",
  danish: "da", finnish: "fi", romanian: "ro", hungarian: "hu", bulgarian: "bg", serbian: "sr", croatian: "hr", swahili: "sw",
  filipino: "fil", tagalog: "tl", malay: "ms", burmese: "my", khmer: "km", amharic: "am", afrikaans: "af",
};

// Accepts an English language name or an ISO code ("es", "pt-BR"); anything else is null.
export function languageCode(language: string | null | undefined): string | null {
  if (!language) return null;
  const key = language.trim().toLowerCase();
  if (NAMES[key]) return NAMES[key];
  if (/^[a-z]{2,3}$/.test(key)) return key;
  const tagged = /^([a-z]{2,3})[-_][a-z0-9]{2,8}$/.exec(key);
  return tagged ? tagged[1] : null;
}
