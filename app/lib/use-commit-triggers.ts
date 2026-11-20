import {
  type FocusEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
} from "react";

/**
 * When a form with no submit button should commit. Sits on top of
 * `useCommitOnComplete`, which owns the request (one POST, in-flight guard,
 * error); this hook only decides WHEN to call its `submit`. Built for forms
 * that record something that cannot be undone (a collection, a delivery), so
 * the rules lean towards doing nothing.
 *
 * A commit is only ever started by one of three deliberate user actions, and
 * only when `validate` accepts the current values. Nothing runs on mount,
 * on a keystroke, or from prefilled values alone.
 *
 *  1. ENTER in any field of the form. Skipped for a button or textarea (Enter
 *     means something else there), for an IME composition, for a held-down
 *     key, and when the field already handled the key (an open list choosing
 *     an option). Enter on an unchanged form still commits: it is deliberate,
 *     and it is how a failed attempt is retried.
 *  2. LEAVING THE FORM after a change: a blur whose focus goes outside the
 *     form, when the values differ from what they were at the last commit
 *     attempt (or from the start). Tabbing through untouched fields, moving
 *     to another field inside the form, and the window losing focus never
 *     commit. A press inside the form counts as staying in it, because
 *     Safari and Firefox on macOS do not focus a button or checkbox that is
 *     clicked, so the blur of the field being left would look like leaving.
 *  3. A SINGLE-GESTURE CONTROL (a select, a checkbox) that takes the form from
 *     incomplete to complete: the form calls `commitAfterGesture(nextValues)`
 *     from that control's change handler. A gesture on a form that was
 *     already complete does not commit (nothing was missing, so the choice may
 *     be an edit); the next Enter or leave does, as for any other change.
 *
 * On Enter or leave with invalid values nothing is posted and `onValidation`
 * gets the field errors so the form can show them. A valid attempt calls it
 * with `{}`. A gesture that is still incomplete is silent: the controller is
 * part-way through.
 *
 * After a failed commit the values stay as they are, nothing is retried by
 * itself, and focus returns to the field Enter was pressed in. A retry is the
 * next Enter, or the next leave after an edit.
 *
 * `values` must be JSON-serialisable: "changed" is a comparison of them.
 */
export type Validation<TPayload> =
  | { payload: TPayload }
  | { errors: Record<string, string> };

export type CommitTriggersOptions<TValues, TPayload> = {
  values: TValues;
  /** `{ payload }` when every required field is valid, else the field errors. */
  validate: (values: TValues) => Validation<TPayload>;
  /** The `submit` and `isCommitting` of the form's `useCommitOnComplete`. */
  committer: {
    submit: (payload: TPayload) => boolean;
    isCommitting: boolean;
  };
  onValidation?: (errors: Record<string, string>) => void;
};

export type CommitTriggers<TValues> = {
  /** Spread onto the `<form>`. */
  formProps: {
    ref: React.RefObject<HTMLFormElement | null>;
    onKeyDown: (event: KeyboardEvent<HTMLFormElement>) => void;
    onBlur: (event: FocusEvent<HTMLFormElement>) => void;
    onFocus: () => void;
    onMouseDown: () => void;
    onMouseUp: () => void;
  };
  /** Call from a select/checkbox change handler with the values it produces. */
  commitAfterGesture: (nextValues: TValues) => boolean;
};

const ENTER_IGNORED_ON = new Set(["BUTTON", "TEXTAREA", "A"]);

function snapshot(values: unknown): string {
  return JSON.stringify(values);
}

export function useCommitTriggers<TValues, TPayload>(
  options: CommitTriggersOptions<TValues, TPayload>,
): CommitTriggers<TValues> {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const formRef = useRef<HTMLFormElement>(null);
  // The values at the last commit attempt, or at the start.
  const baselineRef = useRef(snapshot(options.values));
  const pressInsideRef = useRef(false);
  const restoreFocusRef = useRef<Element | null>(null);
  const wasCommittingRef = useRef(false);

  const { isCommitting } = options.committer;
  useEffect(() => {
    if (wasCommittingRef.current && !isCommitting) {
      const element = restoreFocusRef.current;
      restoreFocusRef.current = null;
      const active = document.activeElement;
      if (
        element instanceof HTMLElement &&
        element.isConnected &&
        (active === null || active === document.body)
      ) {
        element.focus();
      }
    }
    wasCommittingRef.current = isCommitting;
  }, [isCommitting]);

  const attempt = useCallback(
    (candidate: TValues, reportInvalid: boolean): boolean => {
      const { validate, committer, onValidation } = optionsRef.current;
      const result = validate(candidate);
      if ("errors" in result) {
        if (reportInvalid) {
          onValidation?.(result.errors);
        }
        return false;
      }

      const form = formRef.current;
      const active = document.activeElement;
      const focusedInside = form !== null && active && form.contains(active);

      if (!committer.submit(result.payload)) {
        return false;
      }

      baselineRef.current = snapshot(candidate);
      restoreFocusRef.current = focusedInside ? active : null;
      onValidation?.({});
      return true;
    },
    [],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLFormElement>) => {
      pressInsideRef.current = false;
      if (
        event.key !== "Enter" ||
        event.defaultPrevented ||
        event.repeat ||
        event.nativeEvent.isComposing ||
        event.keyCode === 229 ||
        ENTER_IGNORED_ON.has((event.target as Element).tagName)
      ) {
        return;
      }

      attempt(optionsRef.current.values, true);
    },
    [attempt],
  );

  const onBlur = useCallback(
    (event: FocusEvent<HTMLFormElement>) => {
      const pressedInside = pressInsideRef.current;
      pressInsideRef.current = false;
      if (pressedInside) {
        return;
      }

      const next = event.relatedTarget;
      if (next instanceof Node && event.currentTarget.contains(next)) {
        return;
      }

      // The window lost focus (another tab, the address bar): the field is
      // still the active element, so the controller has not left the form.
      if (document.activeElement === event.target) {
        return;
      }

      const { values } = optionsRef.current;
      if (snapshot(values) === baselineRef.current) {
        return;
      }

      attempt(values, true);
    },
    [attempt],
  );

  const commitAfterGesture = useCallback(
    (nextValues: TValues): boolean => {
      const { validate, values } = optionsRef.current;
      if (!("errors" in validate(values))) {
        return false;
      }

      return attempt(nextValues, false);
    },
    [attempt],
  );

  return {
    formProps: {
      ref: formRef,
      onKeyDown,
      onBlur,
      onFocus: () => {
        pressInsideRef.current = false;
      },
      onMouseDown: () => {
        pressInsideRef.current = true;
      },
      onMouseUp: () => {
        pressInsideRef.current = false;
      },
    },
    commitAfterGesture,
  };
}
