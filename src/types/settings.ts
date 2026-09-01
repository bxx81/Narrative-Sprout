import { z } from "zod";
import { getInitialUiLanguage } from "../features/i18n/api";

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

/**
 * AI-translated UI bundles are validated language-by-language (REDESIGN
 * §5.7): a corrupted language record is dropped with a warning instead of
 * failing the whole settings record. Missing input (old records) normalizes
 * to an empty table.
 */
const aiTranslationsSchema = z
  .record(z.string(), z.unknown())
  .optional()
  .transform((value) => {
    const result: Record<string, Record<string, string>> = {};
    if (value === undefined) return result;
    for (const [languageName, texts] of Object.entries(value)) {
      if (!texts || typeof texts !== "object") {
        console.warn("[settings] invalid AI translation bundle skipped", languageName);
        continue;
      }
      const textsRecord = texts as Record<string, unknown>;
      const textsResult: Record<string, string> = {};
      for (const [translationKey, translationValue] of Object.entries(textsRecord)) {
        const parsed = z.string().safeParse(translationValue);
        if (parsed.success) {
          textsResult[translationKey] = parsed.data;
        } else {
          console.warn(
            "[settings] invalid translation value skipped",
            languageName,
            translationKey,
          );
        }
      }
      result[languageName] = textsResult;
    }
    return result;
  });

/** Language display name → IETF tag table for AI-translated languages. */
const aiLanguageMappingsSchema = z
  .record(z.string(), z.unknown())
  .optional()
  .transform((value) => {
    const result: Record<string, string> = {};
    if (value === undefined) return result;
    for (const [languageName, languageCode] of Object.entries(value)) {
      const parsed = z.string().safeParse(languageCode);
      if (parsed.success) result[languageName] = parsed.data;
      else console.warn("[settings] invalid language mapping skipped", languageName);
    }
    return result;
  });

export const settingsRecordSchema = z.object({
  key: z.literal(SETTINGS_RECORD_KEY),
  /** Narrative language (e.g. "Japanese"). */
  language: z.string(),
  /** UI display language (native name, e.g. "English" — see features/i18n). */
  uiLanguage: z.string().default(getInitialUiLanguage()),
  /** Target prose length order (e.g. "short" | "medium" | "long"). */
  sceneTextLength: z.string(),
  /**
   * OpenRouter model id used for narrative text generation. May carry
   * trailing per-model options (e.g. "provider/model --stream=false"), see
   * lib/modelOptions.
   */
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
  /** Live text streaming from the narrative model (per-model opt-out possible). */
  enableStreaming: z.boolean().default(true),
  /** AI-translated UI bundles keyed by the user-typed language name. */
  aiTranslations: aiTranslationsSchema,
  /** IETF tags for AI-translated languages (display name → tag). */
  aiLanguageMappings: aiLanguageMappingsSchema,
});
export type SettingsRecord = z.infer<typeof settingsRecordSchema>;

export const DEFAULT_TEXT_MODEL = "openai/gpt-4o-mini";

export const defaultSettingsRecord: SettingsRecord = settingsRecordSchema.parse({
  key: SETTINGS_RECORD_KEY,
  language: "Japanese",
  sceneTextLength: "medium",
  textModel: DEFAULT_TEXT_MODEL,
});
