import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearActiveRole } from "~/lib/active-role";
import { AuthProvider } from "~/lib/auth";
import { clearAuthToken, setAuthToken } from "~/lib/auth-token";
import { Role } from "~/lib/roles";

import {
  mockAuthUser,
  stubAuthenticatedFetch,
} from "../../tests/auth-fixtures";
import DashboardLayout from "./dashboard-layout";

afterEach(() => {
  clearAuthToken();
  clearActiveRole();
  vi.unstubAllGlobals();
});

function renderLayout(roles: Role[] = [Role.Controller]) {
  setAuthToken("test-token");
  vi.stubGlobal("fetch", stubAuthenticatedFetch({ ...mockAuthUser, roles }));

  const router = createMemoryRouter(
    [
      {
        element: (
          <AuthProvider>
            <Outlet />
          </AuthProvider>
        ),
        children: [
          {
            path: "/",
            Component: DashboardLayout,
            children: [{ index: true, element: <div>Page</div> }],
          },
        ],
      },
    ],
    { initialEntries: ["/"] },
  );

  return render(<RouterProvider router={router} />);
}

describe("DashboardLayout", () => {
  it("shows primary nav areas for the active role", async () => {
    renderLayout();

    await waitFor(() => {
      expect(
        screen.getByRole("navigation", { name: "Primary" }),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: "Jobs" })).toHaveAttribute(
      "href",
      "/jobs",
    );
    expect(screen.getByRole("link", { name: "Shifts" })).toHaveAttribute(
      "href",
      "/shifts",
    );
  });
});
