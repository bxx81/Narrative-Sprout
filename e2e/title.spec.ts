import { test, expect } from "@playwright/test";

/**
 * タイトル画面のスモークテスト。
 * fresh コンテキスト = 空 IndexedDB (API キーなし・セーブなし) が前提。
 */
test.describe("title screen", () => {
  test("shows title and primary actions", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Narrative Sprout" })).toBeVisible();
    await expect(page.getByRole("button", { name: "New Story" })).toBeVisible();
    // セーブなしの初回状態では Load の代わりに Load Sample を表示
    await expect(page.getByRole("button", { name: "Load Sample", exact: true })).toBeVisible();
  });

  test("New Story without API key goes to settings", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "New Story" }).click();
    await expect(page).toHaveURL(/\/settings$/);
  });
});
