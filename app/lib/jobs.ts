import { ApiError, apiFetch } from "~/lib/api-client";

export type PlaceLocation = {
  placeId: string;
  address: string;
  latitude: number;
  longitude: number;
};

/**
 * A stop on a job. `notes` belong to this job only (never to the shared place),
 * so they are kept off `PlaceLocation`, which feeds recent/most-used places.
 */
export type JobLocation = PlaceLocation & {
  notes?: string | null;
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

export type JobLifecycleAction = "allocate" | "collect" | "deliver" | "cancel";

export type JobAllowedAction = JobLifecycleAction | "relay";

export type JobAllocatedRider = {
  id: string;
  name: string;
  shiftId: string;
  allocatedAt: string | null;
};

export type JobCollectionRecord = {
  contentsConfirmed: boolean;
  receiptNumber: string;
  collectedAt: string | null;
};

export type JobDeliveryRecord = {
  recipient: string;
  deliveredAt: string | null;
};

export type JobCancellation = {
  reason: string | null;
  cancelledAt: string | null;
};

export type CreateJobPayload = {
  sender: JobSender;
  collection: PlaceLocation & { notes?: string };
  delivery: PlaceLocation & { notes?: string };
  contents: string;
  serviceAreas: string[];
  estimatedCollectionAt?: string;
  estimatedDeliveryAt?: string;
};

export type AllocateJobPayload = {
  shiftId: string;
};

export type CollectJobPayload = {
  contentsConfirmed: boolean;
  receiptNumber: string;
  collectedAt?: string;
};

export type DeliverJobPayload = {
  recipient: string;
  deliveredAt?: string;
};

export type CancelJobPayload = {
  reason?: string;
};

/** A handoff stop; `arrivesAt` is an ISO timestamp on the parent job's day. */
export type RelayRendezvousPoint = PlaceLocation & { arrivesAt: string };

export type RelayJobPayload = {
  rendezvousPoints: RelayRendezvousPoint[];
};

export type DeliveryJob = {
  id: string;
  reference: string;
  status: JobStatus | string;
  isRelay?: boolean;
  parentJobId?: string | null;
  legNumber?: number | null;
  sender: JobSender;
  collection: JobLocation;
  delivery: JobLocation;
  contents: string;
  serviceAreas: string[];
  /** Controller's estimate, not the recorded collection time. */
  estimatedCollectionAt?: string | null;
  /** Controller's estimate, not the recorded delivery time. */
  estimatedDeliveryAt?: string | null;
  /**
   * Planned arrival at a relay handoff. Set on the leg that delivers to a
   * rendezvous point, null on the last leg and on non-relay jobs.
   */
  plannedArrivalAt?: string | null;
  createdAt: string | null;
  allocatedRider?: JobAllocatedRider | null;
  collectionRecord?: JobCollectionRecord | null;
  deliveryRecord?: JobDeliveryRecord | null;
  cancellation?: JobCancellation | null;
  legs?: DeliveryJob[];
  allowedActions?: JobAllowedAction[];
};

type DataList<T> = { data: T[] };

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

export async function fetchJobById(jobId: string): Promise<DeliveryJob | null> {
  const [active, completed] = await Promise.all([
    fetchJobs("active"),
    fetchJobs("completed"),
  ]);

  const combined = [...active, ...completed];
  const direct = combined.find((candidate) => candidate.id === jobId);
  if (direct) {
    return direct;
  }

  for (const parent of combined) {
    const leg = parent.legs?.find((candidate) => candidate.id === jobId);
    if (leg) {
      return leg;
    }
  }

  return null;
}

export async function performJobAction(
  jobId: string,
  action: Exclude<JobLifecycleAction, "cancel">,
  payload: AllocateJobPayload | CollectJobPayload | DeliverJobPayload,
): Promise<DeliveryJob> {
  return apiFetch<DeliveryJob>(`/jobs/${jobId}/actions/${action}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function cancelJob(
  jobId: string,
  payload: CancelJobPayload = {},
): Promise<DeliveryJob> {
  return apiFetch<DeliveryJob>(`/jobs/${jobId}/cancel`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function relayJob(
  jobId: string,
  payload: RelayJobPayload,
): Promise<DeliveryJob> {
  return apiFetch<DeliveryJob>(`/jobs/${jobId}/relay`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function allowedActionsForJob(job: DeliveryJob): JobAllowedAction[] {
  if (Array.isArray(job.allowedActions)) {
    return job.allowedActions;
  }

  switch (job.status) {
    case "New":
      if (job.isRelay) {
        return ["cancel"];
      }

      return ["allocate", "cancel", "relay"];
    case "Allocated":
      return ["collect", "cancel"];
    case "Collected":
      return ["deliver", "cancel"];
    default:
      return [];
  }
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

/**
 * Label for an estimated collection or delivery time ("Today, 09:30"), or an
 * empty string when there is no estimate so callers can hide the line.
 */
export function formatEstimatedTime(iso: string | null | undefined): string {
  return formatJobCreatedAt(iso ?? null);
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

export function toDateTimeLocalValue(iso: string | null | undefined): string {
  if (!iso) {
    return "";
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDateTimeLocalValue(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

export function defaultDateTimeLocalValue(): string {
  return toDateTimeLocalValue(new Date().toISOString());
}

/**
 * A relay is the parent that was split into legs, or one of its legs. Relay
 * jobs span several riders and possibly several days, so they are not tied to
 * a single day. Everything else is a "normal" job.
 */
export function isRelayJob(
  job: Pick<DeliveryJob, "isRelay" | "parentJobId" | "legNumber" | "legs">,
): boolean {
  return (
    job.isRelay === true ||
    Boolean(job.parentJobId) ||
    (job.legNumber !== null && job.legNumber !== undefined) ||
    (job.legs?.length ?? 0) > 0
  );
}

/**
 * The day a normal job is collected and delivered on, as an ISO timestamp
 * (only its local calendar day is used), or null when unknown. Single source
 * of truth for the day; change it here if the day ever comes from somewhere
 * other than the created date.
 */
export function getJobDate(job: Pick<DeliveryJob, "createdAt">): string | null {
  return job.createdAt;
}

/** Current local time as an `<input type="time">` value (HH:mm). */
export function defaultTimeValue(): string {
  return toDateTimeLocalValue(new Date().toISOString()).slice(11);
}

/**
 * Combines the local calendar day of `dayIso` with a `HH:mm` time into an ISO
 * timestamp. Returns undefined when either part is missing or invalid.
 */
export function combineDayAndTime(
  dayIso: string | null | undefined,
  time: string,
): string | undefined {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(time.trim());
  if (!dayIso || !match) {
    return undefined;
  }

  const day = new Date(dayIso);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(day.getTime()) || hours > 23 || minutes > 59) {
    return undefined;
  }

  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    hours,
    minutes,
  ).toISOString();
}

/** Human label for the fixed day, e.g. "Sat 29 Aug". */
export function formatJobDay(dayIso: string | null | undefined): string {
  if (!dayIso) {
    return "";
  }

  const day = new Date(dayIso);
  if (Number.isNaN(day.getTime())) {
    return "";
  }

  return day.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
