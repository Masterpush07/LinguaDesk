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

// True when both texts contain exactly the same numbers (order ignored).
export function sameNumbers(a: string, b: string): boolean {
  const x = extractNumbers(a).sort();
  const y = extractNumbers(b).sort();
  return x.length === y.length && x.every((n, i) => n === y[i]);
}

// True when every number in the answer already appears in one of the trusted sources.
export function onlyKnownNumbers(answer: string, ...sources: string[]): boolean {
  const known = new Set(sources.flatMap(extractNumbers));
  return extractNumbers(answer).every((n) => known.has(n));
}
