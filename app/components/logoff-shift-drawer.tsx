import { useEffect, useState } from "react";
import { z } from "zod";

import { FieldError } from "~/components/field-error";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
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
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { isSillyMileageChange, type LogoffShiftPayload } from "~/lib/shifts";
import { fieldErrors } from "~/lib/validation";

type LogoffShiftSummary = {
  id: string;
  riderName: string;
  /** Null when the rider never had a bike: no mileage or bike location is asked for. */
  bikeRegistration: string | null;
  startMileage: number | null;
  startedAt: string;
};

type LogoffShiftResult = LogoffShiftPayload;

type LogoffShiftDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift?: LogoffShiftSummary;
  onLogoff: (shiftId: string, result: LogoffShiftResult) => void;
};

const SHEET_CONTENT_CLASS =
  "flex w-full max-w-full flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:max-w-full sm:max-w-xl data-[side=right]:sm:max-w-xl";

/**
 * The mileage change over the shift, or null while the end mileage is blank or
 * not a number.
 */
function mileageChange(startMileage: number, endMileage: string) {
  const trimmed = endMileage.trim();
  const numeric = Number(trimmed);
  if (trimmed === "" || !Number.isFinite(numeric)) return null;
  return numeric - startMileage;
}

/**
 * Requires end mileage to be a valid number no lower than `startMileage`, and
 * an explanation when the change reaches the silly mileage threshold.
 */
function createLogoffShiftSchema(startMileage: number) {
  return z
    .object({
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
      mileageExplanation: z.string(),
    })
    .superRefine((data, ctx) => {
      const change = mileageChange(startMileage, data.endMileage);
      if (
        change !== null &&
        isSillyMileageChange(startMileage, startMileage + change) &&
        data.mileageExplanation.trim() === ""
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["mileageExplanation"],
          message: "Enter a reason for the mileage change",
        });
      }
    });
}

/** A shift with no bike only has optional faults to record. */
const logoffWithoutBikeSchema = z.object({
  endMileage: z.string(),
  faults: z.string(),
  mileageExplanation: z.string(),
});

export function LogoffShiftDrawer({
  open,
  onOpenChange,
  shift,
  onLogoff,
}: LogoffShiftDrawerProps) {
  const [endMileage, setEndMileage] = useState("");
  const [faults, setFaults] = useState("");
  const [keptAtHome, setKeptAtHome] = useState(false);
  const [mileageExplanation, setMileageExplanation] = useState("");

  useEffect(() => {
    if (!open) {
      setEndMileage("");
      setFaults("");
      setKeptAtHome(false);
      setMileageExplanation("");
    }
  }, [open]);

  const hasBike = shift?.startMileage !== null;
  const startMileage = shift?.startMileage ?? 0;
  const change = hasBike ? mileageChange(startMileage, endMileage) : null;
  const needsExplanation =
    change !== null &&
    isSillyMileageChange(startMileage, startMileage + change);

  useEffect(() => {
    if (!needsExplanation) {
      setMileageExplanation("");
    }
  }, [needsExplanation]);

  const schema = hasBike
    ? createLogoffShiftSchema(startMileage)
    : logoffWithoutBikeSchema;
  const result = schema.safeParse({ endMileage, faults, mileageExplanation });
  const errors = fieldErrors(result);
  const canSubmit = !!shift && result.success;

  function handleClose() {
    onOpenChange(false);
  }

  function handleSubmit() {
    if (!shift || !result.success) return;

    if (!hasBike) {
      onLogoff(shift.id, { faults: result.data.faults.trim() || undefined });
      return;
    }

    onLogoff(shift.id, {
      endMileage: Number(result.data.endMileage),
      faults: result.data.faults.trim() || undefined,
      bikeKeptAt: keptAtHome ? "home" : "lockup",
      ...(needsExplanation
        ? { mileageExplanation: result.data.mileageExplanation.trim() }
        : {}),
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={SHEET_CONTENT_CLASS}>
        <SheetHeader className="shrink-0 border-b border-bb-gray-100 px-5 py-4 pr-12 text-left dark:border-bb-gray-700">
          <SheetTitle className="text-xl font-extrabold text-bb-gray-900 dark:text-bb-gray-100">
            Log off rider
          </SheetTitle>
          <SheetDescription>
            {shift?.bikeRegistration
              ? `Record the end mileage and any faults for ${shift.riderName}'s shift on ${shift.bikeRegistration}.`
              : shift
                ? `Record any faults for ${shift.riderName}'s shift. No bike was assigned.`
                : "Record the end mileage and any faults for this shift."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto scroll-pb-10 px-5 py-5 pb-10">
            <div className="space-y-1 text-sm text-bb-gray-500 dark:text-bb-gray-400">
              <p>
                Started{" "}
                <span className="font-semibold text-bb-gray-900 dark:text-bb-gray-100">
                  {shift?.startedAt}
                </span>
                {hasBike ? (
                  <>
                    {" "}
                    at{" "}
                    <span className="font-semibold text-bb-gray-900 dark:text-bb-gray-100">
                      {shift?.startMileage}
                    </span>{" "}
                    miles.
                  </>
                ) : (
                  "."
                )}
              </p>
            </div>

            {hasBike ? (
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
            ) : null}

            {needsExplanation ? (
              <Card className="rounded-bb-card border-2 border-bb-warning bg-bb-warning-light py-0 shadow-none dark:bg-bb-warning/20">
                <CardContent className="space-y-3 p-4">
                  <p className="text-sm font-semibold text-bb-warning">
                    This is a change of {change} miles over one shift. A reason
                    is required.
                  </p>
                  <div className="space-y-2">
                    <Label
                      htmlFor="logoff-mileage-explanation"
                      className="text-bb-gray-700 dark:text-bb-gray-300"
                    >
                      Reason for the mileage
                    </Label>
                    <Textarea
                      id="logoff-mileage-explanation"
                      value={mileageExplanation}
                      onChange={(event) =>
                        setMileageExplanation(event.target.value)
                      }
                      aria-invalid={!!errors.mileageExplanation}
                      className="min-h-20 text-base dark:bg-input/30"
                      placeholder="e.g. Long distance transfer"
                    />
                    <FieldError message={errors.mileageExplanation} />
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {hasBike ? (
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="logoff-bike-location"
                    className="text-bb-gray-700 dark:text-bb-gray-300"
                  >
                    Bike location
                  </Label>
                  <p className="text-sm text-bb-gray-500 dark:text-bb-gray-400">
                    {keptAtHome ? "Kept at home overnight" : "Lockup"}
                  </p>
                </div>
                <Switch
                  id="logoff-bike-location"
                  checked={keptAtHome}
                  onCheckedChange={setKeptAtHome}
                />
              </div>
            ) : null}

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
