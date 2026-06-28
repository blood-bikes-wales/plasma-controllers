import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { appRoutes } from "./routes-config";
import { renderWithRouter } from "./test-utils";

describe("routes", () => {
  it("redirects / to /login", async () => {
    const { router } = renderWithRouter(appRoutes, "/");

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/login");
    });
    expect(
      screen.getByRole("heading", { name: "Sign in to Plasma Controller" }),
    ).toBeInTheDocument();
  });

  it("renders the login page at /login", () => {
    renderWithRouter(appRoutes, "/login");

    expect(
      screen.getByRole("heading", { name: "Sign in to Plasma Controller" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Login with Google" }),
    ).toBeInTheDocument();
  });

  it("renders the dashboard within the app layout at /dashboard", () => {
    renderWithRouter(appRoutes, "/dashboard");

    expect(screen.getByText("Plasma Controller")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Dashboard" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Welcome to Plasma Controller. Authentication will gate this page in a future update.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open user menu" }),
    ).toBeInTheDocument();
  });

  it("renders the jobs page within the app layout at /jobs", () => {
    renderWithRouter(appRoutes, "/jobs");

    expect(screen.getByText("Plasma Controller")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Jobs" })).toBeInTheDocument();
    expect(screen.getByText("South Area")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Job" })).toHaveAttribute(
      "href",
      "/jobs/new",
    );
  });

  it("opens the new job drawer at /jobs/new", () => {
    renderWithRouter(appRoutes, "/jobs/new");

    expect(
      screen.getByRole("heading", { name: "New Job", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Caller name")).toBeInTheDocument();
    expect(screen.getByText("JB-1042")).toBeInTheDocument();
  });

  it("opens the assign rider drawer at /jobs/new/assign", () => {
    renderWithRouter(appRoutes, "/jobs/new/assign");

    expect(
      screen.getByRole("heading", { name: "Assign rider", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText("JB-1043")).toBeInTheDocument();
  });

  it("navigates from login to jobs when signing in", async () => {
    const user = userEvent.setup();
    const { router } = renderWithRouter(appRoutes, "/login");

    await user.click(screen.getByRole("button", { name: "Login with Google" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/jobs");
    });
    expect(screen.getByRole("heading", { name: "Jobs" })).toBeInTheDocument();
    expect(screen.getByText("Plasma Controller")).toBeInTheDocument();
  });
});
