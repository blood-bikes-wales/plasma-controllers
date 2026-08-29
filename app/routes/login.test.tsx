import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearActiveRole } from "~/lib/active-role";
import { AuthProvider } from "~/lib/auth";
import { clearAuthToken } from "~/lib/auth-token";

import {
  mockAuthUser,
  stubAuthenticatedFetch,
} from "../../tests/auth-fixtures";
import LoginPage, { meta } from "./login";

vi.mock("~/lib/google-sign-in", () => ({
  mountGoogleSignInButton: vi.fn(
    async (
      container: HTMLElement,
      options: {
        onCredential: (idToken: string) => void | Promise<void>;
        onError?: (message: string) => void;
      },
    ) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Sign in with Google";
      button.addEventListener("click", () => {
        void options.onCredential("fresh-google-id-token");
      });
      container.replaceChildren(button);
      return () => {
        container.replaceChildren();
      };
    },
  ),
}));

afterEach(() => {
  clearAuthToken();
  clearActiveRole();
  vi.unstubAllGlobals();
});

function renderLoginPage() {
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
          { path: "/", Component: LoginPage },
          { path: "/jobs", Component: () => <div>Jobs</div> },
          { path: "/login", Component: () => <div>Login</div> },
          { path: "/no-access", Component: () => <div>No access</div> },
          { path: "/select-role", Component: () => <div>Select role</div> },
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

describe("LoginPage", () => {
  it("exports page meta", () => {
    expect(meta({} as Parameters<typeof meta>[0])).toEqual([
      { title: "Sign in — Plasma Controller" },
    ]);
  });

  it("renders a centered login form", async () => {
    renderLoginPage();

    const heading = await screen.findByRole("heading", {
      name: "Sign in to Plasma Controller",
    });
    expect(heading).toBeInTheDocument();
    expect(heading.closest(".max-w-xs")).not.toBeNull();
    expect(
      await screen.findByRole("button", { name: "Sign in with Google" }),
    ).toBeInTheDocument();
  });

  it("allows signing in through the embedded login form", async () => {
    const { router, user } = renderLoginPage();

    const button = await screen.findByRole("button", {
      name: "Sign in with Google",
    });
    await user.click(button);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/jobs");
    });
    expect(screen.getByText("Jobs")).toBeInTheDocument();
  });
});
