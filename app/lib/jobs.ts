import { ApiError, apiFetch } from "~/lib/api-client";

export type PlaceLocation = {
  placeId: string;
  address: string;
  latitude: number;
  longitude: number;
};

export type JobSender = {
  name: string;
  phone: string;
  organisation?: string | null;
};

export type CreateJobPayload = {
  sender: JobSender;
  collection: PlaceLocation;
  delivery: PlaceLocation;
  contents: string;
  serviceAreas: string[];
};

export type DeliveryJob = {
  id: string;
  reference: string;
  status: string;
  sender: JobSender;
  collection: PlaceLocation;
  delivery: PlaceLocation;
  contents: string;
  serviceAreas: string[];
  createdAt: string | null;
};

export const SERVICE_AREAS = [
  { value: "South", label: "South Area" },
  { value: "North", label: "North Area" },
] as const;

export async function createDeliveryJob(
  payload: CreateJobPayload,
): Promise<DeliveryJob> {
  return apiFetch<DeliveryJob>("/jobs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function jobErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.message.length > 0) {
    return error.message;
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return fallback;
}
