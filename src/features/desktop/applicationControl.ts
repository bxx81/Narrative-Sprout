import { isTauri } from "./detectEnvironment";

/** Exits the desktop app (legacy StartScreen behavior). No-op on web. */
export async function exitApplication(): Promise<void> {
  if (!isTauri) return;
  const { exit } = await import("@tauri-apps/plugin-process");
  await exit(0);
}

/** Reads the native window fullscreen state. Web callers use the DOM API. */
export async function getDesktopFullscreen(): Promise<boolean> {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow().isFullscreen();
}

/** Sets the native window fullscreen state. */
export async function setDesktopFullscreen(enabled: boolean): Promise<void> {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().setFullscreen(enabled);
}

/**
 * Subscribes to native window resize events (Tauri has no reliable
 * fullscreen-change event, so resize is the sync signal — legacy App port).
 * Returns the unlisten function.
 */
export async function onDesktopResize(listener: () => void): Promise<() => void> {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow().onResized(listener);
}
