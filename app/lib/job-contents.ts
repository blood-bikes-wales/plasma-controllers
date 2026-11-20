import { ApiError, apiFetch } from "~/lib/api-client";

/**
 * One entry in the trustee-managed list of job contents.
 *
 * `active` and `sortOrder` are only sent to callers who can manage the list
 * (trustee, admin); the New Job picker only needs `id` and `name`.
 */
export type JobContentOption = {
  id: string;
  name: string;
  active?: boolean;
  sortOrder?: number;
};

/** A managed entry, where the API always includes the management fields. */
export type ManagedJobContent = JobContentOption & {
  active: boolean;
  sortOrder: number;
};

export type CreateJobContentPayload = {
  name: string;
  sortOrder?: number;
  active?: boolean;
};

export type UpdateJobContentPayload = Partial<CreateJobContentPayload>;

type DataList<T> = { data: T[] };

export const NO_JOB_CONTENTS_MESSAGE =
  "No contents have been set up. Ask a trustee to add some.";

/** The entries a caller may see: active ones for pickers, all for managers. */
export async function fetchJobContents(): Promise<JobContentOption[]> {
  const body = await apiFetch<DataList<JobContentOption>>("/job-contents");
  return body.data;
}

export async function createJobContent(
  payload: CreateJobContentPayload,
): Promise<ManagedJobContent> {
  return apiFetch<ManagedJobContent>("/job-contents", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateJobContent(
  id: string,
  payload: UpdateJobContentPayload,
): Promise<ManagedJobContent> {
  return apiFetch<ManagedJobContent>(`/job-contents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/**
 * The entries a controller may pick on New Job. Managers (trustee, admin) are
 * sent retired entries too, and the API rejects them on a new job, so they
 * are dropped here. An entry without `active` is a picker entry, so it stays.
 */
export function selectableJobContents(
  entries: readonly JobContentOption[],
): JobContentOption[] {
  return entries.filter((entry) => entry.active !== false);
}

/** Keeps the list in the order the API returns it: sort order, then name. */
export function sortJobContents<T extends JobContentOption>(entries: T[]): T[] {
  return [...entries].sort(
    (a, b) =>
      (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

export function jobContentErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof ApiError && error.message.length > 0) {
    return error.message;
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return fallback;
}
