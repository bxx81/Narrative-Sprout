import { test, expect, type Page } from "@playwright/test";
import { seedGame, seedGames } from "./helpers/seed";
import { waitForRouteTransition } from "./helpers/story";

const CARD_SELECTOR = "main ul > li";

async function cardCount(page: Page): Promise<number> {
  return page.locator(CARD_SELECTOR).count();
}

async function growListTo(page: Page, minimum: number): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const count = await cardCount(page);
    if (count >= minimum) return;

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const grewByScrolling = await expect
      .poll(() => cardCount(page), { timeout: 1500 })
      .toBeGreaterThan(count)
      .then(() => true)
      .catch(() => false);
    if (grewByScrolling) continue;

    await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll("button")).find(
        (candidate) => candidate.textContent?.trim() === "Show more",
      );
      button?.click();
    });
    await expect.poll(() => cardCount(page), { timeout: 1500 }).toBeGreaterThan(count);
  }
  throw new Error(`the card grid did not grow to ${minimum} cards`);
}

async function expectScrollRestored(page: Page, expectedScrollTop: number): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeLessThanOrEqual(expectedScrollTop + 4);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThanOrEqual(expectedScrollTop - 4);
}

async function openSettingsAndGoBack(page: Page, expectedPath: RegExp): Promise<void> {
  const expectedScrollTop = await page.evaluate(() => window.scrollY);
  expect(expectedScrollTop).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await waitForRouteTransition(page);

  await page.goBack();
  await expect(page).toHaveURL(expectedPath);
  await waitForRouteTransition(page);
  await expectScrollRestored(page, expectedScrollTop);
}

test.describe("incremental card grids keep their depth across browser-back", () => {
  test("load screen restores the grown grid and scroll offset", async ({ page }) => {
    await seedGames(
      page,
      Array.from({ length: 80 }, (_, index) => ({
        gameId: `e2e-scroll-save-${index}`,
        title: `E2E Scroll Save ${index}`,
        leaves: [],
      })),
    );

    await page.goto("/load");
    await expect(page.getByRole("heading", { name: "Load Saved Story" })).toBeVisible();
    await expect.poll(() => cardCount(page)).toBeGreaterThan(0);
    await growListTo(page, 48);

    await page.evaluate(() => window.scrollTo(0, 1200));
    await openSettingsAndGoBack(page, /\/load$/);

    expect(await cardCount(page)).toBeGreaterThanOrEqual(48);
  });

  test("history screen restores the grown grid and scroll offset", async ({ page }) => {
    await seedGame(page, {
      gameId: "e2e-scroll-history",
      title: "E2E Scroll History",
      leaves: Array.from({ length: 80 }, (_, index) => ({
        nodeId: `e2e-scroll-history-leaf-${index}`,
        choiceText: `Scroll choice ${index}`,
        sceneText: `Scroll scene ${index}`,
      })),
    });

    await page.goto("/load");
    await page.getByRole("button", { name: "History", exact: true }).click();
    await expect(page).toHaveURL(/\/history$/);
    await waitForRouteTransition(page);
    await growListTo(page, 48);

    await page.evaluate(() => window.scrollTo(0, 1200));
    await openSettingsAndGoBack(page, /\/history$/);

    expect(await cardCount(page)).toBeGreaterThanOrEqual(48);
  });
});
