import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearActiveRole } from "~/lib/active-role";
import { AuthProvider } from "~/lib/auth";
import { clearAuthToken, setAuthToken } from "~/lib/auth-token";
import { Role } from "~/lib/roles";

import {
  mockAuthUser,
  stubAuthenticatedFetch,
} from "../../tests/auth-fixtures";
import JobsPage, { meta } from "./jobs";
import JobsNewRoute from "./jobs-new";
import JobsNewAssignRoute from "./jobs-new-assign";

afterEach(() => {
  clearAuthToken();
  clearActiveRole();
  vi.unstubAllGlobals();
});

function renderJobsPage(
  initialPath = "/jobs",
  { roles = [Role.Controller] }: { roles?: Role[] } = {},
) {
  setAuthToken("test-google-id-token");
  vi.stubGlobal("fetch", stubAuthenticatedFetch({ ...mockAuthUser, roles }));

  const router = createMemoryRouter(
    [
      {
        path: "/jobs",
        element: (
          <AuthProvider>
            <JobsPage />
          </AuthProvider>
        ),
        children: [
          {
            path: "new",
            element: <JobsNewRoute />,
            children: [{ path: "assign", element: <JobsNewAssignRoute /> }],
          },
        ],
      },
    ],
    { initialEntries: [initialPath] },
  );

  return {
    router,
    ...render(<RouterProvider router={router} />),
  };
}

async function waitForJobsLoaded() {
  await waitFor(() => {
    expect(
      screen.getByRole("heading", { name: "Jobs", level: 1 }),
    ).toBeInTheDocument();
  });
}

describe("JobsPage", () => {
  it("exports page meta", () => {
    expect(meta({} as Parameters<typeof meta>[0])).toEqual([
      { title: "Jobs — Plasma Controller" },
    ]);
  });

  it("renders the page heading and area badge", async () => {
    renderJobsPage();
    await waitForJobsLoaded();

    expect(screen.getByText("South Area")).toBeInTheDocument();
  });

  it("renders the new job link for a coordinator", async () => {
    renderJobsPage();
    await waitForJobsLoaded();

    const newJobLink = await screen.findByRole("button", { name: "New Job" });
    expect(newJobLink).toHaveAttribute("href", "/jobs/new");
  });

  it("hides the new job control for a rider", async () => {
    renderJobsPage("/jobs", { roles: [Role.Rider] });
    await waitForJobsLoaded();

    expect(
      screen.queryByRole("button", { name: "New Job" }),
    ).not.toBeInTheDocument();
  });

  it("renders active job cards by default", async () => {
    renderJobsPage();
    await waitForJobsLoaded();

    expect(screen.getByText("JB-1042")).toBeInTheDocument();
    expect(screen.getByText("JB-1038")).toBeInTheDocument();
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
    expect(screen.getAllByText("Open").length).toBeGreaterThan(0);
  });

  it("filters jobs when searching", async () => {
    const user = userEvent.setup();
    renderJobsPage();
    await waitForJobsLoaded();

    await user.type(
      screen.getByRole("searchbox", {
        name: /search jobs by reference or hospital/i,
      }),
      "Glamorgan",
    );

    expect(screen.getByText("JB-1042")).toBeInTheDocument();
    expect(screen.queryByText("JB-1038")).not.toBeInTheDocument();
  });

  it("switches to completed jobs when the Completed tab is active", async () => {
    const user = userEvent.setup();
    renderJobsPage();
    await waitForJobsLoaded();

    await user.click(screen.getByRole("tab", { name: "Completed" }));

    expect(screen.getByText("JB-1020")).toBeInTheDocument();
    expect(screen.getAllByText("View").length).toBeGreaterThan(0);
    expect(screen.queryByText("JB-1042")).not.toBeInTheDocument();
  });

  it("filters active jobs by status tab", async () => {
    const user = userEvent.setup();
    renderJobsPage();
    await waitForJobsLoaded();

    await user.click(screen.getByRole("tab", { name: "New" }));

    expect(screen.getByText("JB-1042")).toBeInTheDocument();
    expect(screen.queryByText("JB-1038")).not.toBeInTheDocument();
  });

  it("opens the new job drawer when the route is /jobs/new", async () => {
    renderJobsPage("/jobs/new");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "New Job", level: 2 }),
      ).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Caller name")).toBeInTheDocument();
    expect(screen.getByLabelText("Collection location")).toBeInTheDocument();
  });

  it("does not open the new job form for a rider", async () => {
    const { router } = renderJobsPage("/jobs/new", { roles: [Role.Rider] });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/jobs");
    });
    expect(
      screen.queryByRole("heading", { name: "New Job", level: 2 }),
    ).not.toBeInTheDocument();
  });

  it("opens the assign rider drawer at /jobs/new/assign", async () => {
    renderJobsPage("/jobs/new/assign");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Assign rider", level: 2 }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Available riders")).toBeInTheDocument();
  });

  it("links job cards to their detail pages", async () => {
    renderJobsPage();
    await waitForJobsLoaded();

    const jobLink = screen.getByRole("link", { name: /JB-1042/i });
    expect(jobLink).toHaveAttribute("href", "/jobs/1");
  });
});
