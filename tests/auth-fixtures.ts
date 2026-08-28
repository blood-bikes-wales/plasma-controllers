import { vi } from "vitest";

import type { AuthUser } from "~/lib/auth";
import { Role } from "~/lib/roles";

export const mockAuthUser: AuthUser = {
  id: 1,
  name: "Steve Humphreys",
  email: "s.humphreys@bloodbikes.wales",
  google_id: "google-123",
  email_verified_at: "2026-01-01T00:00:00.000000Z",
  roles: [Role.Controller],
};

export function stubAuthenticatedFetch(user: AuthUser = mockAuthUser) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/me")) {
      return jsonResponse(user);
    }
    if (url.includes("/shifts/active")) {
      return jsonResponse({ data: [] });
    }
    if (url.includes("/bikes")) {
      return jsonResponse({ data: [] });
    }
    if (url.includes("/volunteers")) {
      return jsonResponse({ data: [] });
    }
    return jsonResponse({ message: "Not found" }, 404);
  });
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
