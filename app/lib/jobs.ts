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

export type JobStatus =
  | "New"
  | "Allocated"
  | "Collected"
  | "Delivered"
  | "Cancelled";

export type JobListScope = "active" | "completed";

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
  status: JobStatus | string;
  sender: JobSender;
  collection: PlaceLocation;
  delivery: PlaceLocation;
  contents: string;
  serviceAreas: string[];
  createdAt: string | null;
};

type DataList<T> = { data: T[] };

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

export async function fetchJobs(scope: JobListScope): Promise<DeliveryJob[]> {
  const body = await apiFetch<DataList<DeliveryJob>>(`/jobs/${scope}`);
  return body.data;
}

export function displayJobReference(
  job: Pick<DeliveryJob, "id" | "reference">,
): string {
  const reference = job.reference.trim();
  if (reference.length > 0) {
    return reference;
  }

  return job.id.slice(-6);
}

export function formatJobCreatedAt(createdAt: string | null): string {
  if (!createdAt) {
    return "";
  }

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return createdAt;
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

export function jobErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.message.length > 0) {
    return error.message;
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return fallback;
}
