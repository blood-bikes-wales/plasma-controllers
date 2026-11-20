import { ApiError, apiFetch } from "~/lib/api-client";

export type PostcodeAreaMapping = {
  id: string;
  outboundPostcode: string;
  areaCode: string;
  areaFullName: string;
  sortOrder: number;
  active: boolean;
  updatedAt?: string | null;
};

export type CreatePostcodeAreaPayload = {
  outboundPostcode: string;
  areaCode: string;
  areaFullName: string;
  sortOrder?: number;
  active?: boolean;
};

export type UpdatePostcodeAreaPayload = Partial<CreatePostcodeAreaPayload>;

export type ImportPostcodeAreasResult = {
  created: number;
  updated: number;
};

type DataList<T> = { data: T[] };

export async function fetchPostcodeAreas(options?: {
  q?: string;
  includeInactive?: boolean;
}): Promise<PostcodeAreaMapping[]> {
  const params = new URLSearchParams();
  if (options?.q?.trim()) {
    params.set("q", options.q.trim());
  }
  if (options?.includeInactive) {
    params.set("includeInactive", "1");
  }

  const query = params.toString();
  const path = query ? `/postcode-areas?${query}` : "/postcode-areas";
  const body = await apiFetch<DataList<PostcodeAreaMapping>>(path);
  return body.data;
}

export type PostcodeAreaMatch = {
  areaCode: string;
  areaFullName: string;
};

/**
 * The service area mapped to an outward postcode such as "SA1", or null when
 * the postcode is not mapped.
 */
export async function lookupPostcodeArea(
  postcode: string,
): Promise<PostcodeAreaMatch | null> {
  const params = new URLSearchParams({ postcode });
  const body = await apiFetch<{ data: PostcodeAreaMatch | null }>(
    `/postcode-areas/lookup?${params.toString()}`,
  );
  if (!body.data) {
    return null;
  }

  return {
    areaCode: body.data.areaCode,
    areaFullName: body.data.areaFullName,
  };
}

export async function createPostcodeArea(
  payload: CreatePostcodeAreaPayload,
): Promise<PostcodeAreaMapping> {
  return apiFetch<PostcodeAreaMapping>("/postcode-areas", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updatePostcodeArea(
  id: string,
  payload: UpdatePostcodeAreaPayload,
): Promise<PostcodeAreaMapping> {
  return apiFetch<PostcodeAreaMapping>(`/postcode-areas/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function importPostcodeAreas(
  file: File,
): Promise<ImportPostcodeAreasResult> {
  const body = new FormData();
  body.append("file", file);

  return apiFetch<ImportPostcodeAreasResult>("/postcode-areas/import", {
    method: "POST",
    body,
  });
}

export function postcodeAreaErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (
    error instanceof ApiError &&
    typeof error.message === "string" &&
    error.message.length > 0
  ) {
    return error.message;
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return fallback;
}
