/**
 * Image data-url / blob helpers and WebP conversion (REDESIGN.md §5.3).
 *
 * Legacy used `convertToWebpBlob` with canvas. We keep that approach but
 * make it safe for test environments where `document` / canvas may not exist.
 */

/**
 * Converts a `data:` URL to a Blob via fetch (fast path, works for any mime).
 */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

/**
 * Converts an arbitrary image Blob to WebP.
 *
 * - If already `image/webp` and ≤ 100 KiB, returns as-is (skip recompression).
 * - Otherwise draws to an offscreen canvas and re-encodes at `quality`.
 * - In non-DOM environments (happy-dom without canvas support or Node), falls
 *   back to returning the original blob unchanged.
 */
export async function convertToWebpBlob(blob: Blob, quality: number): Promise<Blob> {
  if (blob.type === "image/webp" && blob.size <= 100 * 1024) {
    return blob;
  }
  if (typeof document === "undefined" || typeof OffscreenCanvas === "undefined") {
    // Fallback when canvas is unavailable: attempt DOM canvas if possible.
    if (typeof document === "undefined") return blob;
    try {
      return await convertViaDomCanvas(blob, quality);
    } catch {
      return blob;
    }
  }
  // Try OffscreenCanvas path first (more efficient, no DOM).
  try {
    // OffscreenCanvas path requires createImageBitmap, which may not exist in tests.
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) return blob;
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close?.();
      const out = await canvas.convertToBlob({ type: "image/webp", quality });
      return out ?? blob;
    }
  } catch {
    // fall through to DOM canvas
  }
  try {
    return await convertViaDomCanvas(blob, quality);
  } catch {
    return blob;
  }
}

function convertViaDomCanvas(blob: Blob, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context for WebP conversion."));
        return;
      }
      ctx.drawImage(image, 0, 0);
      canvas.toBlob(
        (out) => {
          if (out) resolve(out);
          else reject(new Error("canvas.toBlob failed"));
        },
        "image/webp",
        quality,
      );
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for WebP conversion."));
    };
    image.src = url;
  });
}

/**
 * Creates a Blob from a base64 data-url string without a network round-trip,
 * when the caller already has the base64 payload (e.g. from an image generator
 * returning `data:image/png;base64,...`).
 */
export function base64DataUrlToBlob(dataUrl: string): Blob {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/s);
  if (!match) throw new Error("Invalid base64 data URL");
  const mime = match[1]!;
  const b64 = match[2]!;
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}
