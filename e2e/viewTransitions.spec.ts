import { test, expect } from "@playwright/test";
import { mockChatCompletions } from "./helpers/mockLlm";
import { seedApiKey } from "./helpers/seed";
import { startStory } from "./helpers/story";

/**
 * Guards the Chromium-gated ViewTransition wiring: React only activates a
 * boundary inside a transition, so these poll for the live
 * ::view-transition pseudo-element animation of the boundary. The fill mode
 * is asserted too — without `both` the old snapshot reverts to opacity 1
 * when the animation ends and flashes the previous screen back in.
 *
 * On engines without the gate (WebKit/Firefox) the boundary never renders,
 * so no such animation exists and only the non-animated path is asserted.
 */
const hasViewTransitionAnimation = (
  page: import("@playwright/test").Page,
  animationName: string,
  pseudoElementPart: string,
) =>
  page.evaluate(
    ([name, pseudoPart]) => {
      const getAnimationsWithSubtree = (
        document.getAnimations as (options?: { subtree?: boolean }) => Animation[]
      ).bind(document);
      return getAnimationsWithSubtree({ subtree: true }).some((animation) => {
        const effect = animation.effect as
          ({ pseudoElement?: string } & { getTiming?: () => { fill?: string } }) | null | undefined;
        const pseudoElement = effect?.pseudoElement;
        return (
          (animation as CSSAnimation).animationName === name &&
          typeof pseudoElement === "string" &&
          pseudoElement.includes(pseudoPart) &&
          effect?.getTiming?.().fill === "both"
        );
      });
    },
    [animationName, pseudoElementPart] as const,
  );

test.describe("view transition animations", () => {
  test("route change cross-fades on Chromium engines", async ({ page, browserName }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    if (browserName !== "chromium") {
      await expect(page).toHaveURL(/\/settings$/);
      return;
    }
    await expect
      .poll(() => hasViewTransitionAnimation(page, "fadeOut", "view-transition-old"), {
        timeout: 3000,
      })
      .toBe(true);
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
    await expect
      .poll(() => hasViewTransitionAnimation(page, "zoomOverlayEnter", "view-transition-new"), {
        timeout: 3000,
      })
      .toBe(true);

    await page.keyboard.press("Escape");
    await expect(zoomOverlay).toHaveCount(0);
  });
});
