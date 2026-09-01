export function parseJsonConfig<T>(json: string, label: string): T {
  if (!json || json.trim().length === 0) return {} as T;
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    throw new Error(
      `Invalid ${label} JSON config: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function escapePromptWeights(prompt: string): string {
  // Escape parentheses and brackets that Stable Diffusion treats as attention weights,
  // unless they are already part of a weight syntax.
  return prompt.replace(/([()[\]])/g, "\\$1");
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
