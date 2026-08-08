import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Incremental windowed display for long lists.
 *
 * The caller owns the full dataset (fetched once); this hook only gates DOM
 * output. It renders the first `pageSize` items and, as the scroll sentinel
 * reaches the viewport, appends the next slice. The remaining items stay out
 * of the DOM entirely until they are scrolled toward, and items you scroll
 * far past remain mounted — the trade-off that keeps scroll position stable.
 *
 * Progress is kept per `key` (e.g. the board id), so navigating between
 * boards starts each list at the initial slice while a list you already
 * scrolled through keeps its place.
 */
export function useIncrementalList<T>(items: T[], pageSize: number, key?: string) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // Items rendered so far per list key. An absent key means the initial slice.
  const [counts, setCounts] = useState<Record<string, number>>({});
  const count = key ? counts[key] ?? pageSize : pageSize;
  const hasMore = count < items.length;

  const loadMore = useCallback(() => {
    if (!key) return;
    setCounts((prev) => ({ ...prev, [key]: (prev[key] ?? pageSize) + pageSize }));
  }, [key, pageSize]);

  useEffect(() => {
    if (!key || !hasMore) return;
    let ticking = false;

    const check = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const sentinel = sentinelRef.current;
        if (!sentinel) return;
        const rect = sentinel.getBoundingClientRect();
        if (rect.top <= window.innerHeight) loadMore();
      });
    };

    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    // Fill the viewport once when the slice changes. The effect re-runs after
    // every bump (count is a dependency), and each re-run checks the sentinel
    // once, so slices chain in only until the sentinel is out of view — i.e.
    // until the screen is filled — then it takes a real scroll to load more.
    check();
    return () => {
      ticking = false;
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [key, hasMore, count, loadMore]);

  return {
    visible: items.slice(0, count),
    hasMore,
    sentinelRef,
  };
}
