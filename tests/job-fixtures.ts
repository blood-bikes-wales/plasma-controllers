import { vi } from "vitest";

import type { AuthUser } from "~/lib/auth";
import type { DeliveryJob } from "~/lib/jobs";

const GLAMORGAN = {
  placeId: "ChIJ-glamorgan",
  address: "Royal Glamorgan Hospital",
  latitude: 51.568,
  longitude: -3.391,
};

const UHW = {
  placeId: "ChIJ-uhw",
  address: "University Hospital of Wales",
  latitude: 51.506,
  longitude: -3.191,
};

const PRINCE_CHARLES = {
  placeId: "ChIJ-prince-charles",
  address: "Prince Charles Hospital",
  latitude: 51.752,
  longitude: -3.373,
};

const GWENT = {
  placeId: "ChIJ-gwent",
  address: "Royal Gwent Hospital",
  latitude: 51.584,
  longitude: -2.996,
};

const NEVILL_HALL = {
  placeId: "ChIJ-nevill-hall",
  address: "Nevill Hall Hospital",
  latitude: 51.83,
  longitude: -3.027,
};

function job(
  overrides: Partial<DeliveryJob> & Pick<DeliveryJob, "id">,
): DeliveryJob {
  return {
    reference: "JB-0000",
    status: "New",
    sender: {
      name: "Dr. Patel",
      phone: "029 2074 7747",
      organisation: null,
    },
    collection: GLAMORGAN,
    delivery: UHW,
    contents: "Blood samples",
    serviceAreas: ["South"],
    createdAt: "2026-08-29T10:00:00.000Z",
    ...overrides,
  };
}

export const mockActiveJobs: DeliveryJob[] = [
  job({
    id: "11111111-1111-1111-1111-111111111111",
    reference: "JB-1042",
    status: "New",
    collection: GLAMORGAN,
    delivery: UHW,
    createdAt: "2026-08-29T10:02:00.000Z",
  }),
  job({
    id: "22222222-2222-2222-2222-222222222222",
    reference: "JB-1038",
    status: "Allocated",
    collection: PRINCE_CHARLES,
    delivery: GWENT,
    createdAt: "2026-08-29T09:50:00.000Z",
  }),
];

export const mockCompletedJobs: DeliveryJob[] = [
  job({
    id: "10110110-1111-1111-1111-111111111101",
    reference: "JB-1020",
    status: "Delivered",
    collection: GLAMORGAN,
    delivery: UHW,
    createdAt: "2026-08-29T09:42:00.000Z",
  }),
  job({
    id: "10310310-1111-1111-1111-111111111103",
    reference: "JB-1012",
    status: "Cancelled",
    collection: NEVILL_HALL,
    delivery: GLAMORGAN,
    createdAt: "2026-08-28T21:30:00.000Z",
  }),
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function stubJobsFetch(
  user: AuthUser,
  {
    active = mockActiveJobs,
    completed = mockCompletedJobs,
  }: { active?: DeliveryJob[]; completed?: DeliveryJob[] } = {},
) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/me")) {
      return jsonResponse(user);
    }
    if (url.includes("/jobs/completed")) {
      return jsonResponse({ data: completed });
    }
    if (url.includes("/jobs/active")) {
      return jsonResponse({ data: active });
    }
    return jsonResponse({ message: "Not found" }, 404);
  });
}
