/**
 * Per-model options carried on the `textModel` settings string, mirroring the
 * legacy model-string syntax (e.g. "provider/model --stream=false"). v2 only
 * consumes `stream`; unknown options stay in the raw string but are ignored.
 */
export interface TextModelOptions {
  /** The bare model id ("provider/model") without trailing options. */
  model: string;
  /** Whether SSE streaming may be used for this model (default true). */
  stream: boolean;
}

export function parseTextModelOptions(textModel: string): TextModelOptions {
  const tokens = textModel.trim().split(/\s+/).filter(Boolean);
  const model = tokens[0] ?? "";
  let stream = true;
  for (const token of tokens.slice(1)) {
    const match = /^--([a-zA-Z_]+)=(.*)$/.exec(token);
    if (!match) continue;
    const optionName = match[1]!;
    const rawValue = match[2]!;
    if (optionName === "stream") {
      stream = rawValue !== "false";
    }
  }
  return { model, stream };
}

/** Streaming decision: the global setting AND the per-model opt-out. */
export function isStreamingEnabledForSettings(settings: {
  enableStreaming: boolean;
  textModel: string;
}): boolean {
  if (!settings.enableStreaming) return false;
  return parseTextModelOptions(settings.textModel).stream;
}
