import { useLayoutEffect } from "react";
import { useTheme } from "../context/ThemeContext";

/**
 * Makes the current page follow the browser's `prefers-color-scheme` instead
 * of the user's saved app theme. Used on the public landing and demo pages so
 * visitors see the theme that matches their OS/browser. When the page unmounts
 * the saved preference is restored.
 */
export function SystemTheme() {
  const { setOverride } = useTheme();

  useLayoutEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => setOverride(mq.matches ? "dark" : "light");
    apply();
    mq.addEventListener("change", apply);
    return () => {
      mq.removeEventListener("change", apply);
      setOverride(null);
    };
  }, [setOverride]);

  return null;
}
