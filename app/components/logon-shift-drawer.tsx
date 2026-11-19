import { useEffect, useState } from "react";
import { z } from "zod";

import { FieldError } from "~/components/field-error";
import { SearchableSelectField } from "~/components/searchable-select-field";
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
import { Textarea } from "~/components/ui/textarea";
import { fieldErrors } from "~/lib/validation";

/** `areas` are the service-area codes the rider covers; compared with `BikeOption.area`. */
type RiderOption = { id: string; name: string; areas: string[] };

type BikeOption = {
  id: string;
  registration: string;
  /** Service-area code the bike belongs to. */
  area?: string;
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

/** Bikes the rider may use: those in any area they cover. No rider, or no areas, means no bikes. */
function bikesInRiderAreas(
  bikes: BikeOption[],
  rider: RiderOption | undefined,
): BikeOption[] {
  if (!rider) return [];

  return bikes.filter(
    (bike) => bike.area !== undefined && rider.areas.includes(bike.area),
  );
}

function noBikesMessage(rider: RiderOption | undefined): string {
  if (!rider) return "Select a rider to see the bikes in their area.";
  if (rider.areas.length === 0) {
    return "This rider has no area role in Three Rings, so no bike can be assigned.";
  }
  return "No bikes are available in this rider's area.";
}

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

  const selectedRider = riders.find((rider) => rider.id === riderId);
  const riderBikes = bikesInRiderAreas(bikes, selectedRider);
  const selectedBike = riderBikes.find((bike) => bike.id === bikeId);
  const startMileageValue = Number(startMileage.trim());
  const hasVariance =
    !!selectedBike &&
    startMileage.trim() !== "" &&
    Number.isFinite(startMileageValue) &&
    startMileageValue !== selectedBike.lastRecordedMileage;

  const schema = createLogonShiftSchema(riderBikes);
  const result = schema.safeParse({
    riderId: riderId ?? "",
    bikeId: selectedBike?.id ?? "",
    startMileage,
    mileageVarianceReason: varianceReason,
  });
  const errors = fieldErrors(result);

  function handleClose() {
    onOpenChange(false);
  }

  /**
   * Choosing a different bike replaces the start mileage with that bike's last
   * recorded figure (and drops any variance reason written for the old bike);
   * clearing the bike empties it. Re-choosing the same bike keeps any edit.
   */
  function handleBikeChange(nextBikeId: string | null) {
    if (nextBikeId === bikeId) return;

    const nextBike = bikes.find((bike) => bike.id === nextBikeId);
    setBikeId(nextBikeId);
    setStartMileage(nextBike ? String(nextBike.lastRecordedMileage) : "");
    setVarianceReason("");
  }

  /**
   * A chosen bike is dropped when it is not in any area the newly selected rider
   * covers. Clearing the rider keeps it: the bike field stays hidden until a rider
   * is chosen again, and "Change" always passes through no rider.
   */
  function handleRiderChange(nextRiderId: string | null) {
    setRiderId(nextRiderId);
    if (nextRiderId === null) return;

    const nextRider = riders.find((rider) => rider.id === nextRiderId);
    const stillValid = bikesInRiderAreas(bikes, nextRider).some(
      (bike) => bike.id === bikeId,
    );
    if (!stillValid) handleBikeChange(null);
  }

  function handleSubmit() {
    if (!result.success) return;

    const rider = riders.find(
      (candidate) => candidate.id === result.data.riderId,
    );
    const bike = riderBikes.find(
      (candidate) => candidate.id === result.data.bikeId,
    );
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
        <SheetHeader className="shrink-0 border-b border-bb-gray-100 px-5 py-4 pr-12 text-left dark:border-bb-gray-700">
          <SheetTitle className="text-xl font-extrabold text-bb-gray-900 dark:text-bb-gray-100">
            Log on rider
          </SheetTitle>
          <SheetDescription>
            Record who is starting a shift, which bike they are using and the
            starting mileage.
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

            <SearchableSelectField
              id="logon-bike"
              label="Bike"
              value={bikeId}
              onChange={handleBikeChange}
              options={riderBikes.map((bike) => ({
                value: bike.id,
                label: bike.registration,
              }))}
              placeholder="Search or select bike…"
              error={errors.bikeId}
              emptyMessage={noBikesMessage(selectedRider)}
            />

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
