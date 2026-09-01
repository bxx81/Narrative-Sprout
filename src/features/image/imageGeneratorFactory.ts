import type { ImageGeneratorType } from "../../types/settings";
import type { IImageGenerator } from "./types";
import { A1111ImageGenerator } from "./generators/a1111ImageGenerator";
import { ComfyUIImageGenerator } from "./generators/comfyUIImageGenerator";
import { HuggingFaceImageGenerator } from "./generators/huggingFaceImageGenerator";
import { NvidiaNimImageGenerator } from "./generators/nvidiaNimImageGenerator";
import { DisabledImageGenerator } from "./generators/disabledImageGenerator";

export class ImageGeneratorFactory {
  private static generators: Partial<Record<ImageGeneratorType, IImageGenerator>> = {};

  static create(type: ImageGeneratorType): IImageGenerator {
    const cached = this.generators[type];
    if (cached) return cached;
    let generator: IImageGenerator;
    switch (type) {
      case "a1111":
        generator = new A1111ImageGenerator();
        break;
      case "comfyui":
        generator = new ComfyUIImageGenerator();
        break;
      case "huggingface":
        generator = new HuggingFaceImageGenerator();
        break;
      case "nvidia_nim":
        generator = new NvidiaNimImageGenerator();
        break;
      case "disabled":
      default:
        generator = new DisabledImageGenerator();
        break;
    }
    this.generators[type] = generator;
    return generator;
  }

  /** For testing: clear cached instances. */
  static reset(): void {
    this.generators = {};
  }
}
