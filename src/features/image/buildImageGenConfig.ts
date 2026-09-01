import type { SettingsRecord } from "../../types/settings";
import type { ImageGenConfig } from "./types";

export function buildImageGenConfig(
  settings: SettingsRecord,
  credentials: { huggingFaceToken: string | null; nimToken: string | null },
): ImageGenConfig {
  return {
    generator: settings.imageGenerator,
    a1111Endpoint: settings.a1111Endpoint,
    a1111Config: settings.a1111Config,
    comfyuiEndpoint: settings.comfyuiEndpoint,
    comfyuiWorkflow: settings.comfyuiWorkflow,
    huggingFaceConfig: settings.huggingFaceConfig,
    huggingFaceSpaceId: settings.huggingFaceSpaceId,
    huggingFaceToken: credentials.huggingFaceToken,
    nimEndpoint: settings.nimEndpoint,
    nimConfig: settings.nimConfig,
    nimToken: credentials.nimToken,
  };
}
