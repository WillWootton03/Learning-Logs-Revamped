import { useEffect } from "react";
import { useLocation } from "react-router";

/**
 * Resets the window scroll position to the top whenever the route changes.
 * Mounted in a layout route that wraps every page, so navigating between
 * boards / concepts / settings always lands at the top instead of keeping
 * the previous page's scroll depth.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
