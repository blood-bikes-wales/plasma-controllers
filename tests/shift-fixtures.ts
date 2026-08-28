import { vi } from "vitest";

import type { AuthUser } from "~/lib/auth";
import type { ActiveShift, Bike, RiderOption } from "~/lib/shifts";

import { mockAuthUser } from "./auth-fixtures";

export const mockRiders: RiderOption[] = [
  { id: "100001", name: "Sarah Jones" },
  { id: "100002", name: "Mike Davies" },
  { id: "100003", name: "Emma Williams" },
];

export const mockBikes: Bike[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    registration: "CF12 ABC",
    lastRecordedMileage: 15234,
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    registration: "CF34 DEF",
    lastRecordedMileage: 9820,
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    registration: "CF56 GHI",
    lastRecordedMileage: 22110,
  },
];

export const mockMikeShift: ActiveShift = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  riderId: "100002",
  riderName: "Mike Davies",
  bikeId: "22222222-2222-2222-2222-222222222222",
  bikeRegistration: "CF34 DEF",
  startMileage: 9820,
  startedAt: "2026-08-28T08:15:00.000Z",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function stubShiftsFetch(user: AuthUser = mockAuthUser) {
  const shifts: ActiveShift[] = [{ ...mockMikeShift }];
  const bikes: Bike[] = mockBikes.map((bike) => ({ ...bike }));
  const riders: RiderOption[] = mockRiders.map((rider) => ({ ...rider }));

  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();

    if (url.includes("/me")) {
      return jsonResponse(user);
    }

    if (url.includes("/shifts/active") && method === "GET") {
      return jsonResponse({ data: shifts });
    }

    if (url.includes("/bikes") && method === "GET") {
      return jsonResponse({ data: bikes });
    }

    if (url.includes("/volunteers") && method === "GET") {
      return jsonResponse({ data: riders });
    }

    if (url.includes("/shifts/logon") && method === "POST") {
      const payload = JSON.parse(String(init?.body ?? "{}")) as {
        riderId: string;
        bikeId: string;
        startMileage: number;
        mileageVarianceReason?: string;
      };
      const rider = riders.find(
        (candidate) => candidate.id === payload.riderId,
      );
      const bike = bikes.find((candidate) => candidate.id === payload.bikeId);
      const shift: ActiveShift = {
        id: crypto.randomUUID(),
        riderId: payload.riderId,
        riderName: rider?.name ?? "Unknown",
        bikeId: payload.bikeId,
        bikeRegistration: bike?.registration ?? "",
        startMileage: payload.startMileage,
        startedAt: new Date().toISOString(),
        mileageVarianceReason: payload.mileageVarianceReason ?? null,
      };
      shifts.push(shift);
      return jsonResponse(shift, 201);
    }

    const logoffMatch = url.match(/\/shifts\/([^/]+)\/logoff/);
    if (logoffMatch && method === "POST") {
      const shiftId = logoffMatch[1];
      const payload = JSON.parse(String(init?.body ?? "{}")) as {
        endMileage: number;
      };
      const index = shifts.findIndex((shift) => shift.id === shiftId);
      if (index === -1) {
        return jsonResponse({ message: "Not found" }, 404);
      }
      const [shift] = shifts.splice(index, 1);
      const bike = bikes.find((candidate) => candidate.id === shift.bikeId);
      if (bike) {
        bike.lastRecordedMileage = payload.endMileage;
      }
      return jsonResponse(shift);
    }

    return jsonResponse({ message: "Not found" }, 404);
  });
}
