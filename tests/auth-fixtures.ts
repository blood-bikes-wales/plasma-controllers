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
      return new Response(JSON.stringify(user), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ message: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  });
}
