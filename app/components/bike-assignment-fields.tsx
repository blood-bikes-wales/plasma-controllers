import { TriangleAlert } from "lucide-react";

import { FieldError } from "~/components/field-error";
import { SearchableSelectField } from "~/components/searchable-select-field";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  type BikeAssignmentState,
  noBikesMessage,
  type RiderOption,
} from "~/lib/bike-assignment";
import { formatShiftStartedAt } from "~/lib/shifts";

type BikeAssignmentFieldsProps = {
  /** Prefix for the element ids, e.g. `logon` gives `logon-bike`. */
  idPrefix: string;
  /** From `useBikeAssignment`. */
  state: BikeAssignmentState;
  rider: RiderOption | undefined;
  /** Shown in the bike field before a bike is chosen. */
  bikePlaceholder?: string;
};

/**
 * The bike (limited to the rider's areas), the note left at the last log off on
 * it, its prefilled start mileage and the mileage variance reason. The note and
 * mileage fields appear once a bike is chosen.
 */
export function BikeAssignmentFields({
  idPrefix,
  state,
  rider,
  bikePlaceholder = "Search or select bike…",
}: BikeAssignmentFieldsProps) {
  const { errors } = state;

  return (
    <>
      <SearchableSelectField
        id={`${idPrefix}-bike`}
        label="Bike"
        value={state.bikeId}
        onChange={state.selectBike}
        options={state.riderBikes.map((bike) => ({
          value: bike.id,
          label: bike.registration,
        }))}
        placeholder={bikePlaceholder}
        error={errors.bikeId}
        emptyMessage={noBikesMessage(rider)}
      />

      {state.selectedBike?.lastShiftNote ? (
        <Card
          data-testid="last-shift-note"
          className="rounded-bb-card border-2 border-bb-warning bg-bb-warning-light py-0 shadow-none dark:bg-bb-warning/20"
        >
          <CardContent className="flex gap-3 p-4">
            <TriangleAlert
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-bb-warning"
            />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-bb-warning">
                Note from the last shift on {state.selectedBike.registration}
              </p>
              <p className="whitespace-pre-wrap text-sm text-bb-gray-900 dark:text-bb-gray-100">
                {state.selectedBike.lastShiftNote}
              </p>
              {state.selectedBike.lastShiftNoteAt ? (
                <p className="text-xs text-bb-gray-700 dark:text-bb-gray-300">
                  Left{" "}
                  {formatShiftStartedAt(state.selectedBike.lastShiftNoteAt)}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {state.selectedBike ? (
        <div className="space-y-2">
          <Label
            htmlFor={`${idPrefix}-start-mileage`}
            className="text-bb-gray-700 dark:text-bb-gray-300"
          >
            Start mileage
          </Label>
          <Input
            id={`${idPrefix}-start-mileage`}
            type="number"
            inputMode="numeric"
            min={0}
            value={state.startMileage}
            onChange={(event) => state.setStartMileage(event.target.value)}
            aria-invalid={!!errors.startMileage}
            className="h-11 text-base dark:bg-input/30"
            placeholder="e.g. 15234"
          />
          <FieldError message={errors.startMileage} />
        </div>
      ) : null}

      {state.hasVariance ? (
        <Card className="rounded-bb-card border-2 border-bb-warning bg-bb-warning-light py-0 shadow-none dark:bg-bb-warning/20">
          <CardContent className="space-y-3 p-4">
            <p className="text-sm font-semibold text-bb-warning">
              Start mileage does not match this bike's last recorded mileage. A
              reason is required.
            </p>
            <div className="space-y-2">
              <Label
                htmlFor={`${idPrefix}-variance-reason`}
                className="text-bb-gray-700 dark:text-bb-gray-300"
              >
                Reason for the mileage difference
              </Label>
              <Textarea
                id={`${idPrefix}-variance-reason`}
                value={state.varianceReason}
                onChange={(event) =>
                  state.setVarianceReason(event.target.value)
                }
                aria-invalid={!!errors.mileageVarianceReason}
                className="min-h-20 text-base dark:bg-input/30"
                placeholder="e.g. Odometer reset after a repair"
              />
              <FieldError message={errors.mileageVarianceReason} />
            </div>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
