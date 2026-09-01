import { useState, useEffect, useMemo } from "react";

const DESKTOP_BREAKPOINT = 1024;

const getWindowSize = () => {
  if (typeof window === "undefined") {
    return { width: 0, height: 0 };
  }
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
};

export const useBreakpoint = () => {
  const [windowSize, setWindowSize] = useState(getWindowSize);

  useEffect(() => {
    let frame: number | null = null;

    const handleResize = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        setWindowSize(getWindowSize());
      });
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);

  return useMemo(() => {
    const isPortrait = windowSize.height > windowSize.width;
    const isDesktopSize = windowSize.width >= DESKTOP_BREAKPOINT;

    return {
      width: windowSize.width,
      height: windowSize.height,
      isPortrait: isPortrait,
      isLandscape: !isPortrait,
      isDesktop: !isPortrait && isDesktopSize,
    };
  }, [windowSize]);
};
