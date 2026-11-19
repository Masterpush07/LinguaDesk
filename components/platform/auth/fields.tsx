"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2";
export const INPUT = `w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-500 ${FOCUS}`;
export const PRIMARY_BUTTON = `inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300 motion-reduce:transition-none ${FOCUS}`;
export const SECONDARY_BUTTON = `inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-indigo-300 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none ${FOCUS}`;

type FieldProps = {
  label: string;
  testId: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  disabled?: boolean;
  autoComplete?: string;
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
};

export function TextField({ label, testId, value, onChange, hint, disabled, autoComplete, placeholder, maxLength, required }: FieldProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-800">
        {label}
      </label>
      <input
        id={id}
        data-testid={testId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        autoComplete={autoComplete}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={INPUT}
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}

export function PasscodeField({ label, testId, value, onChange, hint, disabled, autoComplete = "current-password", placeholder }: FieldProps) {
  const id = useId();
  const [shown, setShown] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-800">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          data-testid={testId}
          type={shown ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className={`${INPUT} pr-11`}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? "Hide passcode" : "Show passcode"}
          aria-pressed={shown}
          data-testid={`${testId}-toggle`}
          className={`absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:text-slate-800 ${FOCUS}`}
        >
          {shown ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}

export function FormError({ message, testId }: { message: string; testId: string }) {
  if (!message) return null;
  return (
    <p role="alert" data-testid={testId} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </p>
  );
}
