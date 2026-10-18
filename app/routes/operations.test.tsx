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
import OperationsLayout, { meta } from "./operations";
import OperationsIndex from "./operations._index";
import OperationsSection172Page from "./operations.section-172";

afterEach(() => {
  clearAuthToken();
  clearActiveRole();
  vi.unstubAllGlobals();
});

function renderOperations(path: string) {
  setAuthToken("test-token");
  vi.stubGlobal(
    "fetch",
    stubAuthenticatedFetch({ ...mockAuthUser, roles: [Role.Trustee] }),
  );

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
            path: "/operations",
            Component: OperationsLayout,
            children: [
              { index: true, Component: OperationsIndex },
              {
                path: "postcode-areas",
                element: <div>Postcode areas content</div>,
              },
              { path: "section-172", Component: OperationsSection172Page },
            ],
          },
        ],
      },
    ],
    { initialEntries: [path] },
  );

  return { router, ...render(<RouterProvider router={router} />) };
}

describe("OperationsLayout", () => {
  it("exports page meta", () => {
    expect(meta({} as Parameters<typeof meta>[0])).toEqual([
      { title: "Operations — Plasma Controller" },
    ]);
  });

  it("renders the operations heading and child content", async () => {
    renderOperations("/operations/postcode-areas");

    expect(
      await screen.findByRole("heading", { name: "Operations" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Postcode areas content")).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Secondary" }),
    ).not.toBeInTheDocument();
  });

  it("redirects /operations to postcode areas", async () => {
    const { router } = renderOperations("/operations");

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/operations/postcode-areas");
    });
  });

  it("renders the section 172 lookup form", async () => {
    renderOperations("/operations/section-172");

    expect(
      await screen.findByRole("heading", { name: "Section 172" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Find rider" }),
    ).toBeInTheDocument();
  });
});
