import { useCallback, useEffect, useState } from "react";
import {
  getDesktopFullscreen,
  isTauri,
  onDesktopResize,
  setDesktopFullscreen,
} from "../features/desktop/api";

/**
 * Fullscreen state + toggle.
 * Web: browser fullscreen API. Tauri: native window state (the WebView has
 * no reliable fullscreen-change event, so native resizes re-sync state).
 */
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!isTauri) {
      setIsFullscreen(typeof document !== "undefined" && !!document.fullscreenElement);
      const handleChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
      };
      document.addEventListener("fullscreenchange", handleChange);
      return () => document.removeEventListener("fullscreenchange", handleChange);
    }

    let unlistenNative: (() => void) | undefined;
    let cancelled = false;
    const syncFromNative = () => {
      void getDesktopFullscreen()
        .then((fullscreen) => {
          if (!cancelled) setIsFullscreen(fullscreen);
        })
        .catch(() => undefined);
    };
    syncFromNative();
    void onDesktopResize(syncFromNative)
      .then((unlisten) => {
        if (cancelled) unlisten();
        else unlistenNative = unlisten;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      unlistenNative?.();
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (isTauri) {
      const fullscreen = await getDesktopFullscreen();
      await setDesktopFullscreen(!fullscreen);
      setIsFullscreen(!fullscreen);
    } else if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  }, []);

  return { isFullscreen, toggleFullscreen };
}
