import { ApiError, apiFetch } from "~/lib/api-client";
import type { JobLocation, JobMother, JobSender, JobType } from "~/lib/jobs";

export type RecurrenceFrequency = "daily" | "weekly";

export type JobRecurrenceOccurrence = {
  id: string;
  reference: string;
  status: string;
  occurrenceDate: string | null;
  scheduledCollectionAt: string | null;
};

export type JobRecurrence = {
  id: string;
  jobType: JobType | string;
  milkLitres?: number | null;
  isBereavement?: boolean;
  sender: JobSender;
  mother?: JobMother | null;
  collection: JobLocation;
  delivery: JobLocation;
  contents: string;
  serviceAreas: string[];
  timezone: string;
  timeOfDay: string;
  frequency: RecurrenceFrequency | string;
  byWeekday?: number[] | null;
  startsOn: string;
  endsOn?: string | null;
  isActive: boolean;
  horizonDays: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  occurrences?: JobRecurrenceOccurrence[];
};

export type CreateJobRecurrencePayload = {
  jobType: JobType;
  milkLitres?: number;
  mother?: JobMother;
  isBereavement?: boolean;
  sender: JobSender;
  collection: JobLocation;
  delivery: JobLocation;
  contents: string;
  serviceAreas: string[];
  timezone?: string;
  timeOfDay: string;
  frequency: RecurrenceFrequency;
  byWeekday?: number[];
  startsOn: string;
  endsOn?: string | null;
  horizonDays?: number;
};

export type UpdateJobRecurrencePayload = Partial<CreateJobRecurrencePayload>;

type DataList<T> = { data: T[] };

export async function fetchJobRecurrences(
  active?: boolean,
): Promise<JobRecurrence[]> {
  const query =
    active === undefined ? "" : `?active=${active ? "true" : "false"}`;
  const body = await apiFetch<DataList<JobRecurrence>>(
    `/job-recurrences${query}`,
  );
  return body.data;
}

export async function fetchJobRecurrence(
  id: string,
): Promise<JobRecurrence | null> {
  try {
    return await apiFetch<JobRecurrence>(
      `/job-recurrences/${encodeURIComponent(id)}`,
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function createJobRecurrence(
  payload: CreateJobRecurrencePayload,
): Promise<JobRecurrence> {
  return apiFetch<JobRecurrence>("/job-recurrences", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateJobRecurrence(
  id: string,
  payload: UpdateJobRecurrencePayload,
): Promise<JobRecurrence> {
  return apiFetch<JobRecurrence>(`/job-recurrences/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function pauseJobRecurrence(id: string): Promise<JobRecurrence> {
  return apiFetch<JobRecurrence>(
    `/job-recurrences/${encodeURIComponent(id)}/pause`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export async function resumeJobRecurrence(id: string): Promise<JobRecurrence> {
  return apiFetch<JobRecurrence>(
    `/job-recurrences/${encodeURIComponent(id)}/resume`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export async function stopJobRecurrence(id: string): Promise<JobRecurrence> {
  return apiFetch<JobRecurrence>(`/job-recurrences/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function jobRecurrenceErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (!(error instanceof ApiError)) {
    if (error instanceof Error && error.message.trim() !== "") {
      return error.message;
    }
    return fallback;
  }

  const body = error.body;
  const message =
    typeof body === "object" && body && "message" in body
      ? (body as { message?: unknown }).message
      : null;
  if (typeof message === "string" && message.trim() !== "") {
    return message;
  }

  if (error.status === 403) {
    return "You do not have permission to manage recurring jobs.";
  }

  return fallback;
}

const WEEKDAY_LABELS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;

export function formatRecurrenceSchedule(series: JobRecurrence): string {
  const time = series.timeOfDay.slice(0, 5);
  if (series.frequency === "daily") {
    return `Daily at ${time}`;
  }

  const days = (series.byWeekday ?? [])
    .filter((day) => day >= 1 && day <= 7)
    .map((day) => WEEKDAY_LABELS[day - 1])
    .join(", ");
  return days ? `Weekly ${days} at ${time}` : `Weekly at ${time}`;
}
