import { apiFetch } from "~/lib/api-client";

export type DirectoryVolunteer = {
  id: string;
  name: string;
  roles: string[];
  area: string | null;
  email: string | null;
  phone: string | null;
};

export type DirectoryBike = {
  id: string;
  registration: string;
  lastRecordedMileage: number;
};

export type MileageHistoryEntry = {
  id: string;
  mileage: number;
  reason: string | null;
  recordedAt: string | null;
  shiftId: string;
};

export type DirectoryBikeDetail = DirectoryBike & {
  mileageHistory: MileageHistoryEntry[];
};

type DataList<T> = { data: T[] };

export type VolunteerSearchParams = {
  q?: string;
  role?: string;
  area?: string;
};

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (!value?.trim()) {
      continue;
    }
    search.set(key, value.trim());
  }

  const query = search.toString();
  if (!query) {
    return "";
  }

  return `?${query}`;
}

export async function searchVolunteers(
  params: VolunteerSearchParams,
): Promise<DirectoryVolunteer[]> {
  const query = buildQuery({
    q: params.q,
    role: params.role,
    area: params.area,
  });
  const body = await apiFetch<DataList<DirectoryVolunteer>>(
    `/directory/volunteers${query}`,
  );
  return body.data;
}

export async function searchBikes(query: string): Promise<DirectoryBike[]> {
  const suffix = buildQuery({ q: query });
  const body = await apiFetch<DataList<DirectoryBike>>(
    `/directory/bikes${suffix}`,
  );
  return body.data;
}

export async function fetchBikeDetail(
  bikeId: string,
): Promise<DirectoryBikeDetail> {
  const body = await apiFetch<{ data: DirectoryBikeDetail }>(
    `/directory/bikes/${bikeId}`,
  );
  return body.data;
}

export function directoryErrorMessage(
  error: unknown,
  fallback: string,
): string {
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

export function hasVolunteerSearch(params: VolunteerSearchParams): boolean {
  return [params.q, params.role, params.area].some(
    (value) => value?.trim().length,
  );
}

export function hasBikeSearch(query: string): boolean {
  return query.trim().length > 0;
}
