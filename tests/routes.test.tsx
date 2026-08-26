import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockAuthUser, stubAuthenticatedFetch } from "./auth-fixtures";
import { appRoutes } from "./routes-config";
import { renderWithRouter } from "./test-utils";

vi.mock("~/lib/google-sign-in", () => ({
  mountGoogleSignInButton: vi.fn(
    async (
      container: HTMLElement,
      options: {
        onCredential: (idToken: string) => void | Promise<void>;
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

describe("routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects / to /login when unauthenticated", async () => {
    const { router } = renderWithRouter(appRoutes, "/");

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/login");
    });
    expect(
      screen.getByRole("heading", { name: "Sign in to Plasma Controller" }),
    ).toBeInTheDocument();
  });

  it("redirects / to /jobs when authenticated", async () => {
    const { router } = renderWithRouter(appRoutes, "/", {
      authenticated: true,
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/jobs");
    });
  });

  it("renders the login page at /login", async () => {
    renderWithRouter(appRoutes, "/login");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Sign in to Plasma Controller" }),
      ).toBeInTheDocument();
    });
    expect(
      await screen.findByRole("button", { name: "Sign in with Google" }),
    ).toBeInTheDocument();
  });

  it("redirects unauthenticated /jobs to /login", async () => {
    const { router } = renderWithRouter(appRoutes, "/jobs");

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/login");
    });
  });

  it("renders the dashboard within the app layout at /dashboard", async () => {
    renderWithRouter(appRoutes, "/dashboard", { authenticated: true });

    await waitFor(() => {
      expect(screen.getByText("Plasma Controller")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("heading", { name: "Dashboard" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open user menu" }),
    ).toBeInTheDocument();
  });

  it("renders the jobs page within the app layout at /jobs", async () => {
    renderWithRouter(appRoutes, "/jobs", { authenticated: true });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Jobs" })).toBeInTheDocument();
    });
    expect(screen.getByText("South Area")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Job" })).toHaveAttribute(
      "href",
      "/jobs/new",
    );
  });

  it("renders the shifts page within the app layout at /shifts", async () => {
    renderWithRouter(appRoutes, "/shifts", { authenticated: true });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Shifts" }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "Log on rider" }),
    ).toBeInTheDocument();
  });

  it("navigates between Jobs and Shifts using the primary nav", async () => {
    const user = userEvent.setup();
    const { router } = renderWithRouter(appRoutes, "/jobs", {
      authenticated: true,
    });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Jobs" })).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("link", { name: "Shifts", current: false }),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/shifts");
      expect(
        screen.getByRole("heading", { name: "Shifts" }),
      ).toBeInTheDocument();
    });
  });

  it("opens the new job drawer at /jobs/new", async () => {
    renderWithRouter(appRoutes, "/jobs/new", { authenticated: true });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "New Job", level: 2 }),
      ).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Caller name")).toBeInTheDocument();
    expect(screen.getByText("JB-1042")).toBeInTheDocument();
  });

  it("opens the assign rider drawer at /jobs/new/assign", async () => {
    renderWithRouter(appRoutes, "/jobs/new/assign", { authenticated: true });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Assign rider", level: 2 }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("JB-1043")).toBeInTheDocument();
  });

  it("navigates from login to jobs when signing in", async () => {
    const fetchMock = stubAuthenticatedFetch(mockAuthUser);
    const user = userEvent.setup();
    const { router } = renderWithRouter(appRoutes, "/login");

    // renderWithRouter stubs a 401 fetch for unauthenticated mounts; replace
    // it before sign-in so /me succeeds with the Google ID token.
    vi.stubGlobal("fetch", fetchMock);

    const button = await screen.findByRole("button", {
      name: "Sign in with Google",
    });
    await user.click(button);

    // Wait for the jobs UI, not only the router pathname — LoginForm renders
    // <Navigate /> first, so pathname can update a tick before Jobs mounts.
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/jobs");
      expect(screen.getByRole("heading", { name: "Jobs" })).toBeInTheDocument();
    });
    expect(screen.getByText("Plasma Controller")).toBeInTheDocument();
  });
});
