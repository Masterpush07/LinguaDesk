"use client";

import { FOCUS } from "@/components/platform/seller/styles";
import { LANGUAGE_NAMES, languageName } from "@/lib/v2/seller-types";

// Toggle chips for choosing languages. `locked` codes (for example English) are always on.
export function LanguagePicker({
  value,
  onChange,
  idPrefix,
  locked = [],
  label,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  idPrefix: string;
  locked?: string[];
  label: string;
}) {
  const codes = Array.from(new Set([...Object.keys(LANGUAGE_NAMES), ...value]));
  const toggle = (code: string) => {
    if (locked.includes(code)) return;
    onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);
  };
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {codes.map((code) => {
        const on = value.includes(code) || locked.includes(code);
        return (
          <button
            key={code}
            type="button"
            role="checkbox"
            aria-checked={on}
            aria-disabled={locked.includes(code) || undefined}
            onClick={() => toggle(code)}
            data-testid={`${idPrefix}-language-${code}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition motion-reduce:transition-none ${on ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50"} ${FOCUS}`}
          >
            {languageName(code)}
          </button>
        );
      })}
    </div>
  );
}
