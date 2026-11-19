"use client";

import { Check } from "lucide-react";
import { LANGS } from "@/lib/platform/data";
import type { LangCode } from "@/lib/platform/types";

const ALL = Object.keys(LANGS) as LangCode[];

// English is always on: the shop team works in English.
export function LanguagePicker({ value, onChange, disabled, idPrefix }: { value: string[]; onChange: (next: string[]) => void; disabled?: boolean; idPrefix: string }) {
  const toggle = (code: string) => onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);
  return (
    <fieldset disabled={disabled}>
      <legend className="mb-1 text-sm font-medium text-slate-800">Languages you can serve</legend>
      <p className="mb-2 text-xs text-slate-500">English is always included.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid={`${idPrefix}-languages`}>
        {ALL.map((code) => {
          const checked = code === "en" || value.includes(code);
          return (
            <label
              key={code}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-500 ${
                checked ? "border-indigo-300 bg-indigo-50 text-indigo-800" : "border-slate-200 bg-white text-slate-700"
              } ${code === "en" || disabled ? "cursor-default" : "hover:border-slate-300"}`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                disabled={code === "en"}
                onChange={() => toggle(code)}
                data-testid={`${idPrefix}-language-${code}`}
              />
              <span
                aria-hidden="true"
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white"}`}
              >
                {checked && <Check className="h-3 w-3" />}
              </span>
              <span className="truncate">{LANGS[code].name}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
