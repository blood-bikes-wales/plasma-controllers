import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearActiveRole } from "~/lib/active-role";
import { AuthProvider } from "~/lib/auth";
import { clearAuthToken, setAuthToken } from "~/lib/auth-token";
import { Role } from "~/lib/roles";

import { mockAuthUser } from "../../tests/auth-fixtures";
import JobsRecurringPage, { meta } from "./jobs.recurring";

afterEach(() => {
  clearAuthToken();
  clearActiveRole();
  vi.unstubAllGlobals();
});

function stubRecurringFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/me")) {
      return new Response(
        JSON.stringify({ ...mockAuthUser, roles: [Role.Controller] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.includes("/job-recurrences")) {
      return new Response(
        JSON.stringify({
          data: [
            {
              id: "series-1",
              jobType: "standard",
              sender: { name: "Dr Patel", phone: "029 2074 7747" },
              collection: {
                placeId: "a",
                address: "UHW",
                latitude: 51.5,
                longitude: -3.1,
              },
              delivery: {
                placeId: "b",
                address: "Singleton",
                latitude: 51.6,
                longitude: -3.9,
              },
              contents: "Blood samples",
              serviceAreas: ["E"],
              timezone: "Europe/London",
              timeOfDay: "09:00",
              frequency: "weekly",
              byWeekday: [1, 3, 5],
              startsOn: "2026-12-07",
              isActive: true,
              horizonDays: 14,
              occurrences: [],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.includes("/job-contents")) {
      return new Response(
        JSON.stringify({ data: [{ id: "1", name: "Blood samples" }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.includes("/service-areas")) {
      return new Response(
        JSON.stringify({ data: [{ id: "1", code: "E", name: "East" }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ message: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  });
}

describe("JobsRecurringPage", () => {
  it("exports page meta", () => {
    expect(meta({} as Parameters<typeof meta>[0])).toEqual([
      { title: "Recurring jobs — Plasma Controller" },
    ]);
  });

  it("lists recurring series for a controller", async () => {
    setAuthToken("test-google-id-token");
    vi.stubGlobal("fetch", stubRecurringFetch());

    const router = createMemoryRouter(
      [
        {
          path: "/jobs/recurring",
          element: (
            <AuthProvider>
              <JobsRecurringPage />
            </AuthProvider>
          ),
        },
      ],
      { initialEntries: ["/jobs/recurring"] },
    );

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Recurring jobs" }),
      ).toBeInTheDocument();
    });
    expect(await screen.findByText("Blood samples")).toBeInTheDocument();
    expect(
      screen.getByText(/Weekly Mon, Wed, Fri at 09:00/),
    ).toBeInTheDocument();
  });
});
