import { useEffect, useState } from "react";

/** True once the window has scrolled past `threshold` px. rAF-throttled. */
export function useScrolled(threshold = 32) {
  const [scrolled, setScrolled] = useState(() => window.scrollY > threshold);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setScrolled(window.scrollY > threshold);
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return scrolled;
}
