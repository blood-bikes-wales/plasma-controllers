import { useEffect, useState } from "react";
import { z } from "zod";

import { BikeAssignmentFields } from "~/components/bike-assignment-fields";
import { SearchableSelectField } from "~/components/searchable-select-field";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import {
  type BikeOption,
  type RiderOption,
  useBikeAssignment,
} from "~/lib/bike-assignment";
import { fieldErrors } from "~/lib/validation";

/** The bike, start mileage and variance reason are only present when a bike was chosen. */
type LogonShiftInput = {
  riderId: string;
  riderName: string;
  bikeId?: string;
  bikeRegistration?: string;
  startMileage?: number;
  mileageVarianceReason?: string;
};

type LogonShiftDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  riders: RiderOption[];
  bikes: BikeOption[];
  onLogon: (input: LogonShiftInput) => void;
};

const SHEET_CONTENT_CLASS =
  "flex w-full max-w-full flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:max-w-full sm:max-w-xl data-[side=right]:sm:max-w-xl";

const logonRiderSchema = z.object({
  riderId: z.string().min(1, "Select a rider"),
});

export function LogonShiftDrawer({
  open,
  onOpenChange,
  riders,
  bikes,
  onLogon,
}: LogonShiftDrawerProps) {
  const [riderId, setRiderId] = useState<string | null>(null);

  const selectedRider = riders.find((rider) => rider.id === riderId);
  const bikeAssignment = useBikeAssignment({
    bikes,
    rider: selectedRider,
    optional: true,
  });
  const { reset: resetBikeAssignment } = bikeAssignment;

  useEffect(() => {
    if (!open) {
      setRiderId(null);
      resetBikeAssignment();
    }
  }, [open, resetBikeAssignment]);

  const riderResult = logonRiderSchema.safeParse({ riderId: riderId ?? "" });
  const errors = fieldErrors(riderResult);
  const canSubmit = riderResult.success && bikeAssignment.isValid;

  function handleClose() {
    onOpenChange(false);
  }

  /**
   * A chosen bike is dropped when it is not in any area the newly selected rider
   * covers. Clearing the rider keeps it: the bike field stays hidden until a rider
   * is chosen again, and "Change" always passes through no rider.
   */
  function handleRiderChange(nextRiderId: string | null) {
    setRiderId(nextRiderId);
    if (nextRiderId === null) return;

    bikeAssignment.keepBikeFor(
      riders.find((rider) => rider.id === nextRiderId),
    );
  }

  function handleSubmit() {
    if (!canSubmit || !selectedRider) return;

    onLogon({
      riderId: selectedRider.id,
      riderName: selectedRider.name,
      ...bikeAssignment.assignment,
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={SHEET_CONTENT_CLASS}>
        <SheetHeader className="shrink-0 border-b border-bb-gray-100 px-5 py-4 pr-12 text-left dark:border-bb-gray-700">
          <SheetTitle className="text-xl font-extrabold text-bb-gray-900 dark:text-bb-gray-100">
            Log on rider
          </SheetTitle>
          <SheetDescription>
            Record who is starting a shift. The bike and its starting mileage
            can be added now or assigned later.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto scroll-pb-10 px-5 py-5 pb-10">
            <SearchableSelectField
              id="logon-rider"
              label="Rider"
              value={riderId}
              onChange={handleRiderChange}
              options={riders.map((rider) => ({
                value: rider.id,
                label: rider.name,
              }))}
              placeholder="Search or select rider…"
              error={errors.riderId}
              emptyMessage="Every rider is already on shift."
            />

            <BikeAssignmentFields
              idPrefix="logon"
              state={bikeAssignment}
              rider={selectedRider}
              bikePlaceholder="Optional: search or select bike…"
            />
          </div>

          <SheetFooter className="shrink-0 gap-3 border-t border-bb-gray-100 bg-bb-white px-5 py-4 dark:border-bb-gray-700 dark:bg-card">
            <Button
              type="button"
              className="h-12 w-full rounded-bb-button text-base font-bold"
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              Log on
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full rounded-bb-button text-base font-semibold"
              onClick={handleClose}
            >
              Cancel
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export type { BikeOption, LogonShiftDrawerProps, LogonShiftInput, RiderOption };
