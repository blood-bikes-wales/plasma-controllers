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
  suitablySealed: boolean;
  sealNumber: string | null;
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
  collection: PlaceLocation;
  delivery: PlaceLocation;
  contents: string;
  serviceAreas: string[];
};

export type AllocateJobPayload = {
  shiftId: string;
};

export type CollectJobPayload = {
  contentsConfirmed: boolean;
  suitablySealed: boolean;
  sealNumber?: string;
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

export type RelayJobPayload = {
  rendezvousPoints: PlaceLocation[];
};

export type DeliveryJob = {
  id: string;
  reference: string;
  status: JobStatus | string;
  isRelay?: boolean;
  parentJobId?: string | null;
  legNumber?: number | null;
  sender: JobSender;
  collection: PlaceLocation;
  delivery: PlaceLocation;
  contents: string;
  serviceAreas: string[];
  createdAt: string | null;
  allocatedRider?: JobAllocatedRider | null;
  collectionRecord?: JobCollectionRecord | null;
  deliveryRecord?: JobDeliveryRecord | null;
  cancellation?: JobCancellation | null;
  legs?: DeliveryJob[];
  allowedActions?: JobAllowedAction[];
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
