import { describe, test, expect, beforeAll, afterEach, afterAll } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import StoryCard from "./StoryCard";
import { LOAD_SCREEN_FALLBACK_URL } from "./game/imageFallbacks";

// A node whose stored asset fails to decode must degrade to the same
// "Image Not Available" placeholder as a node with no asset at all.

describe("StoryCard image fallback", () => {
  let root: Root | null = null;
  let container: HTMLElement | null = null;

  beforeAll(() => {
    const win = new Window();
    for (const key of ["window", "document", "navigator"] as const) {
      Object.defineProperty(globalThis, key, {
        value: key === "document" ? win.document : key === "window" ? win : win.navigator,
        configurable: true,
        writable: true,
      });
    }
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
    container?.remove();
    container = null;
  });

  afterAll(() => {
    root?.unmount();
    root = null;
  });

  test("an image error swaps in the not-available placeholder", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    const current = container;
    await act(async () => {
      root = createRoot(current);
      root.render(
        <StoryCard
          imageUrl="blob:http://localhost/dead-beef"
          imageAlt="a lighthouse"
          isLoadingImage={false}
          mainText="Chapter one"
          subText="The storm rolled in."
        />,
      );
    });

    const image = current.querySelector("img");
    expect(image).not.toBeNull();
    expect(image!.getAttribute("src")).toBe("blob:http://localhost/dead-beef");

    await act(async () => {
      image!.dispatchEvent(new window.Event("error", { bubbles: true }));
    });

    expect(image!.getAttribute("src")).toBe(LOAD_SCREEN_FALLBACK_URL);
  });
});
