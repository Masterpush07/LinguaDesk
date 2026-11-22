// Deterministic number checks: an AI can silently change a price, a quantity or a date, so numbers are compared in code, never trusted.
// What is checked: digits in any script (Latin, Devanagari, Tamil, Arabic-Indic...), decimals and thousands in the common written forms,
// currency amounts, English number words ("forty-two", "two hundred and fifty", "a thousand", "three lakh"), and the words one to ten in Spanish, French, German, Italian, Portuguese and Hindi.
// What is NOT checked: number words in other languages, compound words such as "veinticinco", and a digit followed by a scale word ("2 lakh").

const DIGIT = /\p{Nd}/u;

// Value of any Unicode decimal digit (Tamil, Devanagari, Arabic-Indic, fullwidth...); digits come in runs of ten.
function digitValue(ch: string): number {
  const cp = ch.codePointAt(0)!;
  let start = cp;
  while (DIGIT.test(String.fromCodePoint(start - 1))) start--;
  return (cp - start) % 10;
}

// Reads every written form of a number as plain Latin digits: "१२,५०" "12,50" "1.000,50" "10,00,000" "1 000" (no-break space) "1,000.50".
function normalise(text: string): string {
  return text
    .replace(/\p{Nd}/gu, (ch) => String(digitValue(ch)))
    .replace(/\u066b/g, ".") // Arabic decimal separator
    .replace(/\u066c/g, ",") // Arabic thousands separator
    .replace(/(\d)[\u00a0\u202f](?=\d{3}(?!\d))/g, "$1") // 1 000 (French, Russian)
    .replace(/\d{1,3}(?:\.\d{3})+,\d{1,2}(?!\d)/g, (m) => m.replace(/\./g, "").replace(",", ".")) // 1.000,50 (German, Spanish)
    .replace(/(^|[^\d.])([1-9]\d{0,2}(?:\.\d{3})+)(?![\d])/g, (_m, lead: string, n: string) => lead + n.replace(/\./g, "")) // 1.200 (German, Spanish); a price like 0.125 is left alone
    .replace(/\d{1,2}(?:,\d{2})+,\d{3}(?!\d)/g, (m) => m.replace(/,/g, "")) // 10,00,000 (Indian grouping)
    .replace(/(\d),(?=\d{3}(?!\d))/g, "$1") // 1,000
    .replace(/(\d),(?=\d{2}(?![\d,]))/g, "$1."); // 12,50 (decimal comma)
}

// Every number in the text as a normalised string, e.g. "१२ डॉलर" -> ["12"], "5.50" -> ["5.5"], "12,50 €" -> ["12.5"].
export function extractNumbers(text: string): string[] {
  return (normalise(text).match(/\d+(?:\.\d+)?/g) ?? []).map((n) => String(Number(n)));
}

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11,
  twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALES: Record<string, number> = { hundred: 100, thousand: 1000, lakh: 100_000, lakhs: 100_000, million: 1_000_000, crore: 10_000_000, crores: 10_000_000 };
const EN_WORD = new RegExp(`^(?:${[...Object.keys(UNITS), ...Object.keys(TENS), ...Object.keys(SCALES)].join("|")})$`, "i");
const EN_TOKEN = /[A-Za-z]+/g;

