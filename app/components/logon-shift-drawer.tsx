import { useEffect, useState } from "react";

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
  const selectedBike = bikes.find((bike) => bike.id === bikeId);

  const trimmedStartMileage = startMileage.trim();
  const startMileageValue = Number(trimmedStartMileage);
  const hasStartMileage =
    trimmedStartMileage !== "" &&
    Number.isFinite(startMileageValue) &&
    startMileageValue >= 0;

  const hasVariance =
    !!selectedBike &&
    hasStartMileage &&
    startMileageValue !== selectedBike.lastRecordedMileage;

  const canSubmit =
    !!selectedRider &&
    !!selectedBike &&
    hasStartMileage &&
    (!hasVariance || varianceReason.trim() !== "");

  function handleClose() {
    onOpenChange(false);
  }

  function handleSubmit() {
    if (!selectedRider || !selectedBike || !canSubmit) return;

    onLogon({
      riderId: selectedRider.id,
      riderName: selectedRider.name,
      bikeId: selectedBike.id,
      bikeRegistration: selectedBike.registration,
      startMileage: startMileageValue,
      mileageVarianceReason: hasVariance ? varianceReason.trim() : undefined,
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
                className="h-11 text-base dark:bg-input/30"
                placeholder="e.g. 15234"
              />
              {selectedBike ? (
                <p className="text-sm text-bb-gray-500 dark:text-bb-gray-400">
                  Last recorded mileage: {selectedBike.lastRecordedMileage}
                </p>
              ) : null}
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
                      className="min-h-20 text-base dark:bg-input/30"
                      placeholder="e.g. Odometer reset after a repair"
                    />
                  </div>
                </CardContent>
              </Card>
            ) : null}
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
