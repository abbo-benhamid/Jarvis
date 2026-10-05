"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { THEME_STORAGE_KEY, type ThemeChoice } from "./theme";

function currentTheme(): ThemeChoice {
  const t = document.documentElement.getAttribute("data-theme");
  if (t === "light" || t === "dark") return t;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Bascule de thème Clair / Sombre (§ 12). Sans choix, le thème suit le système.
 * Le choix est mémorisé dans le navigateur (localStorage) et posé sur <html data-theme>.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<ThemeChoice | null>(null);

  useEffect(() => {
    setTheme(currentTheme());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setTheme(currentTheme());
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const choose = (t: ThemeChoice) => {
    document.documentElement.setAttribute("data-theme", t);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, t);
    } catch {
      // Stockage bloqué (navigation privée) : le choix vaut pour la page seulement.
    }
    setTheme(t);
  };

  const options: { value: ThemeChoice; label: string; icon: React.ReactNode }[] = [
    { value: "light", label: "Clair", icon: <Sun aria-hidden="true" strokeWidth={1.6} /> },
    { value: "dark", label: "Sombre", icon: <Moon aria-hidden="true" strokeWidth={1.6} /> },
  ];

  return (
    <div role="group" aria-label="Thème d'affichage" className={cn("inline-flex gap-0.5 rounded-full bg-surface p-1 shadow-card", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={theme === o.value}
          onClick={() => choose(o.value)}
          className={cn(
            "inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full px-4 text-[15px] font-semibold [&_svg]:size-[18px]",
            theme === o.value ? "bg-fg text-bg" : "bg-transparent text-muted hover:text-fg",
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
