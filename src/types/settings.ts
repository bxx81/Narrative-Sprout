import { z } from "zod";

/**
 * Global application settings (REDESIGN.md §5.4).
 *
 * Contains ONLY non-secret configuration. Anything machine-specific but
 * harmless (endpoints, model names) belongs here; anything secret belongs in
 * `src/types/credential.ts`. Generation settings are global-only — save slots
 * hold none of them.
 */
export const SETTINGS_RECORD_KEY = "app" as const;

export const imageGeneratorTypeSchema = z.enum([
  "disabled",
  "huggingface",
  "a1111",
  "comfyui",
  "nvidia_nim",
]);
export type ImageGeneratorType = z.infer<typeof imageGeneratorTypeSchema>;

export const webpCompressionSchema = z.enum(["normal", "high"]);
export type WebpCompression = z.infer<typeof webpCompressionSchema>;

export const memoryStrategySchema = z.enum(["auto", "single", "split"]);
export type MemoryStrategy = z.infer<typeof memoryStrategySchema>;

/** Default A1111 generation parameters (matches legacy `defaultA1111Config`). */
export const DEFAULT_A1111_CONFIG = JSON.stringify(
  {
    steps: 25,
    width: 1024,
    height: 1024,
    cfg_scale: 5,
    sampler_name: "DPM++ 2M",
    scheduler: "Karras",
    prompt: "masterpiece, best quality, general",
    negative_prompt: "worst quality, low quality",
  },
  null,
  2,
);

/** Default ComfyUI workflow (trimmed from legacy). */
export const DEFAULT_COMFYUI_WORKFLOW = JSON.stringify(
  {
    "3": {
      inputs: {
        seed: 1234567890,
        steps: 28,
        cfg: 8,
        sampler_name: "euler",
        scheduler: "normal",
        denoise: 1,
        model: ["4", 0],
        positive: ["6", 0],
        negative: ["7", 0],
        latent_image: ["5", 0],
      },
      class_type: "KSampler",
    },
    "4": {
      inputs: { ckpt_name: "sd_xl_base_1.0.safetensors" },
      class_type: "CheckpointLoaderSimple",
    },
    "5": {
      inputs: { width: 1024, height: 1024, batch_size: 1 },
      class_type: "EmptyLatentImage",
    },
    "6": {
      inputs: {
        text: "##prompt##, masterpiece, best quality, highres, dutch angle, general, 2020s \\(style\\)",
        clip: ["4", 1],
      },
      class_type: "CLIPTextEncode",
    },
    "7": {
      inputs: {
        text: "##negative_prompt##, worst quality, low quality, bad anatomy, twins, futanari, mask, mouth mask, masquerade mask, subtitled",
        clip: ["4", 1],
      },
      class_type: "CLIPTextEncode",
    },
    "8": {
      inputs: { samples: ["3", 0], vae: ["29", 0] },
      class_type: "VAEDecode",
    },
    "23": { inputs: { images: ["8", 0] }, class_type: "PreviewImage" },
    "29": {
      inputs: { vae_name: "sdxl_vae.safetensors" },
      class_type: "VAELoader",
    },
  },
  null,
  2,
);

export const DEFAULT_HUGGINGFACE_CONFIG = JSON.stringify(
  {
    seed: 0,
    randomize_seed: true,
    width: 1024,
    height: 1024,
    num_inference_steps: 9,
    prompt: "best quality",
    negative_prompt: "delete",
    apiname: "/generate_image",
  },
  null,
  2,
);

export const DEFAULT_NIM_CONFIG = JSON.stringify(
  {
    seed: 0,
    steps: 4,
    width: 1024,
    height: 1024,
  },
  null,
  2,
);

export const settingsRecordSchema = z.object({
  key: z.literal(SETTINGS_RECORD_KEY),
  /** Narrative language (e.g. "Japanese"). */
  language: z.string(),
  /** Target prose length order (e.g. "short" | "medium" | "long"). */
  sceneTextLength: z.string(),
  /** OpenRouter model id used for narrative text generation. */
  textModel: z.string(),
  /** Image generator selection. */
  imageGenerator: imageGeneratorTypeSchema.default("disabled"),
  /** A1111 endpoint URL. */
  a1111Endpoint: z.string().default("http://127.0.0.1:7860"),
  /** A1111 config JSON. */
  a1111Config: z.string().default(DEFAULT_A1111_CONFIG),
  /** ComfyUI endpoint URL. */
  comfyuiEndpoint: z.string().default("http://127.0.0.1:8188"),
  /** ComfyUI workflow JSON. */
  comfyuiWorkflow: z.string().default(DEFAULT_COMFYUI_WORKFLOW),
  /** Hugging Face Space ID. */
  huggingFaceSpaceId: z.string().default("mrfakename/Z-Image-Turbo"),
  /** Hugging Face config JSON. */
  huggingFaceConfig: z.string().default(DEFAULT_HUGGINGFACE_CONFIG),
  /** NVIDIA NIM endpoint. */
  nimEndpoint: z
    .string()
    .default("https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.2-klein-4b"),
  /** NVIDIA NIM config JSON. */
  nimConfig: z.string().default(DEFAULT_NIM_CONFIG),
  /** WebP compression level. */
  webpCompression: webpCompressionSchema.default("normal"),
  /** Memory strategy for LLM calls. */
  memoryStrategy: memoryStrategySchema.default("single"),
  /** Whether storyLog compaction (archivist) is enabled. */
  enableStoryLogCompaction: z.boolean().default(true),
});
export type SettingsRecord = z.infer<typeof settingsRecordSchema>;

export const DEFAULT_TEXT_MODEL = "openai/gpt-4o-mini";

export const defaultSettingsRecord: SettingsRecord = settingsRecordSchema.parse({
  key: SETTINGS_RECORD_KEY,
  language: "Japanese",
  sceneTextLength: "medium",
  textModel: DEFAULT_TEXT_MODEL,
});
