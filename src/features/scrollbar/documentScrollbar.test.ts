import { beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";

const happyDomWindow = new Window();

beforeAll(() => {
  Object.defineProperty(globalThis, "document", {
    value: happyDomWindow.document,
    configurable: true,
    writable: true,
  });
});

interface DocumentScrollbarOptions {
  scrollbars: {
    theme: string | null;
    autoHide: string;
    autoHideSuspend: boolean;
    dragScroll: boolean;
    clickScroll: boolean;
  };
}

const clickScrollPlugin = { name: "ClickScrollPlugin" };

const mockState = {
  pluginRegistrations: [] as unknown[],
  initializations: [] as { target: unknown; options: DocumentScrollbarOptions }[],
  destroyCalls: 0,
};

mock.module("overlayscrollbars", () => ({
  ClickScrollPlugin: clickScrollPlugin,
  OverlayScrollbars: Object.assign(
    (target: unknown, options: DocumentScrollbarOptions) => {
      mockState.initializations.push({ target, options });
      return {
        destroy: () => {
          mockState.destroyCalls += 1;
        },
      };
    },
    {
      plugin: (plugin: unknown) => {
        mockState.pluginRegistrations.push(plugin);
      },
    },
  ),
}));

const { initializeDocumentScrollbar } = await import("./documentScrollbar");

describe("initializeDocumentScrollbar", () => {
  beforeEach(() => {
    mockState.initializations.length = 0;
    mockState.destroyCalls = 0;
  });

  test("registers ClickScrollPlugin once at module load (required for clickScroll)", () => {
    expect(mockState.pluginRegistrations).toEqual([clickScrollPlugin]);
  });

  test("initializes the body with hover reveal, drag and click scrolling, CSS theming", () => {
    initializeDocumentScrollbar();
    expect(mockState.initializations).toHaveLength(1);
    const initialization = mockState.initializations[0]!;
    expect(initialization.target).toBe(document.body);
    expect(initialization.options.scrollbars).toEqual({
      theme: null,
      autoHide: "leave",
      autoHideSuspend: true,
      dragScroll: true,
      clickScroll: true,
    });
  });

  test("returns the cleanup that destroys the instance", () => {
    const destroy = initializeDocumentScrollbar();
    destroy();
    expect(mockState.destroyCalls).toBe(1);
  });
});
