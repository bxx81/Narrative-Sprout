import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
import type { ImageGenConfig } from "../types";
import { HuggingFaceImageGenerator } from "./huggingFaceImageGenerator";

interface MockParameter {
  label?: string;
  parameter_name?: string | null;
  parameter_has_default?: boolean;
  parameter_default?: unknown;
  component?: string;
}
interface MockEndpointInfo {
  parameters: MockParameter[];
  returns: MockParameter[];
}

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const mockState = {
  apiInfo: { named_endpoints: {} as Record<string, MockEndpointInfo> },
  includeApiInfo: true,
  predictResult: { data: [] as unknown[] },
  calls: [] as { endpoint: string | number; payload: unknown[] }[],
  viewApiCalls: 0,
};

mock.module("@gradio/client", () => ({
  Client: {
    connect: () => {
      const client: Record<string, unknown> = {
        view_api: () => {
          mockState.viewApiCalls += 1;
          return Promise.resolve(mockState.apiInfo);
        },
        config: { root: "https://space.hf.space", api_prefix: "/gradio_api" },
        predict: (endpoint: string | number, payload: unknown[]) => {
          mockState.calls.push({ endpoint, payload });
          return Promise.resolve(mockState.predictResult);
        },
      };
      if (mockState.includeApiInfo) client.api_info = mockState.apiInfo;
      return Promise.resolve(client);
    },
  },
}));

