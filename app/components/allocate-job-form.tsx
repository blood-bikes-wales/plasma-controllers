import { useEffect, useRef, useState } from "react";

import { SearchableSelectField } from "~/components/searchable-select-field";
import { jobErrorMessage } from "~/lib/jobs";
import type { ActiveShift } from "~/lib/shifts";
import { useCommitOnComplete } from "~/lib/use-commit-on-complete";

const ALLOCATE_FIELD_ID = "allocate-shift";

/**
 * Allocates (or, on an Allocated job, re-allocates) the rider as soon as one is
 * chosen: there is no submit button. Choosing is the commit moment, handled by
 * `useCommitOnComplete`, so a double report of one choice posts once.
 *
 * `currentShiftId` is the shift the job has now (null on a New job). It is shown
 * as the field's value when that shift is still on the list, and choosing it
 * again posts nothing. `onSubmit` must reject when the API refuses; the error
 * then shows under the field and the selection goes back to the job's current
 * rider (empty on a New job) so another rider can be picked.
 *
 * The "Allocating…" status line is always rendered (empty when idle, never
 * display:none) so screen readers have a live region to announce into. The
 * error is a `role="alert"` paragraph inserted under the field, which is
 * announced when it appears.
 */
export function AllocateJobForm({
  shifts,
  currentShiftId,
  currentRiderName,
  isSubmitting,
  onSubmit,
}: {
  shifts: ActiveShift[];
  currentShiftId: string | null;
  currentRiderName: string | null;
  isSubmitting: boolean;
  onSubmit: (shiftId: string) => Promise<void>;
}) {
  // The current rider's shift may have ended, so it can be missing from the list.
  const currentValue =
    currentShiftId !== null &&
    shifts.some((shift) => shift.id === currentShiftId)
      ? currentShiftId
      : null;
  const [shiftId, setShiftId] = useState<string | null>(currentValue);
  const wasCommitting = useRef(false);
  const focusAfterRender = useRef(false);

  const committer = useCommitOnComplete<string>({
    commit: onSubmit,
    errorMessage: (caught) =>
      jobErrorMessage(caught, "Unable to allocate this job."),
    // Back to what the job really has: the current rider, or empty on a New job.
    onFailure: () => setShiftId(currentValue),
  });
  const { isCommitting } = committer;
  const isChange = currentShiftId !== null;

  // The job's rider changed (an allocation went through): show the new rider.
  useEffect(() => {
    setShiftId(currentValue);
  }, [currentValue]);

  // Choosing swaps the search box for the chosen rider (and back after an
  // error), which drops focus to the body. Put it back on the field once a
  // result is in, but never take focus from somewhere the user has moved to.
  useEffect(() => {
    if (wasCommitting.current && !isCommitting) {
      const field = document.getElementById(ALLOCATE_FIELD_ID);
      const active = document.activeElement;
      if (active === null || active === document.body || active === field) {
        field?.focus();
      }
    }
    wasCommitting.current = isCommitting;
  }, [isCommitting]);

  // Choosing "Change" empties the field; focusing it opens the list of riders.
  useEffect(() => {
    if (focusAfterRender.current) {
      focusAfterRender.current = false;
      document.getElementById(ALLOCATE_FIELD_ID)?.focus();
    }
  });

  function handleChange(next: string | null) {
    if (isCommitting) {
      return;
    }

    committer.clearError();
    if (next === null || next === currentShiftId) {
      focusAfterRender.current = next === null;
      setShiftId(next);
      return;
    }

    if (committer.submit(next)) {
      setShiftId(next);
    }
  }

  return (
    <div className="space-y-4">
      {isChange && currentRiderName ? (
        <p className="text-sm text-bb-gray-600 dark:text-bb-gray-300">
          Currently allocated to{" "}
          <span className="font-medium text-bb-gray-900 dark:text-bb-gray-100">
            {currentRiderName}
          </span>
          . Choose another rider on shift to re-allocate this job.
        </p>
      ) : null}
      <SearchableSelectField
        id={ALLOCATE_FIELD_ID}
        label={isChange ? "New rider on shift" : "Active shift rider"}
        value={shiftId}
        onChange={handleChange}
        options={shifts.map((shift) => ({
          value: shift.id,
          label: shift.bikeRegistration
            ? `${shift.riderName} · ${shift.bikeRegistration}`
            : shift.riderName,
        }))}
        placeholder={
          isChange
            ? "Search or select another rider on duty…"
            : "Search or select a rider on duty…"
        }
        disabled={isCommitting || isSubmitting}
        error={committer.error ?? undefined}
        emptyMessage="No riders are currently on an active shift."
      />
      <p
        role="status"
        className="min-h-5 text-sm font-medium text-bb-gray-600 dark:text-bb-gray-300"
      >
        {isCommitting ? "Allocating…" : null}
      </p>
    </div>
  );
}
