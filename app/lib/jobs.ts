import { ApiError, apiFetch } from "~/lib/api-client";

export type PlaceLocation = {
  placeId: string;
  address: string;
  /** Google's postal code for the place; absent or null when it has none. */
  postcode?: string | null;
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

/**
 * The mother's own contact on a milk job (the caller is the milk bank). Personal
 * data about a member of the public: the API only sends it to roles that can
 * create jobs, so `DeliveryJob.mother` is absent for everyone else.
 */
export type JobMother = {
  name: string;
  phone: string;
  secondaryPhone?: string | null;
};

export type JobType = "standard" | "milk";

export const JOB_TYPES: readonly JobType[] = ["standard", "milk"];

/**
 * Upper limit for litres on one milk job. Mirrors `App\Enums\JobType::MAX_MILK_LITRES`
 * in plasma-api; to confirm with controllers. Keep the two in step.
 */
export const MAX_MILK_LITRES = 100;

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
  /** Null when `noRecipient` is true. */
  recipient: string | null;
  noRecipient: boolean;
  deliveredAt: string | null;
};

export type JobCancellation = {
  reason: string | null;
  cancelledAt: string | null;
};

export type CreateJobPayload = {
  jobType: JobType;
  /** Required when `jobType` is "milk", and must be left out otherwise. */
  milkLitres?: number;
  /** Required when `jobType` is "milk", and must be left out otherwise. */
  mother?: JobMother;
  /** Only valid when `jobType` is "milk": the API rejects true on any other type. */
  isBereavement?: boolean;
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
  /** Required unless `noRecipient` is true. */
  recipient?: string;
  noRecipient: boolean;
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
  /** Absent on responses from an API that predates job types: treat as standard. */
  jobType?: JobType | string;
  /** Litres of milk; only set when `jobType` is "milk". */
  milkLitres?: number | null;
  /**
   * A milk job that is a bereavement. Every role that can view jobs gets it (it
   * only asks riders and drivers to be sensitive); absent on responses from an
   * API that predates it, which means false.
   */
  isBereavement?: boolean;
  /**
   * Mother's contact on a milk job. Null on other jobs, and absent for roles
   * that cannot create jobs (rider, driver, trustee), so only render it when set.
   */
  mother?: JobMother | null;
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
  /**
   * When the collection is arranged for. Null or absent means "today" (the day
   * the job was created). Every role that can view jobs gets it.
   */
  scheduledCollectionAt?: string | null;
  /**
   * A milk job that is New with no scheduled time yet: the controller still has
   * to call the mother. Only sent to roles that can create jobs, so absent for
   * everyone else and on an API that predates it, which means false.
   */
  needsMotherContact?: boolean;
  createdAt: string | null;
  allocatedRider?: JobAllocatedRider | null;
  collectionRecord?: JobCollectionRecord | null;
  deliveryRecord?: JobDeliveryRecord | null;
  cancellation?: JobCancellation | null;
  legs?: DeliveryJob[];
  /**
   * On a relay leg: the number of the earlier leg that must be delivered before
   * this one can be collected or delivered. Null or absent when nothing is
   * holding it back (and on an API that predates it).
   */
  waitingForLeg?: number | null;
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

/**
 * One job (or relay leg) by id from GET /jobs/{id}. The API never age-filters
 * this, so an old completed job still opens. Null when there is no such job.
 */
export async function fetchJobById(jobId: string): Promise<DeliveryJob | null> {
  try {
    return await apiFetch<DeliveryJob>(`/jobs/${encodeURIComponent(jobId)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
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

/**
 * Sets or changes when a New or Allocated job is collected. A milk job must be
 * scheduled for the future; the API is the judge of that.
 */
export async function scheduleJobCollection(
  jobId: string,
  scheduledCollectionAt: string,
): Promise<DeliveryJob> {
  return apiFetch<DeliveryJob>(`/jobs/${encodeURIComponent(jobId)}/schedule`, {
    method: "POST",
    body: JSON.stringify({ scheduledCollectionAt }),
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

/** "Waiting for leg 2 to be delivered", or null when the leg is free to go. */
export function waitingForLegMessage(
  job: Pick<DeliveryJob, "waitingForLeg">,
): string | null {
  if (job.waitingForLeg === null || job.waitingForLeg === undefined) {
    return null;
  }

  return `Waiting for leg ${job.waitingForLeg} to be delivered`;
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

export function isMilkJob(job: Pick<DeliveryJob, "jobType">): boolean {
  return job.jobType === "milk";
}

/** "2.5 L", "2 L", "0.25 L". Empty when there is no usable quantity. */
export function formatMilkLitres(litres: number | null | undefined): string {
  if (litres === null || litres === undefined || !Number.isFinite(litres)) {
    return "";
  }

  const formatted = new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(litres);
  return `${formatted} L`;
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
 * of truth for the day: the day the collection was scheduled for, or the day
 * the job was created when it has no scheduled time.
 */
export function getJobDate(
  job: Pick<DeliveryJob, "createdAt" | "scheduledCollectionAt">,
): string | null {
  return job.scheduledCollectionAt ?? job.createdAt;
}

/** "Sat 29 Aug, 14:30" for an arranged collection time, or "" when unusable. */
export function formatScheduledCollection(
  iso: string | null | undefined,
): string {
  const day = formatJobDay(iso);
  if (!iso || !day) {
    return "";
  }

  const time = new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${day}, ${time}`;
}

/**
 * The arranged collection time to show as upcoming: set, and the job is still
 * New or Allocated. Once collected, delivered or cancelled it is history.
 */
export function upcomingCollectionAt(
  job: Pick<DeliveryJob, "status" | "scheduledCollectionAt">,
): string | null {
  if (!job.scheduledCollectionAt) {
    return null;
  }

  return job.status === "New" || job.status === "Allocated"
    ? job.scheduledCollectionAt
    : null;
}

/**
 * Orders the active jobs for the board. "Due today" is decided on the
 * viewer's own calendar day (the API cannot know it): a job is FUTURE only
 * when it is still New or Allocated and its scheduled collection is on a later
 * local day than `now`. Everything else (unscheduled, due today, overdue,
 * already collected) is CURRENT and keeps the order the API sent. The board
 * lists the current jobs first, then the future ones soonest first (equal
 * times keep the API order).
 */
export function orderActiveJobsForBoard<
  T extends Pick<DeliveryJob, "status" | "scheduledCollectionAt">,
>(jobs: T[], now: Date = new Date()): T[] {
  const startOfTomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  ).getTime();

  const scheduledTime = (job: T): number => {
    const scheduledAt = upcomingCollectionAt(job);
    return scheduledAt ? new Date(scheduledAt).getTime() : Number.NaN;
  };
  const isFuture = (job: T): boolean => scheduledTime(job) >= startOfTomorrow;

  const current = jobs.filter((job) => !isFuture(job));
  const future = jobs
    .filter(isFuture)
    .sort((a, b) => scheduledTime(a) - scheduledTime(b));
  return [...current, ...future];
}

/**
 * Whether the controller still has to phone the mother to arrange a collection:
 * a milk job the API flags as needing it, and which has no time yet.
 */
export function needsMotherContact(
  job: Pick<
    DeliveryJob,
    "jobType" | "status" | "needsMotherContact" | "scheduledCollectionAt"
  >,
): boolean {
  return (
    isMilkJob(job) &&
    job.status === "New" &&
    job.needsMotherContact === true &&
    !job.scheduledCollectionAt
  );
}

export const MOTHER_NOT_CONTACTED_LABEL = "Mother not contacted";
export const NO_RIDER_ALLOCATED_LABEL = "No rider allocated";

/**
 * The one thing on a job that still needs chasing, for the board card, or null
 * when nothing does. In priority order:
 * 1. "Mother not contacted": a milk job still waiting for its first call.
 * 2. "No rider allocated": a New job arranged for a time after `now` that has
 *    no rider yet (a scheduled milk job lands here once the mother is called).
 * Only New jobs ask for attention, so Allocated, Collected, Delivered and
 * Cancelled jobs never show a line. A relay leg never does (the relay's parent
 * is the one the controller chases). A relay parent follows the same rules as
 * any job: it has no rider of its own, but the API sets its status to the
 * least advanced of its active legs (`RelayJobStatusAggregator`), so it is New
 * exactly when a leg is still unallocated, and Allocated or later once every
 * active leg has a rider.
 *
 * `needsMotherContact` is only sent to roles that can create jobs. When the key
 * is absent (rider, driver, trustee, or an API that predates it) the same rule
 * the API uses is derived from fields every role gets: milk, New, and no
 * scheduled time. `now` is injectable so tests do not depend on the clock.
 */
export function jobAttentionLabel(
  job: Pick<
    DeliveryJob,
    | "jobType"
    | "status"
    | "needsMotherContact"
    | "scheduledCollectionAt"
    | "allocatedRider"
    | "parentJobId"
    | "legNumber"
  >,
  now: Date = new Date(),
): string | null {
  if (job.status !== "New") {
    return null;
  }

  const isLeg =
    Boolean(job.parentJobId) ||
    (job.legNumber !== null && job.legNumber !== undefined);
  if (isLeg) {
    return null;
  }

  const unscheduledMilk = isMilkJob(job) && !job.scheduledCollectionAt;
  const mothersNotContacted =
    job.needsMotherContact === undefined
      ? unscheduledMilk
      : job.needsMotherContact && unscheduledMilk;
  if (mothersNotContacted) {
    return MOTHER_NOT_CONTACTED_LABEL;
  }

  if (job.allocatedRider || !job.scheduledCollectionAt) {
    return null;
  }

  const scheduledAt = new Date(job.scheduledCollectionAt).getTime();
  return scheduledAt > now.getTime() ? NO_RIDER_ALLOCATED_LABEL : null;
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
