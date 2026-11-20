import { useCallback, useState } from "react";
import { z } from "zod";

import { fieldErrors } from "~/lib/validation";

/** `areas` are the service-area codes the rider covers; compared with `BikeOption.area`. */
export type RiderOption = { id: string; name: string; areas: string[] };

export type BikeOption = {
  id: string;
  registration: string;
  /** Service-area code the bike belongs to. */
  area?: string;
  lastRecordedMileage: number;
  /** Faults entered when the last rider on this bike logged off, if any. */
  lastShiftNote?: string | null;
  /** ISO time that last shift ended. */
  lastShiftNoteAt?: string | null;
};

/** A bike picked for a rider with the mileage it starts from. */
export type BikeAssignment = {
  bikeId: string;
  bikeRegistration: string;
  startMileage: number;
  mileageVarianceReason?: string;
};

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
export function bikesInRiderAreas(
  bikes: BikeOption[],
  rider: RiderOption | undefined,
): BikeOption[] {
  if (!rider) return [];

  return bikes.filter(
    (bike) => bike.area !== undefined && rider.areas.includes(bike.area),
  );
}

export function noBikesMessage(rider: RiderOption | undefined): string {
  if (!rider) return "Select a rider to see the bikes in their area.";
  if (rider.areas.length === 0) {
    return "This rider has no area role in Three Rings, so no bike can be assigned.";
  }
  return "No bikes are available in this rider's area.";
}

/** Requires a variance reason once the start mileage differs from `bike.lastRecordedMileage`. */
function createBikeAssignmentSchema(bikes: BikeOption[]) {
  return z
    .object({
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

/**
 * The bike-picking state shared by the logon and assign-bike drawers: a bike
 * from the rider's areas, its prefilled start mileage and the variance reason.
 *
 * With `optional` set, leaving the bike empty is valid (`assignment` is null
 * and `isValid` is true); otherwise a bike is required.
 */
export function useBikeAssignment({
  bikes,
  rider,
  optional,
}: {
  bikes: BikeOption[];
  rider: RiderOption | undefined;
  optional: boolean;
}) {
  const [bikeId, setBikeId] = useState<string | null>(null);
  const [startMileage, setStartMileage] = useState("");
  const [varianceReason, setVarianceReason] = useState("");

  const riderBikes = bikesInRiderAreas(bikes, rider);
  const selectedBike = riderBikes.find((bike) => bike.id === bikeId);
  const startMileageValue = Number(startMileage.trim());
  const hasVariance =
    !!selectedBike &&
    startMileage.trim() !== "" &&
    Number.isFinite(startMileageValue) &&
    startMileageValue !== selectedBike.lastRecordedMileage;

  const skipped = optional && !selectedBike;
  const result = createBikeAssignmentSchema(riderBikes).safeParse({
    bikeId: selectedBike?.id ?? "",
    startMileage,
    mileageVarianceReason: varianceReason,
  });
  const errors = skipped ? {} : fieldErrors(result);
  const isValid = skipped || result.success;
  const assignment: BikeAssignment | null =
    selectedBike && result.success
      ? {
          bikeId: selectedBike.id,
          bikeRegistration: selectedBike.registration,
          startMileage: Number(result.data.startMileage),
          mileageVarianceReason: hasVariance
            ? result.data.mileageVarianceReason.trim()
            : undefined,
        }
      : null;

  const reset = useCallback(() => {
    setBikeId(null);
    setStartMileage("");
    setVarianceReason("");
  }, []);

  /**
   * Choosing a different bike replaces the start mileage with that bike's last
   * recorded figure (and drops any variance reason written for the old bike);
   * clearing the bike empties it. Re-choosing the same bike keeps any edit.
   */
  function selectBike(nextBikeId: string | null) {
    if (nextBikeId === bikeId) return;

    const nextBike = bikes.find((bike) => bike.id === nextBikeId);
    setBikeId(nextBikeId);
    setStartMileage(nextBike ? String(nextBike.lastRecordedMileage) : "");
    setVarianceReason("");
  }

  /** Drops the chosen bike unless it is in an area `nextRider` covers. */
  function keepBikeFor(nextRider: RiderOption | undefined) {
    const stillValid = bikesInRiderAreas(bikes, nextRider).some(
      (bike) => bike.id === bikeId,
    );
    if (!stillValid) selectBike(null);
  }

  return {
    bikeId,
    riderBikes,
    selectedBike,
    startMileage,
    varianceReason,
    hasVariance,
    errors,
    isValid,
    assignment,
    setStartMileage,
    setVarianceReason,
    selectBike,
    keepBikeFor,
    reset,
  };
}

export type BikeAssignmentState = ReturnType<typeof useBikeAssignment>;
