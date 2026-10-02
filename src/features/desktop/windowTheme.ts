import type { Theme } from "@tauri-apps/api/window";
import { isTauri } from "./detectEnvironment";

/**
 * Applies the effective UI theme to the native window so the OS title bar
 * follows the `colorScheme` setting (the PWA equivalent is the `theme-color`
 * meta, which native window decorations ignore).
 *
 * `null` means "follow the OS": Tauri propagates the window theme to the
 * WebView's `prefers-color-scheme`, so passing a forced `"light"`/`"dark"`
 * here also flips the media query. That feedback is why a `system` choice
 * must pass `null` rather than a value derived from the (already overridden)
 * media query — `null` resets the WebView to the real OS preference and lets
 * the caller's `change` listener settle on it.
 *
 * No-op outside Tauri; the `@tauri-apps/api` import stays dynamic so it never
 * reaches the web bundle.
 */
export async function setDesktopWindowTheme(theme: Theme | null): Promise<void> {
  if (!isTauri) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().setTheme(theme);
}
