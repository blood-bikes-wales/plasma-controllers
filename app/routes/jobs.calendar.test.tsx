import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearActiveRole } from "~/lib/active-role";
import { AuthProvider } from "~/lib/auth";
import { clearAuthToken, setAuthToken } from "~/lib/auth-token";
import { Role } from "~/lib/roles";

import { mockAuthUser } from "../../tests/auth-fixtures";
import JobsCalendarPage, { meta } from "./jobs.calendar";

afterEach(() => {
  clearAuthToken();
  clearActiveRole();
  vi.unstubAllGlobals();
});

describe("JobsCalendarPage", () => {
  it("exports page meta", () => {
    expect(meta({} as Parameters<typeof meta>[0])).toEqual([
      { title: "Jobs calendar — Plasma Controller" },
    ]);
  });

  it("groups arranged collections by day", async () => {
    setAuthToken("test-google-id-token");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    tomorrow.setHours(10, 0, 0, 0);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/me")) {
          return new Response(
            JSON.stringify({ ...mockAuthUser, roles: [Role.Controller] }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (url.includes("/jobs/active")) {
          return new Response(
            JSON.stringify({
              data: [
                {
                  id: "job-1",
                  reference: "JB-2001",
                  status: "New",
                  sender: { name: "A", phone: "029 2074 7747" },
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
                  createdAt: new Date().toISOString(),
                  scheduledCollectionAt: tomorrow.toISOString(),
                  recurrenceId: "series-1",
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({ message: "Not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    const router = createMemoryRouter(
      [
        {
          path: "/jobs/calendar",
          element: (
            <AuthProvider>
              <JobsCalendarPage />
            </AuthProvider>
          ),
        },
      ],
      { initialEntries: ["/jobs/calendar"] },
    );

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Jobs calendar" }),
      ).toBeInTheDocument();
    });
    expect(await screen.findByText("JB-2001")).toBeInTheDocument();
    expect(screen.getByText("Recurring")).toBeInTheDocument();
  });
});
