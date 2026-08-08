import { useLayoutEffect } from "react";
import { useLocation } from "react-router";

/**
 * Resets the window scroll position to the top whenever the route changes.
 * Mounted in a layout route that wraps every page, so navigating between
 * boards / concepts / settings always lands at the top instead of keeping
 * the previous page's scroll depth.
 *
 * Must run before paint (useLayoutEffect): navigating from a scrolled page
 * (e.g. clicking "Sign up" lower down on the landing page) otherwise paints
 * the new page at the old scroll offset first — the centered card appears
 * lower on screen and then jumps up, which reads as a display-time jitter.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
