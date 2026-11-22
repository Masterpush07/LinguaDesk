// Country is free text on the way in. This gives every shop one spelling, so "IN", "india" and "India " all become "India".
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

// Informal names that the standard list does not contain, as people type them.
const INFORMAL: readonly (readonly [string, string])[] = [
  ["usa", "US"], ["u.s.a.", "US"], ["u.s.", "US"], ["united states of america", "US"], ["america", "US"],
  ["uk", "GB"], ["u.k.", "GB"], ["great britain", "GB"],
  ["uae", "AE"], ["u.a.e.", "AE"], ["ivory coast", "CI"], ["czech republic", "CZ"], ["turkey", "TR"], ["burma", "MM"], ["holland", "NL"],
];

const fold = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function nameOf(code: string): string | null {
  const name = regionNames.of(code);
  return name && name !== code && name !== "Unknown Region" ? name : null;
}

let byFolded: Map<string, string> | null = null;
function table(): Map<string, string> {
  if (byFolded) return byFolded;
  byFolded = new Map();
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      const name = nameOf(code);
      if (name) byFolded.set(fold(name), code);
    }
  }
  for (const [alias, code] of INFORMAL) byFolded.set(fold(alias), code);
  return byFolded;
}

export function normalizeCountry(raw: string): string {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (/^[A-Za-z]{2}$/.test(text)) {
    const name = nameOf(text.toUpperCase());
    if (name) return name;
  }
  const code = table().get(fold(text));
  return (code && nameOf(code)) || text; // a country nobody recognises is kept as typed
}

// Every lower-case spelling stored for this country, so a filter also finds rows saved before the names were normalised.
export function countryAliases(country: string): string[] {
  const name = normalizeCountry(country);
  if (!name) return [];
  const code = table().get(fold(name));
  const spellings = new Set([name.toLowerCase()]);
  if (code) {
    spellings.add(code.toLowerCase());
    for (const [alias, c] of INFORMAL) if (c === code) spellings.add(alias);
  }
  return [...spellings];
}
