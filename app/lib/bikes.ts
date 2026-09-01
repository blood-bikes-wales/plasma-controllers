import { z } from "zod";

import { apiFetch } from "~/lib/api-client";
import { SERVICE_AREAS } from "~/lib/jobs";

export const BIKE_SERVICE_AREA_VALUES = SERVICE_AREAS.map((area) => area.value);

export type FleetBike = {
  id: string;
  registration: string;
  area: string;
  status: "active" | "retired";
  lastRecordedMileage: number;
  purchasedAt?: string | null;
  retiredAt?: string | null;
};

export type CreateBikePayload = {
  registration: string;
  area: string;
  lastRecordedMileage: number;
  purchasedAt?: string;
};

export type UpdateBikePayload = {
  registration: string;
  area: string;
  purchasedAt?: string;
};

export type ManagedBikeFilters = {
  area?: string;
  status?: "active" | "retired" | "all";
};

const serviceAreaSchema = z.enum(["South", "North"], {
  message: "Choose an area",
});

export const createBikeFormSchema = z.object({
  registration: z
    .string()
    .trim()
    .min(1, "Enter the registration")
    .max(20, "Registration must be 20 characters or fewer"),
  area: serviceAreaSchema,
  lastRecordedMileage: z
    .string()
    .trim()
    .min(1, "Enter the starting mileage")
    .transform((value) => Number(value))
    .pipe(
      z
        .number({ message: "Enter a valid mileage" })
        .int("Enter a whole number")
        .min(0, "Mileage cannot be negative"),
    ),
  purchasedAt: z
    .string()
    .optional()
    .refine(
      (value) => {
        if (!value?.trim()) {
          return true;
        }

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
          return false;
        }

        const today = new Date();
        today.setHours(23, 59, 59, 999);
        return date <= today;
      },
      { message: "Purchase date cannot be in the future" },
    ),
});

export const updateBikeFormSchema = z.object({
  registration: z
    .string()
    .trim()
    .min(1, "Enter the registration")
    .max(20, "Registration must be 20 characters or fewer"),
  area: serviceAreaSchema,
  purchasedAt: z
    .string()
    .optional()
    .refine(
      (value) => {
        if (!value?.trim()) {
          return true;
        }

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
          return false;
        }

        const today = new Date();
        today.setHours(23, 59, 59, 999);
        return date <= today;
      },
      { message: "Purchase date cannot be in the future" },
    ),
});

type DataList<T> = { data: T[] };

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

export async function fetchManagedBikes(
  filters: ManagedBikeFilters = {},
): Promise<FleetBike[]> {
  const query = buildQuery({
    area: filters.area,
    status: filters.status === "all" ? "all" : filters.status,
  });
  const body = await apiFetch<DataList<FleetBike>>(`/bikes${query}`);
  return body.data;
}

export async function createBike(
  payload: CreateBikePayload,
): Promise<FleetBike> {
  return apiFetch<FleetBike>("/bikes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateBike(
  bikeId: string,
  payload: UpdateBikePayload,
): Promise<FleetBike> {
  return apiFetch<FleetBike>(`/bikes/${bikeId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function retireBike(bikeId: string): Promise<FleetBike> {
  return apiFetch<FleetBike>(`/bikes/${bikeId}/retire`, {
    method: "POST",
  });
}

export function bikeErrorMessage(error: unknown, fallback: string): string {
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

export function areaLabel(area: string): string {
  const match = SERVICE_AREAS.find((candidate) => candidate.value === area);
  if (match) {
    return match.label;
  }

  return area;
}

export function statusLabel(status: FleetBike["status"]): string {
  if (status === "retired") {
    return "Retired";
  }

  return "Active";
}