// English number phrases as values: "two hundred and fifty" -> 250, "a thousand" -> 1000, "twenty-one" -> 21. Two numbers side by side
// ("five six") stay two numbers. A lone "one" is soft, because it is also an article.
function englishPhrases(text: string): { hard: string[]; soft: string[] } {
  const hard: string[] = [];
  const soft: string[] = [];
  let total = 0;
  let current = 0;
  let words = 0;
  let last: "unit" | "tens" | "scale" | null = null;
  let lone = false;
  const flush = () => {
    if (words > 0) {
      if (words === 1 && lone) soft.push("1");
      else hard.push(String(total + current));
    }
    total = current = words = 0;
    last = null;
    lone = false;
  };
  // A phrase continues only across spaces, hyphens and "and"; any other word or punctuation ends it.
  let prevEnd = 0;
  for (const m of text.matchAll(EN_TOKEN)) {
    const word = m[0].toLowerCase();
    const gap = text.slice(prevEnd, m.index);
    const joined = prevEnd === 0 || /^[\s-]*$/.test(gap);
    if (!EN_WORD.test(word)) {
      if (word === "and" && joined && words > 0) {
        prevEnd = m.index + m[0].length;
        continue;
      }
      flush();
      prevEnd = m.index + m[0].length;
      continue;
    }
    if (!joined) flush();
    prevEnd = m.index + m[0].length;
    if (word in SCALES) {
      if (word === "hundred") current = (current || 1) * 100;
      else {
        total += (current || 1) * SCALES[word];
        current = 0;
      }
      last = "scale";
      words++;
      lone = false;
      continue;
    }
    const isTens = word in TENS;
    const value = isTens ? TENS[word] : UNITS[word];
    // a number word after a unit, or tens after tens, starts a new number
    if (last === "unit" || (last === "tens" && isTens)) flush();
    current += value;
    last = isTens ? "tens" : "unit";
    words++;
    lone = word === "one" && words === 1;
  }
  flush();
  return { hard, soft };
}

// One to ten in other languages. Words that are also common everyday words ("due", "sei", "neuf", "acht", Hindi "दो") are left out, because a false hit would block a good answer.
const FOREIGN_WORDS: Record<string, number> = {
  cero: 0, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  deux: 2, trois: 3, quatre: 4, cinq: 5, sept: 7, huit: 8, dix: 10,
  zwei: 2, drei: 3, vier: 4, "fünf": 5, sechs: 6, sieben: 7, neun: 9, zehn: 10,
  tre: 3, quattro: 4, cinque: 5, sette: 7, otto: 8, nove: 9, dieci: 10,
  dois: 2, "três": 3, quatro: 4, sete: 7, oito: 8, dez: 10,
  "तीन": 3, "चार": 4, "पांच": 5, "पाँच": 5, "छह": 6, "सात": 7, "आठ": 8, "नौ": 9, "दस": 10,
};
// "one" in other languages is also an article ("un", "ein", "una"), so it can excuse a digit 1 but is never required or checked.
const SOFT_ONE = ["un", "une", "uno", "una", "ein", "eine", "uma", "एक"];

const NOT_LETTER = "[^\\p{L}\\p{M}]";
const wordsPattern = (words: string[]) => new RegExp(`(^|${NOT_LETTER})(${[...words].sort((a, b) => b.length - a.length).join("|")})(?![\\p{L}\\p{M}])`, "giu");
const FOREIGN_RE = wordsPattern(Object.keys(FOREIGN_WORDS));
const SOFT_RE = wordsPattern(SOFT_ONE);

// Number words as digits: "hard" ones always count as a number, "soft" ones (one, un, ein...) only excuse a digit 1.
function wordNumbers(text: string): { hard: string[]; soft: string[] } {
  const { hard, soft } = englishPhrases(text);
  for (const m of text.matchAll(FOREIGN_RE)) hard.push(String(FOREIGN_WORDS[m[2].toLowerCase()]));
  for (const m of text.matchAll(SOFT_RE)) if (m) soft.push("1");
  return { hard, soft };
}

const numbersOf = (text: string) => {
  const words = wordNumbers(text);
  return { hard: [...extractNumbers(text), ...words.hard], soft: words.soft };
};

// True when every number in `need` can be matched, one to one, by something in `have`.
function covered(need: string[], have: string[]): boolean {
  const pool = [...have];
  return need.every((n) => {
    const i = pool.indexOf(n);
    if (i === -1) return false;
    pool.splice(i, 1);
    return true;
  });
}

// True when both texts carry the same numbers (order ignored). A digit and a number word mean the same ("2" and "dos"),
// a changed, added or dropped number does not, and a number written out is never allowed to vanish in translation.
export function sameNumbers(a: string, b: string): boolean {
  const x = numbersOf(a);
  const y = numbersOf(b);
  return covered(x.hard, [...y.hard, ...y.soft]) && covered(y.hard, [...x.hard, ...x.soft]);
}

