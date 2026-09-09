import { describe, test, expect, beforeAll, beforeEach } from "bun:test";
import { Window } from "happy-dom";
import {
  applyColorScheme,
  resolveIsDark,
  LIGHT_THEME_COLOR,
  DARK_THEME_COLOR,
} from "./colorScheme";

const win = new Window();

beforeAll(() => {
  Object.defineProperty(globalThis, "document", {
    value: win.document,
    configurable: true,
    writable: true,
  });
});

function seedInitialMetas(): void {
  win.document.head.innerHTML =
    `<meta name="theme-color" content="${LIGHT_THEME_COLOR}" media="(prefers-color-scheme: light)">` +
    `<meta name="theme-color" content="${DARK_THEME_COLOR}" media="(prefers-color-scheme: dark)">`;
  win.document.documentElement.className = "";
  win.document.documentElement.style.colorScheme = "";
}

beforeEach(() => {
  seedInitialMetas();
});

describe("resolveIsDark", () => {
  test("forced values ignore the OS preference", () => {
    expect(resolveIsDark("dark", false)).toBe(true);
    expect(resolveIsDark("dark", true)).toBe(true);
    expect(resolveIsDark("light", false)).toBe(false);
    expect(resolveIsDark("light", true)).toBe(false);
  });

  test("system follows the OS preference", () => {
    expect(resolveIsDark("system", false)).toBe(false);
    expect(resolveIsDark("system", true)).toBe(true);
  });
});

describe("applyColorScheme", () => {
  test("dark applies the class, color-scheme, and theme-color", () => {
    applyColorScheme(true);
    expect(win.document.documentElement.classList.contains("dark")).toBe(true);
    expect(win.document.documentElement.style.colorScheme).toBe("dark");
    const metas = win.document.querySelectorAll('meta[name="theme-color"]');
    expect(metas.length).toBe(1);
    expect(metas[0].getAttribute("content")).toBe(DARK_THEME_COLOR);
    expect(metas[0].hasAttribute("media")).toBe(false);
  });

  test("light applies the class, color-scheme, and theme-color", () => {
    applyColorScheme(false);
    expect(win.document.documentElement.classList.contains("dark")).toBe(false);
    expect(win.document.documentElement.style.colorScheme).toBe("light");
    const metas = win.document.querySelectorAll('meta[name="theme-color"]');
    expect(metas.length).toBe(1);
    expect(metas[0].getAttribute("content")).toBe(LIGHT_THEME_COLOR);
    expect(metas[0].hasAttribute("media")).toBe(false);
  });

  test("repeated application stays idempotent", () => {
    applyColorScheme(true);
    applyColorScheme(false);
    applyColorScheme(false);
    const metas = win.document.querySelectorAll('meta[name="theme-color"]');
    expect(metas.length).toBe(1);
    expect(metas[0].getAttribute("content")).toBe(LIGHT_THEME_COLOR);
  });
});
