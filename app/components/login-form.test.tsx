import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "~/components/login-form";
import { clearActiveRole } from "~/lib/active-role";
import { AuthProvider } from "~/lib/auth";
import { clearAuthToken } from "~/lib/auth-token";

import {
  mockAuthUser,
  stubAuthenticatedFetch,
} from "../../tests/auth-fixtures";

afterEach(() => {
  clearAuthToken();
  clearActiveRole();
  vi.unstubAllGlobals();
});

function renderLoginForm(
  requestIdToken: () => Promise<string> = async () => "token",
) {
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
          {
            path: "/",
            element: <LoginForm requestIdToken={requestIdToken} />,
          },
          { path: "/jobs", element: <div>Jobs page</div> },
          { path: "/login", element: <div>Login page</div> },
          { path: "/no-access", element: <div>No access page</div> },
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

describe("LoginForm", () => {
  it("renders sign-in heading and Google button", async () => {
    renderLoginForm();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Sign in to Plasma Controller" }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "Login with Google" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Controllers sign in with their Google account"),
    ).toBeInTheDocument();
  });

  it("navigates to jobs when Google login succeeds", async () => {
    const requestIdToken = vi.fn(async () => "fresh-google-id-token");
    const { router, user } = renderLoginForm(requestIdToken);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Login with Google" }),
      ).toBeEnabled();
    });

    await user.click(screen.getByRole("button", { name: "Login with Google" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/jobs");
    });
    expect(requestIdToken).toHaveBeenCalled();
    expect(screen.getByText("Jobs page")).toBeInTheDocument();
  });

  it("shows an error when sign-in fails", async () => {
    const requestIdToken = vi.fn(async () => {
      throw new Error("Google Sign-In was skipped (tap_outside)");
    });
    const { user } = renderLoginForm(requestIdToken);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Login with Google" }),
      ).toBeEnabled();
    });

    await user.click(screen.getByRole("button", { name: "Login with Google" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Google Sign-In was skipped",
    );
  });
});
