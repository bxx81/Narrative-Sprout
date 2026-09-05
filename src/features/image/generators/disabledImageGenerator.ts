import type { IImageGenerator } from "../types";
import { FALLBACK_IMAGE_URL } from "../types";

export class DisabledImageGenerator implements IImageGenerator {
  async generate(_params?: unknown): Promise<string> {
    return FALLBACK_IMAGE_URL;
  }
  async unloadModel(): Promise<void> {
    return;
  }
}
