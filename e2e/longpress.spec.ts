import { test, expect, type Locator, type Page } from "@playwright/test";
import { mockChatCompletions, type MockScene } from "./helpers/mockLlm";
import { seedApiKey } from "./helpers/seed";
import { startStory } from "./helpers/story";

/**
 * Long-press copy on the game screen: the copy must be announced with a
 * toast, the trailing click of the long press must stay suppressed, and
 * the suppression must never outlive the gesture that produced it (the
 * pre-fix latch ate one ordinary click whenever the long press ended
 * without a click reaching the button — released off the button, or a
 * finger that drifted before lift-off).
 */
const FIRST_CHOICE = "Climb the lighthouse stairs";
const COPY_TOAST = "Choice copied to the input.";
const SECOND_TURN_TEXT = "E2E turn two";

const SCENES: MockScene[] = [
  {
    sceneText: "E2E turn one: rain hammers the lighthouse glass.",
    choices: ["Climb the lighthouse stairs", "Open the iron door", "Call into the dark"],
  },
  {
    sceneText: "E2E turn two: the cellar breathes cold air.",
    choices: ["Light the lantern", "Follow the draft", "Climb back up"],
  },
  {
    sceneText: "E2E turn three: dawn spills over the rocks.",
    choices: ["Wave at the boat", "Sleep", "Leave"],
  },
];

interface SceneHandle {
  chat: { callCount: () => number };
  firstChoice: ReturnType<Page["getByRole"]>;
  copyToast: ReturnType<Page["getByText"]>;
  input: ReturnType<Page["locator"]>;
}

async function reachFirstScene(page: Page): Promise<SceneHandle> {
  await seedApiKey(page);
  const chat = await mockChatCompletions(page, SCENES, { firstCallDelayMs: 500 });
  await startStory(page, "E2E lighthouse keeper");
  const firstChoice = page.getByRole("button", { name: FIRST_CHOICE });
  await expect(firstChoice).toBeVisible();
  return {
    chat,
    firstChoice,
    copyToast: page.getByText(COPY_TOAST),
    input: page.locator("#custom-choice-input"),
  };
}

/** Waits out the 2s success toast so its `pointer-events` box cannot sit on the next click. */
async function dismissCopyToast(copyToast: ReturnType<Page["getByText"]>): Promise<void> {
  await expect(copyToast).toBeVisible();
  await expect(copyToast).toBeHidden();
}

/** Holds a real touch on `target` for `holdMs`, optionally sliding before lift-off. */
async function holdTouch(
  page: Page,
  target: Locator,
  holdMs: number,
  options?: { driftX: number },
): Promise<void> {
  const box = (await target.boundingBox())!;
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  const send = (type: "touchStart" | "touchMove" | "touchEnd", x: number, y: number) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }],
    });

  await send("touchStart", centerX, centerY);
  await page.waitForTimeout(holdMs);
  if (options !== undefined) {
    await send("touchMove", options.driftX, centerY);
  }
  await send("touchEnd", centerX, centerY);
}

test.describe("long-press copy", () => {
  test("mouse: a completed copy toasts and the next click submits", async ({ page }) => {
    const { chat, firstChoice, copyToast, input } = await reachFirstScene(page);

    await firstChoice.click({ delay: 1300 });

    await expect(input).toHaveValue(FIRST_CHOICE);
    await dismissCopyToast(copyToast);
    expect(chat.callCount()).toBe(1);

    await firstChoice.click();
    await expect(page.getByText(SECOND_TURN_TEXT)).toBeVisible();
    expect(chat.callCount()).toBe(2);
  });

  test("mouse: a copy released off the button does not eat the next click", async ({ page }) => {
    const { chat, firstChoice, copyToast, input } = await reachFirstScene(page);
    const box = (await firstChoice.boundingBox())!;
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.waitForTimeout(1300);
    await page.mouse.move(box.x - 60, centerY, { steps: 5 });
    await page.mouse.up();

    await expect(input).toHaveValue(FIRST_CHOICE);
    await dismissCopyToast(copyToast);
    expect(chat.callCount()).toBe(1);

    await firstChoice.click();
    await expect(page.getByText(SECOND_TURN_TEXT)).toBeVisible();
    expect(chat.callCount()).toBe(2);
  });

  test("choice echo: a completed copy toasts without submitting", async ({ page }) => {
    const { chat, firstChoice, copyToast, input } = await reachFirstScene(page);

    await firstChoice.click();
    await expect(page.getByText(SECOND_TURN_TEXT)).toBeVisible();
    expect(chat.callCount()).toBe(2);

    const echo = page.getByText(FIRST_CHOICE, { exact: true });
    const box = (await echo.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1300);
    await page.mouse.up();

    await expect(input).toHaveValue(FIRST_CHOICE);
    await expect(copyToast).toBeVisible();
    expect(chat.callCount()).toBe(2);
  });

  test.describe("touch", () => {
    test.use({ hasTouch: true });

    // Playwright's tap() dispatches touchStart and touchEnd back to back — its
    // `delay` option is awaited before the tap, not while the finger is down —
    // so the only way to hold a touch is raw CDP input, which Chromium only.
    const CHROMIUM_ONLY = "holding a touch needs CDP input (Chromium only)";

    test("a completed copy toasts and suppresses the synthesized click", async ({
      page,
      browserName,
    }) => {
      test.skip(browserName !== "chromium", CHROMIUM_ONLY);
      const { chat, firstChoice, copyToast, input } = await reachFirstScene(page);

      await holdTouch(page, firstChoice, 1300);

      await expect(input).toHaveValue(FIRST_CHOICE);
      await dismissCopyToast(copyToast);
      expect(chat.callCount()).toBe(1);

      await firstChoice.tap();
      await expect(page.getByText(SECOND_TURN_TEXT)).toBeVisible();
      expect(chat.callCount()).toBe(2);
    });

    test("a copy followed by finger drift does not eat the next tap", async ({
      page,
      browserName,
    }) => {
      test.skip(browserName !== "chromium", CHROMIUM_ONLY);
      const { chat, firstChoice, copyToast, input } = await reachFirstScene(page);
      const box = (await firstChoice.boundingBox())!;

      await holdTouch(page, firstChoice, 1300, { driftX: box.x - 40 });

      await expect(input).toHaveValue(FIRST_CHOICE);
      await dismissCopyToast(copyToast);
      expect(chat.callCount()).toBe(1);

      await firstChoice.tap();
      await expect(page.getByText(SECOND_TURN_TEXT)).toBeVisible();
      expect(chat.callCount()).toBe(2);
    });
  });
});
