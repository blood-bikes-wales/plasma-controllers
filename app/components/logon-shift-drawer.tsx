import { useEffect, useState } from "react";
import { z } from "zod";

import { FieldError } from "~/components/field-error";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
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

type RiderOption = { id: string; name: string };

type BikeOption = {
  id: string;
  registration: string;
  lastRecordedMileage: number;
};

type LogonShiftInput = {
  riderId: string;
  riderName: string;
  bikeId: string;
  bikeRegistration: string;
  startMileage: number;
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

const mileageFieldSchema = z
  .string()
  .trim()
  .min(1, "Enter the start mileage")
  .superRefine((value, ctx) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
      ctx.addIssue({ code: "custom", message: "Enter a valid mileage" });
    }
  });

/** Requires a variance reason once the start mileage differs from `bike.lastRecordedMileage`. */
function createLogonShiftSchema(bikes: BikeOption[]) {
  return z
    .object({
      riderId: z.string().min(1, "Select a rider"),
      bikeId: z.string().min(1, "Select a bike"),
      startMileage: mileageFieldSchema,
      mileageVarianceReason: z.string(),
    })
    .superRefine((data, ctx) => {
      const bike = bikes.find((candidate) => candidate.id === data.bikeId);
      const startMileageValue = Number(data.startMileage);
      if (
        bike &&
        Number.isFinite(startMileageValue) &&
        startMileageValue !== bike.lastRecordedMileage &&
        data.mileageVarianceReason.trim() === ""
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["mileageVarianceReason"],
          message: "Enter a reason for the mileage difference",
        });
      }
    });
}

export function LogonShiftDrawer({
  open,
  onOpenChange,
  riders,
  bikes,
  onLogon,
}: LogonShiftDrawerProps) {
  const [riderId, setRiderId] = useState<string | null>(null);
  const [bikeId, setBikeId] = useState<string | null>(null);
  const [startMileage, setStartMileage] = useState("");
  const [varianceReason, setVarianceReason] = useState("");

  useEffect(() => {
    if (!open) {
      setRiderId(null);
      setBikeId(null);
      setStartMileage("");
      setVarianceReason("");
    }
  }, [open]);

  const selectedBike = bikes.find((bike) => bike.id === bikeId);
  const startMileageValue = Number(startMileage.trim());
  const hasVariance =
    !!selectedBike &&
    startMileage.trim() !== "" &&
    Number.isFinite(startMileageValue) &&
    startMileageValue !== selectedBike.lastRecordedMileage;

  const schema = createLogonShiftSchema(bikes);
  const result = schema.safeParse({
    riderId: riderId ?? "",
    bikeId: bikeId ?? "",
    startMileage,
    mileageVarianceReason: varianceReason,
  });
  const errors = fieldErrors(result);

  function handleClose() {
    onOpenChange(false);
  }

  function handleSubmit() {
    if (!result.success) return;

    const rider = riders.find(
      (candidate) => candidate.id === result.data.riderId,
    );
    const bike = bikes.find((candidate) => candidate.id === result.data.bikeId);
    if (!rider || !bike) return;

    onLogon({
      riderId: rider.id,
      riderName: rider.name,
      bikeId: bike.id,
      bikeRegistration: bike.registration,
      startMileage: Number(result.data.startMileage),
      mileageVarianceReason: hasVariance
        ? result.data.mileageVarianceReason.trim()
        : undefined,
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={SHEET_CONTENT_CLASS}>
        <SheetHeader className="shrink-0 border-b border-bb-gray-100 px-5 py-4 text-left dark:border-bb-gray-700">
          <SheetTitle className="text-xl font-extrabold text-bb-gray-900 dark:text-bb-gray-100">
            Log on rider
          </SheetTitle>
          <SheetDescription>
            Record who is starting a shift, which bike they are using and the
            starting mileage.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            <div className="space-y-2">
              <Label
                htmlFor="logon-rider"
                className="text-bb-gray-700 dark:text-bb-gray-300"
              >
                Rider
              </Label>
              <Select value={riderId} onValueChange={setRiderId}>
                <SelectTrigger
                  id="logon-rider"
                  aria-invalid={!!errors.riderId}
                  className="h-11 w-full text-base dark:bg-input/30"
                >
                  <SelectValue placeholder="Search or select rider…" />
                </SelectTrigger>
                <SelectContent>
                  {riders.map((rider) => (
                    <SelectItem key={rider.id} value={rider.id}>
                      {rider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {riders.length === 0 ? (
                <p className="text-sm text-bb-gray-500 dark:text-bb-gray-400">
                  Every rider is already on shift.
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="logon-bike"
                className="text-bb-gray-700 dark:text-bb-gray-300"
              >
                Bike
              </Label>
              <Select value={bikeId} onValueChange={setBikeId}>
                <SelectTrigger
                  id="logon-bike"
                  aria-invalid={!!errors.bikeId}
                  className="h-11 w-full text-base dark:bg-input/30"
                >
                  <SelectValue placeholder="Search or select bike…" />
                </SelectTrigger>
                <SelectContent>
                  {bikes.map((bike) => (
                    <SelectItem key={bike.id} value={bike.id}>
                      {bike.registration}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {bikes.length === 0 ? (
                <p className="text-sm text-bb-gray-500 dark:text-bb-gray-400">
                  Every bike is already on shift.
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="logon-start-mileage"
                className="text-bb-gray-700 dark:text-bb-gray-300"
              >
                Start mileage
              </Label>
              <Input
                id="logon-start-mileage"
                type="number"
                inputMode="numeric"
                min={0}
                value={startMileage}
                onChange={(event) => setStartMileage(event.target.value)}
                aria-invalid={!!errors.startMileage}
                className="h-11 text-base dark:bg-input/30"
                placeholder="e.g. 15234"
              />
              {selectedBike ? (
                <p className="text-sm text-bb-gray-500 dark:text-bb-gray-400">
                  Last recorded mileage: {selectedBike.lastRecordedMileage}
                </p>
              ) : null}
              <FieldError message={errors.startMileage} />
            </div>

            {hasVariance ? (
              <Card className="rounded-bb-card border-2 border-bb-warning bg-bb-warning-light py-0 shadow-none dark:bg-bb-warning/20">
                <CardContent className="space-y-3 p-4">
                  <p className="text-sm font-semibold text-bb-warning">
                    Start mileage does not match this bike's last recorded
                    mileage. A reason is required.
                  </p>
                  <div className="space-y-2">
                    <Label
                      htmlFor="logon-variance-reason"
                      className="text-bb-gray-700 dark:text-bb-gray-300"
                    >
                      Reason for the mileage difference
                    </Label>
                    <Textarea
                      id="logon-variance-reason"
                      value={varianceReason}
                      onChange={(event) =>
                        setVarianceReason(event.target.value)
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
          </div>

          <SheetFooter className="shrink-0 gap-3 border-t border-bb-gray-100 bg-bb-white px-5 py-4 dark:border-bb-gray-700 dark:bg-card">
            <Button
              type="button"
              className="h-12 w-full rounded-bb-button text-base font-bold"
              disabled={!result.success}
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
