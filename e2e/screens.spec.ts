import { test, expect } from "@playwright/test";

/**
 * Screens reachable without an API key or saves.
 * No external network is touched (no model fetch, no OAuth).
 */
test.describe("screens without credentials", () => {
  test("settings shows its heading", async ({ page }) => {
    await page.goto("/settings");

    await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  });

  test("load shows the empty state when no saves exist", async ({ page }) => {
    await page.goto("/load");

    await expect(page.getByRole("heading", { name: "Load Saved Story" })).toBeVisible();
    await expect(page.getByText("No saved games found.")).toBeVisible();
  });

  test.describe("theme setup", () => {
    test("shows the theme form", async ({ page }) => {
      await page.goto("/setup");

      await expect(page.getByText("Describe the theme of your story")).toBeVisible();
      await expect(page.getByRole("button", { name: "Start Story" })).toBeVisible();
    });

    test("Start Story without API key goes to settings", async ({ page }) => {
      await page.goto("/setup");

      await page.getByLabel("Describe the theme of your story").fill("A quiet lighthouse");
      await page.getByRole("button", { name: "Start Story" }).click();
      await expect(page).toHaveURL(/\/settings$/);
    });
  });
});
