import { test, expect } from "@playwright/test";
import { mockChatCompletions } from "./helpers/mockLlm";
import { seedApiKey } from "./helpers/seed";

/**
 * The core journey with a mocked narrator: title → theme setup →
 * starting screen → turn 1 → choice → turn 2. Image generation stays
 * disabled (the default), so the only network the app makes is the
 * intercepted chat-completions endpoint.
 */
test.describe("main playthrough", () => {
  test("two turns complete end to end", async ({ page }) => {
    await seedApiKey(page);
    const chat = await mockChatCompletions(
      page,
      [
        {
          sceneText: "E2E turn one: rain hammers the lighthouse glass.",
          choices: ["Climb the lighthouse stairs", "Open the iron door", "Call into the dark"],
        },
        {
          sceneText: "E2E turn two: the cellar breathes cold air.",
          choices: ["Light the lantern", "Follow the draft", "Climb back up"],
        },
      ],
      { firstCallDelayMs: 500 },
    );

    await page.goto("/");
    await page.getByRole("button", { name: "New Story" }).click();
    await expect(page).toHaveURL(/\/setup$/);

    await page.getByLabel("Describe the theme of your story").fill("E2E lighthouse keeper");
    await page.getByRole("button", { name: "Start Story" }).click();

    // First generation passes through the starting screen.
    await expect(page).toHaveURL(/\/setup\/starting$/);
    await expect(page).toHaveURL(/\/play$/);
    await expect(page.getByText("This 1st turn")).toBeVisible();
    await expect(page.getByText("E2E turn one")).toBeVisible();
    await expect(page.getByRole("button", { name: "Climb the lighthouse stairs" })).toBeVisible();
    expect(chat.callCount()).toBe(1);

    // Choosing submits the second generation and shows turn 2.
    await page.getByRole("button", { name: "Climb the lighthouse stairs" }).click();
    await expect(page.getByText("This 2nd turn")).toBeVisible();
    await expect(page.getByText("E2E turn two")).toBeVisible();
    await expect(page.getByRole("button", { name: "Light the lantern" })).toBeVisible();
    expect(chat.callCount()).toBe(2);
  });
});
