/** Generic async operation state (REDESIGN §4.3). No ad-hoc *_PENDING flags. */
export type AsyncOperation<TPayload, TResult> =
  | { phase: "idle" }
  | { phase: "running"; payload: TPayload; startedAt: string }
  | { phase: "failed"; payload: TPayload; error: Error } // payload retained → retryable
  | { phase: "done"; result: TResult };

export const idle: AsyncOperation<never, never> = { phase: "idle" };
