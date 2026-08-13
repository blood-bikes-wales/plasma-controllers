import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UserMenu } from "~/components/user-menu";
import { AuthProvider } from "~/lib/auth";
import { clearAuthToken, setAuthToken } from "~/lib/auth-token";

import {
  mockAuthUser,
  stubAuthenticatedFetch,
} from "../../tests/auth-fixtures";

afterEach(() => {
  clearAuthToken();
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
