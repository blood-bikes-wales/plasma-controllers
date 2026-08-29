import { vi } from "vitest";

import type { AuthUser } from "~/lib/auth";
import type {
  DirectoryBike,
  DirectoryBikeDetail,
  DirectoryVolunteer,
} from "~/lib/directory";

import { mockAuthUser } from "./auth-fixtures";

export const mockDirectoryVolunteers: DirectoryVolunteer[] = [
  {
    id: "100001",
    name: "Alex Morgan",
    roles: ["Rider", "Controller"],
    area: "South Wales",
    email: "alex.morgan@example.com",
    phone: "07700 900001",
  },
  {
    id: "100002",
    name: "Bethan Hughes",
    roles: ["Driver"],
    area: "North Wales",
    email: null,
    phone: null,
  },
];

export const mockDirectoryBikes: DirectoryBike[] = [
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
];

export const mockBikeDetail: DirectoryBikeDetail = {
  ...mockDirectoryBikes[0],
  mileageHistory: [
    {
      id: "reading-1",
      mileage: 15234,
      reason: null,
      recordedAt: "2026-08-28T18:00:00.000Z",
      shiftId: "shift-1",
    },
  ],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function filterVolunteers(url: string): DirectoryVolunteer[] {
  const params = new URL(url, "http://localhost").searchParams;
  const query = params.get("q")?.toLowerCase() ?? "";
  const role = params.get("role")?.toLowerCase() ?? "";
  const area = params.get("area")?.toLowerCase() ?? "";

  if (!query && !role && !area) {
    return [];
  }

  return mockDirectoryVolunteers.filter((volunteer) => {
    if (query && !volunteer.name.toLowerCase().includes(query)) {
      return false;
    }

    if (
      role &&
      !volunteer.roles.some((candidate) => candidate.toLowerCase() === role)
    ) {
      return false;
    }

    if (area && !volunteer.area?.toLowerCase().includes(area)) {
      return false;
    }

    return true;
  });
}

function filterBikes(url: string): DirectoryBike[] {
  const params = new URL(url, "http://localhost").searchParams;
  const query = params.get("q")?.toLowerCase() ?? "";
  if (!query) {
    return [];
  }

  return mockDirectoryBikes.filter((bike) =>
    bike.registration.toLowerCase().includes(query),
  );
}

export function stubDirectoryFetch(user: AuthUser = mockAuthUser) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes("/me")) {
      return jsonResponse(user);
    }

    if (url.includes("/directory/volunteers")) {
      return jsonResponse({ data: filterVolunteers(url) });
    }

    if (url.match(/\/directory\/bikes\/[^/?]+/)) {
      return jsonResponse({ data: mockBikeDetail });
    }

    if (url.includes("/directory/bikes")) {
      return jsonResponse({ data: filterBikes(url) });
    }

    return jsonResponse({ message: "Not found" }, 404);
  });
}
