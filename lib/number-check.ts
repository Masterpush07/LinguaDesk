// Deterministic number checks: AI translations can silently change a price or date, so numbers are compared in code.

const DIGIT = /\p{Nd}/u;

// Value of any Unicode decimal digit (Tamil, Devanagari, Arabic-Indic, fullwidth...); digits come in runs of ten.
function digitValue(ch: string): number {
  const cp = ch.codePointAt(0)!;
  let start = cp;
  while (DIGIT.test(String.fromCodePoint(start - 1))) start--;
  return (cp - start) % 10;
}

// Every number in the text as a normalised string, e.g. "१२ डॉलर" -> ["12"], "5.50" -> ["5.5"].
export function extractNumbers(text: string): string[] {
  const latin = text
    .replace(/\p{Nd}/gu, (ch) => String(digitValue(ch)))
    .replace(/\u066b/g, ".") // Arabic decimal separator
    .replace(/[\u066c,](?=\d{3}(?!\d))/g, ""); // thousands separators: 1,000 -> 1000
  return (latin.match(/\d+(?:\.\d+)?/g) ?? []).map((n) => String(Number(n)));
}

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11,
  twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const NUMBER_WORD = new RegExp(
  `\\b(?:(${Object.keys(TENS).join("|")})(?:[-\\s]+(one|two|three|four|five|six|seven|eight|nine))?|(${Object.keys(UNITS).join("|")}))\\b`,
  "gi",
);

// English number words as digits, e.g. "two lamps" -> ["2"], "twenty-five" -> ["25"].
// Words are only ever used to excuse a digit ("two" and "2" mean the same); they are never required to appear.
function numberWords(text: string): string[] {
  return [...text.matchAll(NUMBER_WORD)].map((m) =>
    m[1] ? String(TENS[m[1].toLowerCase()] + (m[2] ? UNITS[m[2].toLowerCase()] : 0)) : String(UNITS[m[3].toLowerCase()]),
  );
}

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

// True when both texts carry the same numbers (order ignored). Digits must match exactly, so a changed price is caught;
// an English number word on one side ("two") counts as the digit on the other side ("2").
export function sameNumbers(a: string, b: string): boolean {
  const aDigits = extractNumbers(a);
  const bDigits = extractNumbers(b);
  return covered(aDigits, [...bDigits, ...numberWords(b)]) && covered(bDigits, [...aDigits, ...numberWords(a)]);
}

// True when every number in the answer already appears in one of the trusted sources (digits, or the same number as an English word).
export function onlyKnownNumbers(
  answer: string,
  ...sources: string[]
): boolean {
  const known = new Set(sources.flatMap((s) => [...extractNumbers(s), ...numberWords(s)]));
  return extractNumbers(answer).every((n) => known.has(n));
}
