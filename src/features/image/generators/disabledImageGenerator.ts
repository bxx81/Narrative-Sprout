import type { IImageGenerator } from "../types";
import { FALLBACK_IMAGE_URL } from "../types";

export class DisabledImageGenerator implements IImageGenerator {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async generate(_params?: unknown): Promise<string> {
    return FALLBACK_IMAGE_URL;
  }
  async unloadModel(): Promise<void> {
    return;
  }
}
