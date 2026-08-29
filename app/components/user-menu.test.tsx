import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UserMenu } from "~/components/user-menu";
import { clearActiveRole } from "~/lib/active-role";
import { AuthProvider } from "~/lib/auth";
import { clearAuthToken, setAuthToken } from "~/lib/auth-token";
import { Role } from "~/lib/roles";

import {
  mockAuthUser,
  stubAuthenticatedFetch,
} from "../../tests/auth-fixtures";

afterEach(() => {
  clearAuthToken();
  clearActiveRole();
  vi.unstubAllGlobals();
});

async function openUserMenu(user: ReturnType<typeof userEvent.setup>) {
  const trigger = screen.getByRole("button", { name: "Open user menu" });
  await user.click(trigger);

  await waitFor(() => {
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });
}

function renderUserMenu() {
  setAuthToken("test-token");
  vi.stubGlobal("fetch", stubAuthenticatedFetch(mockAuthUser));

  const router = createMemoryRouter(
    [
      {
        element: (
          <AuthProvider>
            <Outlet />
          </AuthProvider>
        ),
        children: [
          { path: "/", element: <UserMenu /> },
          { path: "/login", element: <div>Login page</div> },
          { path: "/select-role", element: <div>Select role page</div> },
        ],
      },
    ],
    { initialEntries: ["/"] },
  );

  return {
    router,
    user: userEvent.setup(),
    ...render(<RouterProvider router={router} />),
  };
}

describe("UserMenu", () => {
  it("renders the user menu trigger", async () => {
    renderUserMenu();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Open user menu" }),
      ).toBeInTheDocument();
    });
  });

  it("opens menu with user details and actions", async () => {
    const { user } = renderUserMenu();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Open user menu" }),
      ).toBeInTheDocument();
    });

    await openUserMenu(user);

    expect(screen.getByText("Steve Humphreys")).toBeInTheDocument();
    expect(screen.getByText("s.humphreys")).toBeInTheDocument();
    expect(screen.getByText("Controller")).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Change Role" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Sign out" }),
    ).toBeInTheDocument();
  });

  it("shows the primary role from /me in the badge", async () => {
    setAuthToken("test-token");
    vi.stubGlobal(
      "fetch",
      stubAuthenticatedFetch({
        ...mockAuthUser,
        roles: [Role.Rider, Role.Driver],
      }),
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
            { path: "/", element: <UserMenu /> },
            { path: "/login", element: <div>Login page</div> },
            { path: "/select-role", element: <div>Select role page</div> },
          ],
        },
      ],
      { initialEntries: ["/"] },
    );

    const user = userEvent.setup();
    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Open user menu" }),
      ).toBeInTheDocument();
    });

    await openUserMenu(user);

    expect(screen.getByText("Rider")).toBeInTheDocument();
  });

  it("enables Change Role for multi-role users and opens the picker", async () => {
    setAuthToken("test-token");
    vi.stubGlobal(
      "fetch",
      stubAuthenticatedFetch({
        ...mockAuthUser,
        roles: [Role.Controller, Role.Trustee],
      }),
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
            { path: "/", element: <UserMenu /> },
            { path: "/login", element: <div>Login page</div> },
            { path: "/select-role", element: <div>Select role page</div> },
          ],
        },
      ],
      { initialEntries: ["/"] },
    );

    const user = userEvent.setup();
    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Open user menu" }),
      ).toBeInTheDocument();
    });

    await openUserMenu(user);
    const changeRole = screen.getByRole("menuitem", { name: "Change Role" });
    expect(changeRole).not.toHaveAttribute("data-disabled");
    await user.click(changeRole);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/select-role");
    });
    expect(screen.getByText("Select role page")).toBeInTheDocument();
  });

  it("navigates to login when sign out is clicked", async () => {
    const { router, user } = renderUserMenu();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Open user menu" }),
      ).toBeInTheDocument();
    });

    await openUserMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/login");
    });
  });
});
