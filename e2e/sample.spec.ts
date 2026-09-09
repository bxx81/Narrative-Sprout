import { test, expect } from "@playwright/test";
import { countRecords } from "./helpers/seed";

/**
 * Bundled sample saves (`public/savedata/` + `samples.json`).
 * No IndexedDB seed, no LLM mock: the dev server serves the real ZIPs,
 * which are imported through the regular ns-save path.
 */
test.describe("sample saves", () => {
  test("Load Sample imports the bundled saves and opens the load screen", async ({
    page,
    browserName,
  }) => {
    // Sample images are persisted as Blobs in IndexedDB, which Playwright's
    // WebKit build cannot store at all (even a 10-byte Blob throws
    // UnknownError). Real Safari supports Blob storage, so this is a test-env
    // limitation, not an app bug: run this spec on chromium only.
    test.skip(browserName === "webkit", "Playwright WebKit cannot persist Blob in IndexedDB");
    await page.goto("/");
    await page.getByRole("button", { name: "Load Sample", exact: true }).click();

    await expect(page).toHaveURL(/\/load$/, { timeout: 60_000 });
    expect((await countRecords(page)).games).toBeGreaterThan(0);
  });
});
