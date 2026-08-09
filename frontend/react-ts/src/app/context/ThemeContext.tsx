import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from "react";

type Theme = "dark" | "light";

type ThemeContextType = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
  /**
   * Temporarily force the effective theme (e.g. to follow the browser's color
   * scheme on the public landing/demo pages). Pass null to fall back to the
   * saved preference.
   */
  setOverride: (t: Theme | null) => void;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem("theme") as Theme) ?? "dark";
  });
  const [override, setOverride] = useState<Theme | null>(null);

  const effective = override ?? theme;

  // Apply the theme before paint so pages never flash the wrong scheme.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", effective === "dark");
  }, [effective]);

  // The saved preference is only written when the user explicitly changes it —
  // never on mount, so visiting the public pages (which follow the browser
  // theme) can't pin a theme the user never chose.
  function setTheme(t: Theme) {
    setThemeState(t);
    localStorage.setItem("theme", t);
  }

  function toggle() {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("theme", next);
      return next;
    });
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle, setOverride }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
