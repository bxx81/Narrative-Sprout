import type { GenerateParams, IImageGenerator } from "../types";
import { blobToDataUrl, escapePromptWeights } from "./utils";

const SEED_PLACEHOLDER = 1234567890;
const EXECUTION_TIMEOUT_MS = 90_000;

interface ComfyUIImageOutput {
  filename: string;
  subfolder: string;
  type: string;
}
interface ComfyUINodeOutput {
  images: ComfyUIImageOutput[];
}

export class ComfyUIImageGenerator implements IImageGenerator {
  async unloadModel(): Promise<void> {
    return;
  }

  async generate(params: GenerateParams): Promise<string> {
    const { prompt, negativePrompt, config, onProgress, signal } = params;
    const { comfyuiEndpoint, comfyuiWorkflow } = config;
    if (!comfyuiEndpoint) throw new Error("Empty endpoint.");
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const workflow = this.buildWorkflow(comfyuiWorkflow, prompt, negativePrompt);
    const imageUrl = await this.runWorkflow(comfyuiEndpoint, workflow, onProgress, signal);
    return this.fetchImageAsDataUrl(imageUrl, onProgress, signal);
  }

  private buildWorkflow(
    workflowJson: string,
    prompt: string | undefined,
    negativePrompt: string | undefined,
  ): unknown {
    let base: unknown;
    try {
      base = JSON.parse(workflowJson);
    } catch (e) {
      if (e instanceof SyntaxError) throw new Error("Invalid ComfyUI workflow JSON.", { cause: e });
      throw e;
    }
    const newSeed = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    return this.replacePlaceholders(base, prompt, negativePrompt ?? "", newSeed);
  }

  private replacePlaceholders(
    obj: unknown,
    prompt: string | undefined,
    negativePrompt: string,
    newSeed: number,
  ): unknown {
    if (obj === null) return null;
    if (Array.isArray(obj))
      return obj.map((i) => this.replacePlaceholders(i, prompt, negativePrompt, newSeed));
    if (typeof obj === "object") {
      return Object.fromEntries(
        Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
          k,
          this.replacePlaceholders(v, prompt, negativePrompt, newSeed),
        ]),
      );
    }
    if (typeof obj === "string") {
      return obj
        .replace(/##prompt##/g, escapePromptWeights(prompt ?? ""))
        .replace(/##negative_prompt##/g, escapePromptWeights(negativePrompt ?? ""));
    }
    if (typeof obj === "number" && obj === SEED_PLACEHOLDER) return newSeed;
    return obj;
  }

  private runWorkflow(
    endpoint: string,
    workflow: unknown,
    onProgress: (p: number) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    const clientId = crypto.randomUUID();
    const wsEndpoint = endpoint.replace(/^http/, "ws");
    const ws = new WebSocket(`${wsEndpoint}/ws?clientId=${clientId}`);
    return new Promise((resolve, reject) => {
      let promptId: string | undefined;
      let finished = false;
      const nodeOutputs: ComfyUINodeOutput[] = [];
      const close = () => {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close();
      };
      const rejectAndClose = (e: unknown) => {
        clearTimeout(timeoutHandle);
        close();
        reject(e);
      };
      const resolveAndClose = (url: string) => {
        clearTimeout(timeoutHandle);
        close();
        resolve(url);
      };
      const timeoutHandle = setTimeout(() => {
        if (!finished) rejectAndClose(new Error("ComfyUI task timed out."));
      }, EXECUTION_TIMEOUT_MS);

      ws.onopen = async () => {
        try {
          const response = await fetch(`${endpoint}/prompt`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: workflow, client_id: clientId }),
          });
          if (!response.ok) {
            const text = await response.text().catch(() => "");
            throw new Error(
              `ComfyUI API error (queuing): ${response.status} ${response.statusText}. ${text}`,
            );
          }
          const result = (await response.json()) as { prompt_id: string };
          promptId = result.prompt_id;
        } catch (e) {
          rejectAndClose(e);
        }
      };
      ws.onmessage = (event: MessageEvent<string>) => {
        let data: { type: string; data?: Record<string, unknown> };
        try {
          data = JSON.parse(event.data) as typeof data;
        } catch {
          return;
        }
        const { type: msgType, data: msgData = {} } = data;
        if (msgData["prompt_id"] !== promptId) return;
        switch (msgType) {
          case "progress": {
            const value = msgData["value"] as number;
            const max = msgData["max"] as number;
            if (max > 0) onProgress(value / max);
            break;
          }
          case "executed": {
            if (msgData["output"]) nodeOutputs.push(msgData["output"] as ComfyUINodeOutput);
            break;
          }
          case "execution_success": {
            finished = true;
            const lastImage = nodeOutputs.at(-1)?.images?.at(0);
            if (!lastImage) {
              rejectAndClose(new Error("ComfyUI task finished but produced no image."));
              return;
            }
            const imageUrl = `${endpoint}/view?filename=${lastImage.filename}&subfolder=${lastImage.subfolder}&type=${lastImage.type}`;
            resolveAndClose(imageUrl);
            break;
          }
          case "execution_error":
          case "execution_interrupted": {
            finished = true;
            rejectAndClose(new Error(`ComfyUI execution failed: ${JSON.stringify(msgData)}`));
            break;
          }
        }
      };
      ws.onerror = () =>
        rejectAndClose(new Error(`Failed to connect to ComfyUI WebSocket at ${ws.url}.`));
      ws.onclose = () => {
        if (!finished) {
          finished = true;
          rejectAndClose(new Error("ComfyUI WebSocket closed unexpectedly."));
        }
      };
      if (signal) {
        if (signal.aborted) rejectAndClose(new DOMException("Aborted", "AbortError"));
        else
          signal.addEventListener(
            "abort",
            () => {
              if (!finished) {
                finished = true;
                rejectAndClose(new DOMException("Aborted", "AbortError"));
              }
            },
            { once: true },
          );
      }
    });
  }

  private async fetchImageAsDataUrl(
    imageUrl: string,
    onProgress: (p: number) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    const response = await fetch(imageUrl, {
      signal: AbortSignal.any(
        [AbortSignal.timeout(30_000), signal].filter((s): s is AbortSignal => s !== undefined),
      ),
    });
    if (!response.ok) throw new Error(`ComfyUI failed to serve image: ${response.statusText}`);
    const blob = await response.blob();
    const dataUrl = await blobToDataUrl(blob);
    onProgress(1);
    return dataUrl;
  }
}
