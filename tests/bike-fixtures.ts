import { vi } from "vitest";

import type { AuthUser } from "~/lib/auth";
import type { FleetBike } from "~/lib/bikes";
import { Role } from "~/lib/roles";

import { mockAuthUser } from "./auth-fixtures";

export const mockFleetBikes: FleetBike[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    registration: "CF12 ABC",
    area: "South",
    status: "active",
    lastRecordedMileage: 15234,
    purchasedAt: "2024-03-15",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    registration: "CF34 DEF",
    area: "North",
    status: "retired",
    lastRecordedMileage: 9820,
    retiredAt: "2026-08-01T12:00:00.000Z",
  },
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function filterManagedBikes(url: string): FleetBike[] {
  const params = new URL(url, "http://localhost").searchParams;
  const status = params.get("status");
  const area = params.get("area");

  return mockFleetBikes.filter((bike) => {
    if (status === "active" && bike.status !== "active") {
      return false;
    }

    if (status === "retired" && bike.status !== "retired") {
      return false;
    }

    if (area && bike.area !== area) {
      return false;
    }

    return true;
  });
}

export function stubBikesFetch(
  user: AuthUser = { ...mockAuthUser, roles: [Role.Trustee] },
) {
  const store = [...mockFleetBikes];

  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method?.toUpperCase() ?? "GET";

    if (url.includes("/me")) {
      return jsonResponse(user);
    }

    if (url.includes("/bikes") && method === "GET") {
      return jsonResponse({ data: filterManagedBikes(url) });
    }

    if (
      url.includes("/bikes") &&
      method === "POST" &&
      url.endsWith("/retire")
    ) {
      const bikeId = url.split("/bikes/")[1]?.split("/")[0] ?? "";
      const index = store.findIndex((bike) => bike.id === bikeId);
      if (index === -1) {
        return jsonResponse({ message: "Not found" }, 404);
      }

      store[index] = {
        ...store[index],
        status: "retired",
        retiredAt: new Date().toISOString(),
      };

      return jsonResponse(store[index]);
    }

    if (url.includes("/bikes") && method === "POST") {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        registration?: string;
        area?: string;
        lastRecordedMileage?: number;
        purchasedAt?: string;
      };

      const created: FleetBike = {
        id: "33333333-3333-3333-3333-333333333333",
        registration: body.registration ?? "NEW BIKE",
        area: body.area ?? "South",
        status: "active",
        lastRecordedMileage: body.lastRecordedMileage ?? 0,
        purchasedAt: body.purchasedAt,
      };
      store.push(created);
      return jsonResponse(created, 201);
    }

    if (url.includes("/bikes/") && method === "PATCH") {
      const bikeId = url.split("/bikes/")[1]?.split("?")[0] ?? "";
      const index = store.findIndex((bike) => bike.id === bikeId);
      if (index === -1) {
        return jsonResponse({ message: "Not found" }, 404);
      }

      const body = JSON.parse(String(init?.body ?? "{}")) as {
        registration?: string;
        area?: string;
        purchasedAt?: string;
      };

      store[index] = {
        ...store[index],
        registration: body.registration ?? store[index].registration,
        area: body.area ?? store[index].area,
        purchasedAt: body.purchasedAt ?? store[index].purchasedAt,
      };

      return jsonResponse(store[index]);
    }

    return jsonResponse({ message: "Not found" }, 404);
  });
}
