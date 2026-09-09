import { test, expect } from "@playwright/test";
import { countRecords, seedGame } from "./helpers/seed";

/**
 * Destructive flows, each on a fresh context with seeded IndexedDB data
 * (no LLM, no external network). Confirmations use the app's own
 * `<dialog>`; buttons are scoped to it to avoid clashing with card menus.
 */
test.describe("save slot deletion", () => {
  test("deleting the only save empties the load screen", async ({ page }) => {
    await seedGame(page, {
      gameId: "e2e-delete-save",
      title: "E2E Doomed Tale",
      leaves: [{ nodeId: "e2e-delete-save-leaf", choiceText: "Go left", sceneText: "Left path." }],
    });

    await page.goto("/load");
    await expect(page.getByText("E2E Doomed Tale")).toBeVisible();

    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();

    await expect(page.getByText("No saved games found.")).toBeVisible();
    await expect(page.getByText("E2E Doomed Tale")).toHaveCount(0);

    // The slot is really gone: title offers no loadable game.
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Load" })).toBeDisabled();
  });
});

test.describe("branch deletion", () => {
  test("deleting one of two branches keeps the other", async ({ page }) => {
    await seedGame(page, {
      gameId: "e2e-delete-branch",
      title: "E2E Forked Tale",
      leaves: [
        { nodeId: "e2e-branch-left", choiceText: "Go left", sceneText: "Left path." },
        { nodeId: "e2e-branch-right", choiceText: "Go right", sceneText: "Right path." },
      ],
    });

    await page.goto("/load");
    await page.getByRole("button", { name: "History" }).click();
    await expect(page.getByRole("heading", { name: "Story Endings" })).toBeVisible();
    await expect(page.getByText("Go left")).toBeVisible();
    await expect(page.getByText("Go right")).toBeVisible();

    const leftCard = page.locator("li", { hasText: "Go left" });
    await leftCard.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();

    await expect(page.locator("li", { hasText: "Go left" })).toHaveCount(0);
    await expect(page.getByText("Go right")).toBeVisible();
    await expect(page).toHaveURL(/\/history$/);
  });

  test("deleting the last branch removes the whole game", async ({ page }) => {
    await seedGame(page, {
      gameId: "e2e-delete-last-branch",
      title: "E2E Last Branch",
      leaves: [
        { nodeId: "e2e-last-left", choiceText: "Go left", sceneText: "Left path." },
        { nodeId: "e2e-last-right", choiceText: "Go right", sceneText: "Right path." },
      ],
    });

    await page.goto("/load");
    await page.getByRole("button", { name: "History" }).click();
    await expect(page.getByRole("heading", { name: "Story Endings" })).toBeVisible();

    for (const choice of ["Go left", "Go right"]) {
      await page
        .locator("li", { hasText: choice })
        .getByRole("button", {
          name: "Delete",
          exact: true,
        })
        .click();
      await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
    }

    // The game itself is gone, so the app falls back to the load screen.
    await expect(page).toHaveURL(/\/load$/);
    await expect(page.getByText("No saved games found.")).toBeVisible();
    expect(await countRecords(page)).toEqual({ games: 0, nodes: 0 });
  });
});

test.describe("full data wipe", () => {
  test("wipe deletes everything and shows the completion screen", async ({ page }) => {
    await seedGame(page, {
      gameId: "e2e-wipe",
      title: "E2E Wiped Tale",
      leaves: [{ nodeId: "e2e-wipe-leaf", choiceText: "Go left", sceneText: "Left path." }],
    });

    await page.goto("/settings");
    await page.getByRole("button", { name: "Delete All Data" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete Everything" }).click();

    // The store reloads with the completion flag set.
    await expect(page.getByRole("heading", { name: "Data deletion complete" })).toBeVisible();
    expect(await countRecords(page)).toEqual({ games: 0, nodes: 0 });

    await page.getByRole("button", { name: "Return to Start Screen" }).click();
    await expect(page.getByRole("heading", { name: "Narrative Sprout" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Load" })).toBeDisabled();
  });
});
