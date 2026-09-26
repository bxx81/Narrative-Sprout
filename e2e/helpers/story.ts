import { expect, type Page } from "@playwright/test";

/**
 * Drives the new-story flow (title → theme form → starting screen → first
 * scene) without touching credentials or saves itself: `seedApiKey` and
 * `mockChatCompletions` must already be in place.
 *
 * The caller's first mocked completion should be delayed
 * (`firstCallDelayMs`), otherwise the transient `/setup/starting` URL
 * below cannot be observed reliably.
 */
export async function startStory(page: Page, theme: string): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "New Story" }).click();
  await expect(page).toHaveURL(/\/setup$/);

  await page.getByLabel("Describe the theme of your story").fill(theme);
  await page.getByRole("button", { name: "Start Story" }).click();

  // First generation passes through the starting screen.
  await expect(page).toHaveURL(/\/setup\/starting$/);
  await expect(page).toHaveURL(/\/play$/);
}
