import { test, expect } from "@playwright/test";
import { mockChatCompletions } from "./helpers/mockLlm";
import { seedApiKey } from "./helpers/seed";
import { startStory } from "./helpers/story";

/**
 * Guards the Chromium-gated ViewTransition wiring: React only activates a
 * boundary inside a transition, so these poll for live ::view-transition
 * pseudo-element animations. On engines without the gate (WebKit/Firefox)
 * the boundary never renders, so no such animation exists and only the
 * non-animated path is asserted there.
 */
const hasActiveViewTransition = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const getAnimationsWithSubtree = (
      document.getAnimations as (options?: { subtree?: boolean }) => Animation[]
    ).bind(document);
    return getAnimationsWithSubtree({ subtree: true }).filter((animation) => {
      const pseudoElement = (animation.effect as { pseudoElement?: string } | null | undefined)
        ?.pseudoElement;
      return pseudoElement?.includes("::view-transition") ?? false;
    });
  });

test.describe("view transition animations", () => {
  test("route change cross-fades on Chromium engines", async ({ page, browserName }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    if (browserName !== "chromium") {
      await expect(page).toHaveURL(/\/settings$/);
      return;
    }
    await expect.poll(() => hasActiveViewTransition(page), { timeout: 3000 }).not.toHaveLength(0);
    await expect(page).toHaveURL(/\/settings$/);
  });

  test("zoom overlay enters with a view transition on Chromium engines", async ({
    page,
    browserName,
  }) => {
    await seedApiKey(page);
    await mockChatCompletions(
      page,
      [
        {
          sceneText: "E2E turn one: rain hammers the lighthouse glass.",
          choices: ["Climb the lighthouse stairs", "Open the iron door", "Call into the dark"],
        },
      ],
      { firstCallDelayMs: 500 },
    );

    await startStory(page, "E2E lighthouse keeper");
    await expect(page.getByRole("button", { name: "Climb the lighthouse stairs" })).toBeVisible();

    await page.getByRole("button", { name: "Enlarge image" }).click();
    const zoomOverlay = page.getByRole("dialog");
    await expect(zoomOverlay).toBeVisible();
    if (browserName !== "chromium") {
      await page.keyboard.press("Escape");
      await expect(zoomOverlay).toHaveCount(0);
      return;
    }
    await expect.poll(() => hasActiveViewTransition(page), { timeout: 3000 }).not.toHaveLength(0);

    await page.keyboard.press("Escape");
    await expect(zoomOverlay).toHaveCount(0);
  });
});
