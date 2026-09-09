import type { ColorScheme } from "../../types/settings";

/** Theme-color meta values (match the initial `index.html` entries). */
export const LIGHT_THEME_COLOR = "#fbf9fa";
export const DARK_THEME_COLOR = "#030712";

/**
 * Resolves whether dark mode applies for a `colorScheme` setting value.
 * `system` follows the OS preference; `light`/`dark` force the choice.
 */
export function resolveIsDark(colorScheme: ColorScheme, systemPrefersDark: boolean): boolean {
  if (colorScheme === "dark") return true;
  if (colorScheme === "light") return false;
  return systemPrefersDark;
}

/**
 * Applies the effective theme to the document: the `.dark` class (consumed
 * by the Tailwind `@custom-variant` in `index.css`), `color-scheme` for
 * native controls, and the `theme-color` meta (used by the browser chrome).
 *
 * The initial `index.html` ships two `media=`-qualified `theme-color`
 * metas for the OS-following default. A forced `light`/`dark` choice can no
 * longer rely on media evaluation, so extras are collapsed into a single
 * media-less meta whose `content` tracks the effective theme.
 */
export function applyColorScheme(isDark: boolean): void {
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  metas.forEach((meta, index) => {
    if (index > 0) {
      meta.remove();
      return;
    }
    meta.removeAttribute("media");
    meta.setAttribute("content", isDark ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);
  });
}
