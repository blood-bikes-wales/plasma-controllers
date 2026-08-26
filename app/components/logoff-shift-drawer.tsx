import { useEffect, useState } from "react";
import { z } from "zod";

import { FieldError } from "~/components/field-error";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Textarea } from "~/components/ui/textarea";
import { fieldErrors } from "~/lib/validation";

type LogoffShiftSummary = {
  id: string;
  riderName: string;
  bikeRegistration: string;
  startMileage: number;
  startedAt: string;
};

type LogoffShiftResult = {
  endMileage: number;
  faults?: string;
};

type LogoffShiftDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift?: LogoffShiftSummary;
  onLogoff: (shiftId: string, result: LogoffShiftResult) => void;
};

const SHEET_CONTENT_CLASS =
  "flex w-full max-w-full flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:max-w-full sm:max-w-xl data-[side=right]:sm:max-w-xl";

/** Requires end mileage to be a valid number no lower than `startMileage`. */
function createLogoffShiftSchema(startMileage: number) {
  return z.object({
    endMileage: z
      .string()
      .trim()
      .min(1, "Enter the end mileage")
      .superRefine((value, ctx) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
          ctx.addIssue({ code: "custom", message: "Enter a valid mileage" });
          return;
        }
        if (numeric < startMileage) {
          ctx.addIssue({
            code: "custom",
            message: `End mileage cannot be lower than the start mileage of ${startMileage}.`,
          });
        }
      }),
    faults: z.string(),
  });
}

export function LogoffShiftDrawer({
  open,
  onOpenChange,
  shift,
  onLogoff,
}: LogoffShiftDrawerProps) {
  const [endMileage, setEndMileage] = useState("");
  const [faults, setFaults] = useState("");

  useEffect(() => {
    if (!open) {
      setEndMileage("");
      setFaults("");
    }
  }, [open]);

  const schema = createLogoffShiftSchema(shift?.startMileage ?? 0);
  const result = schema.safeParse({ endMileage, faults });
  const errors = fieldErrors(result);
  const canSubmit = !!shift && result.success;

  function handleClose() {
    onOpenChange(false);
  }

  function handleSubmit() {
    if (!shift || !result.success) return;

    onLogoff(shift.id, {
      endMileage: Number(result.data.endMileage),
      faults: result.data.faults.trim() || undefined,
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={SHEET_CONTENT_CLASS}>
        <SheetHeader className="shrink-0 border-b border-bb-gray-100 px-5 py-4 text-left dark:border-bb-gray-700">
          <SheetTitle className="text-xl font-extrabold text-bb-gray-900 dark:text-bb-gray-100">
            Log off rider
          </SheetTitle>
          <SheetDescription>
            {shift
              ? `Record the end mileage and any faults for ${shift.riderName}'s shift on ${shift.bikeRegistration}.`
              : "Record the end mileage and any faults for this shift."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            <div className="space-y-1 text-sm text-bb-gray-500 dark:text-bb-gray-400">
              <p>
                Started{" "}
                <span className="font-semibold text-bb-gray-900 dark:text-bb-gray-100">
                  {shift?.startedAt}
                </span>{" "}
                at{" "}
                <span className="font-semibold text-bb-gray-900 dark:text-bb-gray-100">
                  {shift?.startMileage}
                </span>{" "}
                miles.
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="logoff-end-mileage"
                className="text-bb-gray-700 dark:text-bb-gray-300"
              >
                End mileage
              </Label>
              <Input
                id="logoff-end-mileage"
                type="number"
                inputMode="numeric"
                min={0}
                value={endMileage}
                onChange={(event) => setEndMileage(event.target.value)}
                className="h-11 text-base dark:bg-input/30"
                placeholder="e.g. 15298"
                aria-invalid={!!errors.endMileage}
              />
              <FieldError message={errors.endMileage} />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="logoff-faults"
                className="text-bb-gray-700 dark:text-bb-gray-300"
              >
                Faults{" "}
                <span className="font-normal text-bb-gray-500">(optional)</span>
              </Label>
              <Textarea
                id="logoff-faults"
                value={faults}
                onChange={(event) => setFaults(event.target.value)}
                className="min-h-20 text-base dark:bg-input/30"
                placeholder="e.g. Rear brake feels soft"
              />
            </div>
          </div>

          <SheetFooter className="shrink-0 gap-3 border-t border-bb-gray-100 bg-bb-white px-5 py-4 dark:border-bb-gray-700 dark:bg-card">
            <Button
              type="button"
              className="h-12 w-full rounded-bb-button text-base font-bold"
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              Log off
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

export type { LogoffShiftDrawerProps, LogoffShiftResult, LogoffShiftSummary };
