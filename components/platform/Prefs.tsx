"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { formatPrice } from "@/lib/platform/data";
import type { Currency, LangCode } from "@/lib/platform/types";

type Prefs = {
  language: LangCode;
  setLanguage: (l: LangCode) => void;
  currency: Currency;
  setCurrency: (c: Currency) => void;
};

const PrefsContext = createContext<Prefs | null>(null);
const KEY = "linguadesk.prefs";

// Language and currency chosen in the header. Defaults render on the server; saved values load after mount.
export function PrefsProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<LangCode>("en");
  const [currency, setCurrency] = useState<Currency>("USD");

  // Saved values load after mount so the server-rendered markup always matches the first client render.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<{ language: LangCode; currency: Currency }> | null;
      /* eslint-disable react-hooks/set-state-in-effect */
      if (saved?.language) setLanguage(saved.language);
      if (saved?.currency) setCurrency(saved.currency);
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch {
      // storage unavailable: keep the defaults
    }
  }, []);

  const value = useMemo<Prefs>(
    () => ({
      language,
      currency,
      setLanguage: (l) => {
        setLanguage(l);
        try {
          localStorage.setItem(KEY, JSON.stringify({ language: l, currency }));
        } catch {}
      },
      setCurrency: (c) => {
        setCurrency(c);
        try {
          localStorage.setItem(KEY, JSON.stringify({ language, currency: c }));
        } catch {}
      },
    }),
    [language, currency],
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): Prefs {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs must be used inside PrefsProvider");
  return ctx;
}

// Shows a USD price in the currency picked in the header.
export function Price({ usd, className }: { usd: number; className?: string }) {
  const { currency } = usePrefs();
  return (
    <span className={className} data-testid="price">
      {formatPrice(usd, currency)}
    </span>
  );
}
