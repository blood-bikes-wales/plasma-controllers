import { useCallback, useRef, useState } from "react";

/**
 * Commit-on-complete: submit a form on its own the moment every required field
 * is filled in, with no submit button. Used for choices that are a single
 * deliberate tap (allocating a rider) and meant for any form that can commit
 * as soon as it is complete (recording a collection or a delivery).
 *
 * Contract
 * - The caller decides when the form is complete and calls `submit(payload)`
 *   from its change handler with the finished payload. While any required
 *   field is missing it calls `submit(null)` (or does not call it); a
 *   null/undefined payload is ignored. The hook holds no field values and no
 *   validation, so each form keeps its own state and rules.
 * - `submit` is synchronous and returns `true` if it started a commit, `false`
 *   if it ignored the call. It ignores the call while a commit is already
 *   running, so a field reporting its value twice (select plus Enter, a rapid
 *   second change, a StrictMode double effect) makes exactly ONE `commit` call
 *   per completed choice. The in-flight guard is a ref, so it holds within
 *   the same tick, before any re-render. Callers should leave their own field
 *   state alone when `submit` returns `false` for a change made mid-commit.
 * - Free-text fields (and anything typed) must call `submit` on blur or Enter,
 *   never per keystroke, or the first character would commit. Selects, toggles
 *   and other single-gesture fields can call it from their change handler.
 * - A change made while a commit is in flight is DROPPED: `submit` returns
 *   `false` and nothing is replayed afterwards. So a form must disable its
 *   fields while `isCommitting`, rather than rely on the hook to queue input.
 * - While the commit runs `isCommitting` is true. Pass it as `disabled` to the
 *   fields and announce it (for example `role="status"` text).
 * - On success `onSuccess(payload)` runs and the error is cleared.
 * - On failure `error` holds `errorMessage(caught)` (show it under the field,
 *   `role="alert"`), and `onFailure(message, payload, caught)` runs so the form
 *   can reset the field(s) that triggered the commit and let the user choose
 *   again. `caught` is whatever `commit` threw, untouched, so a form with
 *   several fields can map an `ApiError` 422 body to the field it belongs to. The hook never retries by itself. The next `submit` clears `error`;
 *   `clearError()` clears it earlier (for example when the user edits a field).
 * - `commit` should throw (reject) to signal failure. Its result is ignored.
 * - The latest `commit`, `errorMessage`, `onSuccess` and `onFailure` are always
 *   the ones used, so they may close over props and state without memoising.
 * - Callbacks may not break the hook: if `errorMessage` throws, the error is
 *   "Something went wrong."; if `onSuccess` or `onFailure` throws, the error is
 *   logged with `console.error` and swallowed. Either way the in-flight guard
 *   is released and `isCommitting` goes back to false, so the form never gets
 *   stuck, and nothing is left as an unhandled rejection.
 * - Unmounting does NOT cancel a commit. The request still completes, and
 *   `onSuccess` / `onFailure` STILL run afterwards. The hook's own state
 *   updates after unmount are harmless no-ops, but a callback that updates
 *   component state, or touches anything the component owned, must guard it
 *   itself (for example with a ref that the component clears on unmount).
 */
export type CommitOnCompleteOptions<TPayload> = {
  commit: (payload: TPayload) => Promise<unknown>;
  /** Message shown for a failed commit. */
  errorMessage: (caught: unknown) => string;
  onSuccess?: (payload: TPayload) => void;
  /** Reset the triggering field(s) here; runs after `error` is set. */
  onFailure?: (message: string, payload: TPayload, caught: unknown) => void;
};

export type CommitOnComplete<TPayload> = {
  /** Start the commit if `payload` is complete and none is running. */
  submit: (payload: TPayload | null | undefined) => boolean;
  isCommitting: boolean;
  error: string | null;
  clearError: () => void;
};

const FALLBACK_MESSAGE = "Something went wrong.";

function failureMessage(
  describe: (caught: unknown) => string,
  caught: unknown,
): string {
  try {
    return describe(caught);
  } catch {
    return FALLBACK_MESSAGE;
  }
}

/** Run a caller's callback so that a throw cannot escape the hook. */
function runContained(callback: () => void) {
  try {
    callback();
  } catch (caught: unknown) {
    console.error("useCommitOnComplete: a callback threw.", caught);
  }
}

export function useCommitOnComplete<TPayload>(
  options: CommitOnCompleteOptions<TPayload>,
): CommitOnComplete<TPayload> {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const inFlightRef = useRef(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const submit = useCallback((payload: TPayload | null | undefined) => {
    if (payload === null || payload === undefined || inFlightRef.current) {
      return false;
    }

    inFlightRef.current = true;
    setError(null);
    setIsCommitting(true);

    void (async () => {
      let failure: string | null = null;
      let thrown: unknown;
      try {
        await optionsRef.current.commit(payload);
      } catch (caught: unknown) {
        thrown = caught;
        failure = failureMessage(optionsRef.current.errorMessage, caught);
      }

      // Release the guard before the callbacks, which may start the next choice.
      inFlightRef.current = false;
      setError(failure);
      setIsCommitting(false);

      if (failure !== null) {
        const message = failure;
        runContained(() =>
          optionsRef.current.onFailure?.(message, payload, thrown),
        );
        return;
      }

      runContained(() => optionsRef.current.onSuccess?.(payload));
    })();

    return true;
  }, []);

  return { submit, isCommitting, error, clearError };
}
