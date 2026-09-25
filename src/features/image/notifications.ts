import toast from "react-hot-toast";
import { classifyError, type ClassifiedError } from "../../lib/errorClassification";
import { IMAGE_FAILURE_REASON_MAX_LENGTH, truncateText } from "../../lib/truncateText";
import { translate } from "../i18n/api";

/**
 * Fixed toast id: autoplay re-attempts image generation on every turn, so an
 * exhausted quota would otherwise stack one toast per turn — and each new id
 * would also fire the notification chime (see `ToastSoundPlayer`).
 */
const IMAGE_FAILURE_TOAST_ID = "image-generation-failed";

const HEADLINE_DEFAULT = "The scene image could not be generated.";

/** Generator errors are plain `Error`s; classification only wraps known codes. */
function resolveReason(classified: ClassifiedError, error: unknown): string {
  if (classified.messageIsKey) return translate(classified.message);
  if (!(error instanceof Error) || !error.message) return "";
  return truncateText(error.message, IMAGE_FAILURE_REASON_MAX_LENGTH);
}

/**
 * Headline + classified reason for an image-generation failure, or `null`
 * when the outcome must not be reported (user Stop / informational aborts).
 */
export function buildImageFailureMessage(error: unknown): string | null {
  const classified = classifyError(error);
  if (classified.onlyInformation) return null;
  const headline = translate("imageGenerationFailedToast", HEADLINE_DEFAULT);
  const reason = resolveReason(classified, error);
  return reason ? `${headline}\n${reason}` : headline;
}

/**
 * Reports a scene-image generation failure that happened inside a turn
 * (start / choice / refine / redo).
 *
 * The turn itself already succeeded with no asset stored — identical to the
 * "generator disabled" behaviour — so this only informs the player; it never
 * fails the turn. Image regeneration failures are deliberately excluded: they
 * keep the retryable `ErrorDialog`.
 */
export function notifyImageGenerationFailure(error: unknown): void {
  const message = buildImageFailureMessage(error);
  if (message === null) return;
  toast.error(message, { id: IMAGE_FAILURE_TOAST_ID });
}
