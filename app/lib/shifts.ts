import { apiFetch } from "~/lib/api-client";

export type Bike = {
  id: string;
  registration: string;
  area?: string;
  status?: "active" | "retired";
  lastRecordedMileage: number;
};

/**
 * A rider offered at logon. `areas` holds the service-area codes the rider
 * covers (from their Three Rings `Rider - <area>` roles), matching `Bike.area`.
 */
export type RiderOption = { id: string; name: string; areas: string[] };

export type ActiveShift = {
  id: string;
  riderId: string;
  riderName: string;
  bikeId: string;
  bikeRegistration: string;
  startMileage: number;
  startedAt: string;
  mileageVarianceReason?: string | null;
};

export type LogonShiftPayload = {
  riderId: string;
  bikeId: string;
  startMileage: number;
  mileageVarianceReason?: string;
};

/** Where the bike was left when the rider logged off. */
export type BikeKeptAt = "lockup" | "home";

export type LogoffShiftPayload = {
  endMileage: number;
  faults?: string;
  bikeKeptAt: BikeKeptAt;
  /** Only sent when the mileage change reaches `SILLY_MILEAGE_THRESHOLD`. */
  mileageExplanation?: string;
};

/**
 * A change in mileage over one shift (end - start) at or above this needs an
 * explanation at logoff. Keep in sync with `OperationalShiftService::SILLY_MILEAGE_THRESHOLD`
 * in plasma-api.
 */
export const SILLY_MILEAGE_THRESHOLD = 500;

export function isSillyMileageChange(
  startMileage: number,
  endMileage: number,
): boolean {
  return endMileage - startMileage >= SILLY_MILEAGE_THRESHOLD;
}

type DataList<T> = { data: T[] };

export async function fetchActiveShifts(): Promise<ActiveShift[]> {
  const body = await apiFetch<DataList<ActiveShift>>("/shifts/active");
  return body.data;
}

export async function fetchBikes(): Promise<Bike[]> {
  const body = await apiFetch<DataList<Bike>>("/bikes");
  return body.data;
}

export async function fetchVolunteers(): Promise<RiderOption[]> {
  const body = await apiFetch<DataList<RiderOption>>("/volunteers");
  return body.data;
}

export async function logonShift(
  payload: LogonShiftPayload,
): Promise<ActiveShift> {
  return apiFetch<ActiveShift>("/shifts/logon", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function logoffShift(
  shiftId: string,
  payload: LogoffShiftPayload,
): Promise<ActiveShift> {
  return apiFetch<ActiveShift>(`/shifts/${shiftId}/logoff`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Format an ISO timestamp the way the shifts UI shows "Since …". */
export function formatShiftStartedAt(startedAt: string): string {
  const date = new Date(startedAt);
  if (Number.isNaN(date.getTime())) {
    return startedAt;
  }

  const time = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  if (sameDay) {
    return `Today, ${time}`;
  }

  const day = date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
  return `${day}, ${time}`;
}

export function errorMessage(error: unknown, fallback: string): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.length > 0
  ) {
    return error.message;
  }

  return fallback;
}
