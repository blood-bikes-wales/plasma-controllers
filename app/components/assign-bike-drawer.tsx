import { useEffect } from "react";

import { BikeAssignmentFields } from "~/components/bike-assignment-fields";
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
  type BikeAssignment,
  type BikeOption,
  type RiderOption,
  useBikeAssignment,
} from "~/lib/bike-assignment";

type AssignBikeShiftSummary = {
  id: string;
  riderName: string;
};

type AssignBikeDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift?: AssignBikeShiftSummary;
  /** The rider on the shift, whose areas limit the bikes offered. */
  rider?: RiderOption;
  /** Bikes not already on a shift. */
  bikes: BikeOption[];
  onAssign: (shiftId: string, assignment: BikeAssignment) => void;
};

const SHEET_CONTENT_CLASS =
  "flex w-full max-w-full flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:max-w-full sm:max-w-xl data-[side=right]:sm:max-w-xl";

/** Picks a bike and start mileage for a rider who was logged on without one. */
export function AssignBikeDrawer({
  open,
  onOpenChange,
  shift,
  rider,
  bikes,
  onAssign,
}: AssignBikeDrawerProps) {
  const bikeAssignment = useBikeAssignment({ bikes, rider, optional: false });
  const { reset: resetBikeAssignment } = bikeAssignment;

  useEffect(() => {
    if (!open) {
      resetBikeAssignment();
    }
  }, [open, resetBikeAssignment]);

  const { assignment } = bikeAssignment;
  const canSubmit = !!shift && !!assignment;

  function handleSubmit() {
    if (!shift || !assignment) return;

    onAssign(shift.id, assignment);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={SHEET_CONTENT_CLASS}>
        <SheetHeader className="shrink-0 border-b border-bb-gray-100 px-5 py-4 pr-12 text-left dark:border-bb-gray-700">
          <SheetTitle className="text-xl font-extrabold text-bb-gray-900 dark:text-bb-gray-100">
            Assign bike
          </SheetTitle>
          <SheetDescription>
            {shift
              ? `Choose the bike ${shift.riderName} is using and its starting mileage.`
              : "Choose the bike this rider is using and its starting mileage."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto scroll-pb-10 px-5 py-5 pb-10">
            <BikeAssignmentFields
              idPrefix="assign"
              state={bikeAssignment}
              rider={rider}
            />
          </div>

          <SheetFooter className="shrink-0 gap-3 border-t border-bb-gray-100 bg-bb-white px-5 py-4 dark:border-bb-gray-700 dark:bg-card">
            <Button
              type="button"
              className="h-12 w-full rounded-bb-button text-base font-bold"
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              Assign bike
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full rounded-bb-button text-base font-semibold"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export type { AssignBikeDrawerProps, AssignBikeShiftSummary };
