import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration (PoC).
 *
 * - `bun run dev` (Vite) を webServer として起動する。dev 起動なら
 *   BrowserRouter の SPA フォールバックと PWA 無効化がそのまま使える。
 * - 各テストは fresh なブラウザコンテキスト = 空の IndexedDB から始まる
 *   ため、初回起動状態 (API キーなし・セーブなし) が前提になる。
 * - 外部 API (OpenAI/OpenRouter/Drive) を叩くテストは書かないこと。
 *   必要になったら `page.route()` でモックする。
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "bun run dev -- --port=5173 --strictPort --host=127.0.0.1",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  // Chromium が主力 (Chrome/Edge/Tauri WebView2 をカバー)。
  // WebKit は iOS Safari 系のエンジンレベル差分用。Firefox は対象外。
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