class StubFileReader {
  result: string | null = null;
  error: unknown = null;
  onloadend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readAsDataURL(blob: Blob): void {
    void blob
      .arrayBuffer()
      .then((buffer) => {
        this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString("base64")}`;
        this.onloadend?.();
      })
      .catch((error: unknown) => {
        this.error = error;
        this.onerror?.();
      });
  }
}

const originalFileReader = (globalThis as { FileReader?: unknown }).FileReader;
const originalFetch = globalThis.fetch;
let fetchUrls: string[] = [];
let fetchResponses: Record<string, () => Response> = {};

function installFetch(): void {
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const url = String(input);
    fetchUrls.push(url);
    const createResponse = fetchResponses[url];
    if (!createResponse) return Promise.resolve(new Response("not found", { status: 404 }));
    return Promise.resolve(createResponse());
  }) as typeof fetch;
}

function imageResponse(contentType = "image/png"): Response {
  return new Response(PNG_BYTES, { headers: { "content-type": contentType } });
}

function makeConfig(huggingFaceConfig: Record<string, unknown>): ImageGenConfig {
  return {
    generator: "huggingface",
    a1111Endpoint: "",
    a1111Config: "",
    comfyuiEndpoint: "",
    comfyuiWorkflow: "",
    huggingFaceConfig: JSON.stringify(huggingFaceConfig),
    huggingFaceSpaceId: "test/space",
    huggingFaceToken: null,
    nimEndpoint: "",
    nimConfig: "",
    nimToken: null,
  };
}

function generateWith(
  huggingFaceConfig: Record<string, unknown>,
  prompt = "a cat",
  negativePrompt = "",
): Promise<string> {
  const generator = new HuggingFaceImageGenerator();
  return generator.generate({
    prompt,
    negativePrompt,
    config: makeConfig(huggingFaceConfig),
    onProgress: () => {},
  });
}

describe("HuggingFaceImageGenerator", () => {
  let warnSpy: ReturnType<typeof spyOn>;

  beforeAll(() => {
    Object.defineProperty(globalThis, "FileReader", {
      value: StubFileReader,
      configurable: true,
      writable: true,
    });
  });

  afterAll(() => {
    if (originalFileReader === undefined) {
      delete (globalThis as { FileReader?: unknown }).FileReader;
    } else {
      Object.defineProperty(globalThis, "FileReader", {
        value: originalFileReader,
        configurable: true,
        writable: true,
      });
    }
  });

  beforeEach(() => {
    warnSpy = spyOn(console, "warn").mockImplementation(() => {});
    mockState.apiInfo = { named_endpoints: {} };
    mockState.includeApiInfo = true;
    mockState.predictResult = { data: [] };
    mockState.calls = [];
    mockState.viewApiCalls = 0;
    fetchUrls = [];
    fetchResponses = {};
    installFetch();
  });

  afterEach(() => {
    warnSpy.mockRestore();
    globalThis.fetch = originalFetch;
  });

  test("auto-selects the image endpoint and sends positional arguments", async () => {
    mockState.apiInfo = {
      named_endpoints: {
        "/infer": {
          parameters: [
            { label: "Prompt", parameter_name: "prompt", parameter_has_default: false },
            {
              label: "Negative prompt",
              parameter_name: "negative_prompt",
              parameter_has_default: true,
              parameter_default: "nsfw",
            },
            {
              label: "Guidance scale",
              parameter_name: "guidance_scale",
              parameter_has_default: true,
              parameter_default: 7,
            },
          ],
          returns: [{ label: "Result", component: "Image" }],
        },
      },
    };
    mockState.predictResult = {
      data: [
        {
          path: "/tmp/gradio/abc/image.webp",
          url: "/gradio_api/file=/tmp/gradio/abc/image.webp",
        },
      ],
    };
    const imageUrl = "https://space.hf.space/gradio_api/file=/tmp/gradio/abc/image.webp";
    fetchResponses[imageUrl] = () => imageResponse();

    const dataUrl = await generateWith({
      apiname: "/generate_image",
      prompt: "best quality",
      negative_prompt: "delete",
      seed: 0,
      randomize_seed: true,
      width: 1024,
      height: 1024,
      num_inference_steps: 9,
    });

    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(fetchUrls).toEqual([imageUrl]);
    expect(mockState.calls).toHaveLength(1);
    expect(mockState.calls[0].endpoint).toBe("/infer");
    expect(mockState.calls[0].payload).toEqual(["a cat, best quality", "nsfw", 7]);
    const warnings: string[] = (warnSpy.mock.calls as unknown[][]).map((call) => String(call[0]));
    expect(warnings.some((message) => message.includes('"/generate_image" was not found'))).toBe(
      true,
    );
    expect(warnings.some((message) => message.includes("ignores unsupported parameters"))).toBe(
      true,
    );
  });

  test("uses the configured endpoint when it exists without warnings", async () => {
    mockState.apiInfo = {
      named_endpoints: {
        "/generate_image": {
          parameters: [
            { parameter_name: "prompt", parameter_has_default: false },
            { parameter_name: "height", parameter_has_default: true, parameter_default: 1024 },
            { parameter_name: "width", parameter_has_default: true, parameter_default: 1024 },
            {
              parameter_name: "num_inference_steps",
              parameter_has_default: true,
              parameter_default: 9,
            },
            { parameter_name: "seed", parameter_has_default: true, parameter_default: 42 },
            {
              parameter_name: "randomize_seed",
              parameter_has_default: true,
              parameter_default: true,
            },
          ],
          returns: [
            { label: "Generated Image", component: "Image" },
            { label: "Seed Used", component: "Number" },
          ],
        },
      },
    };
    mockState.predictResult = {
      data: [{ url: "https://space.hf.space/gradio_api/file=/tmp/gradio/xyz/image.webp" }, 123],
    };
    const imageUrl = "https://space.hf.space/gradio_api/file=/tmp/gradio/xyz/image.webp";
    fetchResponses[imageUrl] = () => imageResponse();

    const dataUrl = await generateWith({
      apiname: "/generate_image",
      prompt: "best quality",
      negative_prompt: "delete",
      seed: 0,
      randomize_seed: true,
      width: 1024,
      height: 1024,
      num_inference_steps: 9,
    });

    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(mockState.calls[0].endpoint).toBe("/generate_image");
    const args = mockState.calls[0].payload;
    expect(args[0]).toBe("a cat, best quality");
    expect(args[1]).toBe(1024);
    expect(args[2]).toBe(1024);
    expect(args[3]).toBe(9);
    expect(typeof args[4]).toBe("number");
    expect(args[4]).not.toBe(0);
    expect(args[5]).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test("reads the image from the output declared by the endpoint, not the first URL", async () => {
    mockState.apiInfo = {
      named_endpoints: {
        "/infer": {
          parameters: [{ parameter_name: "prompt", parameter_has_default: false }],
          returns: [
            { label: "Info", component: "Textbox" },
            { label: "Result", component: "Image" },
          ],
        },
      },
    };
    const decoyUrl = "https://evil.example.com/decoy.png";
    const realUrl = "https://space.hf.space/gradio_api/file=/tmp/gradio/real/image.png";
    mockState.predictResult = {
      data: [{ url: decoyUrl }, { url: realUrl }],
    };
    fetchResponses[realUrl] = () => imageResponse();

    const dataUrl = await generateWith({ apiname: "/infer", prompt: "{prompt}" });

    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(fetchUrls).toEqual([realUrl]);
  });

  test("returns data image URIs without fetching", async () => {
    mockState.apiInfo = {
      named_endpoints: {
        "/infer": {
          parameters: [{ parameter_name: "prompt", parameter_has_default: false }],
          returns: [{ label: "Result", component: "Image" }],
        },
      },
    };
    mockState.predictResult = { data: ["data:image/png;base64,AAAA"] };

    const dataUrl = await generateWith({ apiname: "/infer", prompt: "{prompt}" });

    expect(dataUrl).toBe("data:image/png;base64,AAAA");
    expect(fetchUrls).toEqual([]);
  });

  test("falls back to scanning when the endpoint declares no image output", async () => {
    mockState.apiInfo = {
      named_endpoints: {
        "/infer": {
          parameters: [{ parameter_name: "prompt", parameter_has_default: false }],
          returns: [],
        },
      },
    };
    mockState.predictResult = {
      data: [[{ url: "https://space.hf.space/gradio_api/file=/tmp/gradio/nested/image.webp" }]],
    };
    const imageUrl = "https://space.hf.space/gradio_api/file=/tmp/gradio/nested/image.webp";
    fetchResponses[imageUrl] = () => imageResponse();

    const dataUrl = await generateWith({ apiname: "/infer", prompt: "{prompt}" });

    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(fetchUrls).toEqual([imageUrl]);
  });

  test("rejects when the required prompt parameter was deleted from the config", async () => {
    mockState.apiInfo = {
      named_endpoints: {
        "/infer": {
          parameters: [{ parameter_name: "prompt", parameter_has_default: false }],
          returns: [{ label: "Result", component: "Image" }],
        },
      },
    };

    await expect(generateWith({ apiname: "/infer", prompt: "delete" })).rejects.toThrow(
      /requires "prompt"/,
    );
    expect(mockState.calls).toHaveLength(0);
  });

  test("rejects when the space exposes no image endpoint", async () => {
    mockState.apiInfo = {
      named_endpoints: {
        "/describe": {
          parameters: [{ parameter_name: "prompt", parameter_has_default: false }],
          returns: [{ label: "Text", component: "Textbox" }],
        },
      },
    };

    await expect(generateWith({ apiname: "/generate_image" })).rejects.toThrow(
      /exposes no image endpoint/,
    );
  });

  test("reads the API description through view_api when api_info is absent", async () => {
    mockState.includeApiInfo = false;
    mockState.apiInfo = {
      named_endpoints: {
        "/infer": {
          parameters: [{ parameter_name: "prompt", parameter_has_default: false }],
          returns: [{ label: "Result", component: "Image" }],
        },
      },
    };
    mockState.predictResult = { data: ["data:image/png;base64,AAAA"] };

    const dataUrl = await generateWith({ apiname: "/infer", prompt: "{prompt}" });

    expect(dataUrl).toBe("data:image/png;base64,AAAA");
    expect(mockState.viewApiCalls).toBe(1);
  });

  test("rejects an HTML response served instead of an image", async () => {
    mockState.apiInfo = {
      named_endpoints: {
        "/infer": {
          parameters: [{ parameter_name: "prompt", parameter_has_default: false }],
          returns: [{ label: "Result", component: "Image" }],
        },
      },
    };
    const imageUrl = "https://space.hf.space/gradio_api/file=/tmp/gradio/error/image.png";
    mockState.predictResult = { data: [{ url: imageUrl }] };
    fetchResponses[imageUrl] = () =>
      new Response("<html>gone</html>", {
        headers: { "content-type": "text/html" },
      });

    await expect(generateWith({ apiname: "/infer", prompt: "{prompt}" })).rejects.toThrow(
      /instead of an image/,
    );
  });

  test("accepts an image served as octet-stream by sniffing the bytes", async () => {
    mockState.apiInfo = {
      named_endpoints: {
        "/infer": {
          parameters: [{ parameter_name: "prompt", parameter_has_default: false }],
          returns: [{ label: "Result", component: "Image" }],
        },
      },
    };
    const imageUrl = "https://space.hf.space/gradio_api/file=/tmp/gradio/raw/image.png";
    mockState.predictResult = { data: [{ url: imageUrl }] };
    fetchResponses[imageUrl] = () => imageResponse("application/octet-stream");

    const dataUrl = await generateWith({ apiname: "/infer", prompt: "{prompt}" });

    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });
});
