import { useEffect } from "react";

/**
 * Lock body scroll while a modal/overlay is open, and restore it on close.
 * Prevents the page behind a dialog from scrolling or shifting.
 */
export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);
}