// For a customer's message in any language and its English reading: every number the message shows (digits, or the number words listed above)
// must survive. The English may show more numbers, because a word in a language this file cannot read ("三", "iki") becomes a digit there.
export function numbersPreserved(original: string, translation: string): boolean {
  const x = numbersOf(original);
  const y = numbersOf(translation);
  return covered(x.hard, [...y.hard, ...y.soft]);
}

// Which numbers a translation lost or invented, for the agent to see: missing = in the original only, added = in the translation only.
export function numberDiff(original: string, translation: string): { missing: string[]; added: string[]; checked: string[] } {
  const x = numbersOf(original);
  const y = numbersOf(translation);
  const left = (need: string[], have: string[]) => {
    const pool = [...have];
    return need.filter((n) => {
      const i = pool.indexOf(n);
      if (i === -1) return true;
      pool.splice(i, 1);
      return false;
    });
  };
  const missing = left(x.hard, [...y.hard, ...y.soft]);
  const added = left(y.hard, [...x.hard, ...x.soft]);
  return { missing, added, checked: x.hard.filter((n) => !missing.includes(n)) };
}

const CURRENCY_ASCII = "usd|eur|gbp|inr|aed|jpy|aud|cad|cny|rs\\.?|rupees?|rupias?|dollars?|d[oó]lares?|euros?|pounds?|dirhams?|yen";
const CURRENCY_OTHER = "रुपये|रुपए|रुपया|डॉलर|ரூபாய்|元|円";
const CURRENCY_SYMBOL = "(?:US|A|C|NZ|HK)?\\$|[€£¥₹₩₽฿₫₺]";
const AMOUNT = "(\\d+(?:\\.\\d+)?)";
const MARK_BEFORE = `(?:${CURRENCY_SYMBOL}|(?:^|${NOT_LETTER})(?:${CURRENCY_ASCII})(?![\\p{L}])|${CURRENCY_OTHER})`;
const MARK_AFTER = `(?:${CURRENCY_SYMBOL}|(?:${CURRENCY_ASCII})(?![\\p{L}])|${CURRENCY_OTHER})`;
const AMOUNT_AFTER_MARK = new RegExp(`${MARK_BEFORE}\\s*${AMOUNT}`, "giu");
const AMOUNT_BEFORE_MARK = new RegExp(`${AMOUNT}\\s*${MARK_AFTER}`, "giu");

// Amounts written next to a currency sign, code or word ("$12", "12 USD", "रुपये 500", "12,50 €"), as normalised numbers.
export function currencyAmounts(text: string): string[] {
  const t = normalise(text);
  return [...t.matchAll(AMOUNT_AFTER_MARK), ...t.matchAll(AMOUNT_BEFORE_MARK)].map((m) => String(Number(m[1])));
}

// "5 left", "3 pieces in stock", "stock of 4": a quantity claim. Shop information only says in stock or out of stock, never how many.
const STOCK_CLAIMS = [/\b\d+\s*(?:units?|pieces?|pcs|items?)?\s+(?:left|remaining|in stock)\b/i, /\bstock\s*(?:of|is|count)?\s*:?\s*\d+/i];

// Why an AI answer must not reach a customer, or null when it is safe: every number, price and quantity in it must already be in the
// trusted sources (shop information, the customer's message, what the shop already said).
export function numberIssue(answer: string, ...sources: string[]): string | null {
  const known = new Set(
    sources.flatMap((s) => {
      const n = numbersOf(s);
      return [...n.hard, ...n.soft];
    }),
  );
  const unknown = numbersOf(answer).hard.find((n) => !known.has(n));
  if (unknown !== undefined) return `it contains the number ${unknown}, which is not in the shop information`;
  const prices = new Set(sources.flatMap(currencyAmounts));
  const wrongPrice = currencyAmounts(answer).find((n) => !prices.has(n));
  if (wrongPrice !== undefined) return `it states the price ${wrongPrice}, which is not a price in the shop information`;
  if (STOCK_CLAIMS.some((re) => re.test(normalise(answer)))) return "it states how many are in stock, which the shop information does not say";
  return null;
}

export function onlyKnownNumbers(answer: string, ...sources: string[]): boolean {
  return numberIssue(answer, ...sources) === null;
}
