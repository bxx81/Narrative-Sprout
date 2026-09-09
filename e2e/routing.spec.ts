import { test, expect } from "@playwright/test";

/**
 * Route guards with a fresh context (no active game in memory).
 */
test.describe("route guards", () => {
  for (const path of ["/play", "/history", "/chronicle"]) {
    test(`${path} without an active game redirects to title`, async ({ page }) => {
      await page.goto(path);

      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole("heading", { name: "Narrative Sprout" })).toBeVisible();
    });
  }

  test("unknown path falls back to title", async ({ page }) => {
    await page.goto("/does-not-exist");

    await expect(page.getByRole("heading", { name: "Narrative Sprout" })).toBeVisible();
  });
});
