import { useEffect, useRef, useState } from "react";

/**
 * Bounds card-grid rendering to a visible window that grows on demand.
 *
 * Renders the first `pageSize` items, then reveals more when the sentinel
 * scrolls into view (or via the returned `showMore`). Keeps per-card
 * `IntersectionObserver`s, IndexedDB reads, and DOM nodes proportional to
 * what the user actually scrolled to instead of the full save/branch count.
 */
export const useIncrementalList = (totalCount: number, pageSize = 24) => {
  const [visibleCount, setVisibleCount] = useState(() => Math.min(pageSize, totalCount));
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisibleCount((current) =>
      Math.min(Math.max(current, Math.min(pageSize, totalCount)), Math.max(totalCount, 1)),
    );
  }, [totalCount, pageSize]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || visibleCount >= totalCount) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisibleCount((current) => Math.min(current + pageSize, totalCount));
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleCount, totalCount, pageSize]);

  return {
    visibleCount: Math.min(visibleCount, Math.max(totalCount, 0)),
    sentinelRef,
    canShowMore: visibleCount < totalCount,
    showMore: () => setVisibleCount((current) => Math.min(current + pageSize, totalCount)),
  };
};
