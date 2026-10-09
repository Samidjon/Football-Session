"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "dark" | "light";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("motm-theme");
      const initial: Theme = saved === "light" ? "light" : "dark";
      document.documentElement.dataset.theme = initial;
      setTheme(initial);
    } catch {
      document.documentElement.dataset.theme = "dark";
    }
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      window.localStorage.setItem("motm-theme", next);
    } catch {
      // The theme still changes for the current page if storage is unavailable.
    }
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      title={theme === "dark" ? "Light theme" : "Dark theme"}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-700 text-zinc-200 transition hover:bg-zinc-800"
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
