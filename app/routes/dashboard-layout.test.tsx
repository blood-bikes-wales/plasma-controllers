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

function renderLayout({
  roles = [Role.Controller],
  path = "/",
  children = [{ index: true, element: <div>Page</div> }],
}: {
  roles?: Role[];
  path?: string;
  children?: Parameters<typeof createMemoryRouter>[0][0]["children"];
} = {}) {
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
            children,
          },
        ],
      },
    ],
    { initialEntries: [path] },
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
    expect(
      screen.queryByRole("navigation", { name: "Secondary" }),
    ).not.toBeInTheDocument();
  });

  it("shows operations child nav in the header", async () => {
    renderLayout({
      roles: [Role.Trustee],
      path: "/operations/postcode-areas",
      children: [
        {
          path: "operations/postcode-areas",
          element: <div>Postcode areas</div>,
        },
      ],
    });

    await waitFor(() => {
      expect(
        screen.getByRole("navigation", { name: "Secondary" }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("link", { name: "Postcode areas" }),
    ).toHaveAttribute("href", "/operations/postcode-areas");
    expect(screen.getByRole("link", { name: "Section 172" })).toHaveAttribute(
      "href",
      "/operations/section-172",
    );
  });
});
