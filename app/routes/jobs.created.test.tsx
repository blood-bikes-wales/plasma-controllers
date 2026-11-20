import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearActiveRole } from "~/lib/active-role";
import { AuthProvider } from "~/lib/auth";
import { clearAuthToken, setAuthToken } from "~/lib/auth-token";
import type { DeliveryJob } from "~/lib/jobs";
import { Role } from "~/lib/roles";

import { mockAuthUser } from "../../tests/auth-fixtures";
import { mockActiveJobs, stubJobsFetch } from "../../tests/job-fixtures";
import JobsPage from "./jobs";
import JobsNewRoute from "./jobs-new";

const created: { job: DeliveryJob } = { job: mockActiveJobs[0] };

// The real drawer is covered by its own tests. Here it only reports a job as created,
// so this file can check where the board sends the controller afterwards.
vi.mock("~/components/new-job-drawer", () => ({
  NewJobDrawer: ({
    open,
    onCreated,
  }: {
    open: boolean;
    onCreated?: (job: DeliveryJob) => void;
  }) =>
    open ? (
      <button type="button" onClick={() => onCreated?.(created.job)}>
        Pretend the job was created
      </button>
    ) : null,
}));

afterEach(() => {
  clearAuthToken();
  clearActiveRole();
  vi.unstubAllGlobals();
});

function renderBoard() {
  setAuthToken("test-google-id-token");
  vi.stubGlobal(
    "fetch",
    stubJobsFetch({ ...mockAuthUser, roles: [Role.Controller] }),
  );

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
          { path: "new", element: <JobsNewRoute /> },
          { path: ":jobId", element: <p>Job detail page</p> },
        ],
      },
    ],
    { initialEntries: ["/jobs"] },
  );
  render(<RouterProvider router={router} />);

  return router;
}

async function openNewJobAndCreate(router: ReturnType<typeof renderBoard>) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "New Job" }));
  await waitFor(() => {
    expect(router.state.location.pathname).toBe("/jobs/new");
  });
  await user.click(
    await screen.findByRole("button", { name: "Pretend the job was created" }),
  );
}

describe("After creating a job", () => {
  it("takes the controller to the job's detail for a milk job", async () => {
    created.job = {
      ...mockActiveJobs[0],
      id: "77777777-7777-7777-7777-777777777777",
      jobType: "milk",
      milkLitres: 2.5,
      needsMotherContact: true,
    };
    const router = renderBoard();

    await openNewJobAndCreate(router);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        "/jobs/77777777-7777-7777-7777-777777777777",
      );
    });
    expect(await screen.findByText("Job detail page")).toBeInTheDocument();
  });

  it("goes back to the jobs list for a standard job", async () => {
    created.job = { ...mockActiveJobs[0], jobType: "standard" };
    const router = renderBoard();

    await openNewJobAndCreate(router);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/jobs");
    });
    expect(screen.queryByText("Job detail page")).not.toBeInTheDocument();
  });

  it("goes back to the jobs list for a job from an API that predates job types", async () => {
    const { jobType: _jobType, ...legacy } = mockActiveJobs[0];
    created.job = legacy;
    const router = renderBoard();

    await openNewJobAndCreate(router);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/jobs");
    });
  });
});
