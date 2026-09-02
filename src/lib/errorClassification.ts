import { ApiError } from "./openAiClient";

/**
 * Error classification for the UI (legacy errorService port): decides the
 * dialog title, which buttons appear and whether a 429 countdown applies.
 * i18n keys are used as codes where a canned message exists; anything else
 * keeps the original message text.
 */
export interface ClassifiedError {
  /** i18n key (error*) or the original error message. */
  message: string;
  /** True when `message` is an i18n key instead of literal text. */
  messageIsKey: boolean;
  isRetryable: boolean;
  /** Informational only (e.g. user abort): shows a single Dismiss button. */
  onlyInformation: boolean;
  /** HTTP status when the error came from an API response. */
  status?: number;
}

/** Credentials/permission problems: retrying cannot help. */
const NON_RETRYABLE_STATUSES = new Set([401, 402, 403]);

const STATUS_HINTS: Record<number, string> = {
  400: "Bad Request (invalid or missing params, CORS)",
  401: "Invalid credentials",
  402: "Insufficient credits",
  403: "Forbidden",
  408: "Your request timed out",
  429: "You are being rate limited",
  500: "Internal server error",
  502: "The model is down",
  503: "No available model provider",
  504: "The server timed out",
};

export function classifyError(error: unknown): ClassifiedError {
  if (error instanceof ApiError) {
    const retryable = !NON_RETRYABLE_STATUSES.has(error.status);
    if (error.status === 429) {
      return {
        message: "errorApiOverloaded",
        messageIsKey: true,
        isRetryable: retryable,
        onlyInformation: false,
        status: error.status,
      };
    }
    const knownHint = STATUS_HINTS[error.status];
    return {
      message: knownHint ? `${error.status}: ${knownHint}` : error.displayMessage,
      messageIsKey: false,
      isRetryable: retryable,
      onlyInformation: false,
      status: error.status,
    };
  }
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return {
        message: "errorAborted",
        messageIsKey: true,
        isRetryable: false,
        onlyInformation: true,
      };
    }
    if (error.name === "TimeoutError") {
      return {
        message: "errorApiGeneric",
        messageIsKey: true,
        isRetryable: true,
        onlyInformation: false,
      };
    }
    // NarrationError and other generation failures: transient, retrying
    // usually helps (empty content, invalid JSON, validation failures).
    return {
      message: error.message || "errorUnknownMessage",
      messageIsKey: false,
      isRetryable: true,
      onlyInformation: false,
    };
  }
  return {
    message: "errorUnknownMessage",
    messageIsKey: true,
    isRetryable: false,
    onlyInformation: false,
  };
}
