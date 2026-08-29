import { apiFetch } from "~/lib/api-client";

export type Bike = {
  id: string;
  registration: string;
  lastRecordedMileage: number;
};

export type RiderOption = { id: string; name: string };

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

export type LogoffShiftPayload = {
  endMileage: number;
  faults?: string;
};

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
