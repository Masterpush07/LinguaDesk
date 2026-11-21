"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { CURRENCIES, formatPrice } from "@/lib/platform/data";
import type { Currency, LangCode } from "@/lib/platform/types";

type Rates = Record<string, number>;

type Prefs = {
  language: LangCode;
  setLanguage: (l: LangCode) => void;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  rates: Rates | undefined; // live reference rates per US dollar once loaded; undefined means the built-in table is used
};

const PrefsContext = createContext<Prefs | null>(null);
const KEY = "linguadesk.prefs";
const CURRENCY_CODES = CURRENCIES.map((c) => c.code);

// Language and currency chosen in the header. Defaults render on the server; saved values load after mount.
export function PrefsProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<LangCode>("en");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [rates, setRates] = useState<Rates | undefined>(undefined);

  // Saved values load after mount so the server-rendered markup always matches the first client render.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<{ language: LangCode; currency: Currency }> | null;
      /* eslint-disable react-hooks/set-state-in-effect */
      if (saved?.language) setLanguage(saved.language);
      if (saved?.currency && CURRENCY_CODES.includes(saved.currency)) setCurrency(saved.currency);
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch {
      // storage unavailable: keep the defaults
    }
  }, []);

  // Reference rates load once, after the first paint. If the request fails the built-in table stays in use.
  useEffect(() => {
    let alive = true;
    const timer = window.setTimeout(() => {
      fetch("/api/public/fx")
        .then((res) => (res.ok ? (res.json() as Promise<{ rates?: Rates }>) : null))
        .then((body) => alive && body?.rates && setRates(body.rates))
        .catch(() => undefined);
    }, 0);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, []);

  const value = useMemo<Prefs>(
    () => ({
      language,
      currency,
      rates,
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
    [language, currency, rates],
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
  const { currency, rates } = usePrefs();
  return (
    <span className={className} data-testid="price">
      {formatPrice(usd, currency, rates)}
    </span>
  );
}

// Explains converted prices. Renders nothing while US dollars are selected.
export function CurrencyNote({ className = "", testId = "currency-note" }: { className?: string; testId?: string }) {
  const { currency } = usePrefs();
  if (currency === "USD") return null;
  return (
    <p className={`text-xs text-slate-500 ${className}`} data-testid={testId}>
      Shown in {currency} at a reference rate. The shop charges in US dollars.
    </p>
  );
}

