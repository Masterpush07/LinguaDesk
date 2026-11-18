"use client";

import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const subscribe = (callback: () => void) => {
  listeners.add(callback);
  return () => void listeners.delete(callback);
};
// The <html> class is the single source of truth; a small script in the layout sets it before first paint.
const currentTheme = () =>
  document.documentElement.classList.contains("dark") ? "dark" : "light";

// Light/dark switch. The choice is saved in localStorage; without one, the OS preference decides.
export default function ThemeToggle({
  className = "",
}: {
  className?: string;
}) {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => "light");

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("theme", next);
    } catch {
      // storage blocked (private mode): the choice just will not persist
    }
    listeners.forEach((callback) => callback());
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
      }
      className={`flex h-9 w-9 items-center justify-center rounded-full text-ink-2 transition hover:bg-surface-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 ${className}`}
    >
      {theme === "dark" ? (
        <svg
          viewBox="0 0 24 24"
          className="h-[18px] w-[18px]"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          className="h-[18px] w-[18px]"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
