import { render, screen, waitFor, within } from "@testing-library/react";
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
// Jobs the pretend API has stored: the mocked drawer adds the created job here, and the
// board's next list request returns it, as the real API would.
const stored: DeliveryJob[] = [];

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
      <button
        type="button"
        onClick={() => {
          stored.push(created.job);
          onCreated?.(created.job);
        }}
      >
        Pretend the job was created
      </button>
    ) : null,
}));

afterEach(() => {
  stored.length = 0;
  clearAuthToken();
  clearActiveRole();
  vi.unstubAllGlobals();
});

function renderBoard() {
  setAuthToken("test-google-id-token");
  const base = stubJobsFetch({ ...mockAuthUser, roles: [Role.Controller] });
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const isList =
        (init?.method ?? "GET").toUpperCase() === "GET" &&
        String(input).includes("/jobs/active");
      if (isList) {
        return new Response(
          JSON.stringify({ data: [...stored, ...mockActiveJobs] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      return base(input, init);
    },
  );
  vi.stubGlobal("fetch", fetchMock);

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
  // Every page the controller passes through, so a test can prove none was a rider step.
  const visited: string[] = [router.state.location.pathname];
  router.subscribe((state) => {
    visited.push(state.location.pathname);
  });
  render(<RouterProvider router={router} />);

  return { router, visited, fetchMock };
}

async function openNewJobAndCreate(
  router: ReturnType<typeof renderBoard>["router"],
) {
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
    const { router } = renderBoard();

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
    const { router } = renderBoard();

    await openNewJobAndCreate(router);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/jobs");
    });
    expect(screen.queryByText("Job detail page")).not.toBeInTheDocument();
  });

  it("goes back to the jobs list for a job from an API that predates job types", async () => {
    const { jobType: _jobType, ...legacy } = mockActiveJobs[0];
    created.job = legacy;
    const { router } = renderBoard();

    await openNewJobAndCreate(router);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/jobs");
    });
  });
});

describe("Creating a job scheduled for the future, with nobody on shift", () => {
  const futureJob: DeliveryJob = {
    ...mockActiveJobs[0],
    id: "88888888-8888-8888-8888-888888888888",
    reference: "JB-2001",
    status: "New",
    allowedActions: ["allocate", "cancel", "relay"],
    allocatedRider: null,
    scheduledCollectionAt: new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString(),
  };

  function allocateCalls(
    fetchMock: ReturnType<typeof renderBoard>["fetchMock"],
  ) {
    return fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("/actions/allocate"),
    );
  }

  it("never opens the assign rider step and lists the New job for a standard job", async () => {
    created.job = { ...futureJob, jobType: "standard" };
    const { router, visited, fetchMock } = renderBoard();

    await openNewJobAndCreate(router);

    const card = await screen.findByRole("link", { name: /JB-2001/ });
    expect(within(card).getByText("New")).toBeInTheDocument();
    expect(within(card).getByText(/^Collection /)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/jobs");
    expect(visited.some((path) => path.includes("assign"))).toBe(false);
    expect(
      screen.queryByRole("heading", { name: "Assign rider" }),
    ).not.toBeInTheDocument();
    expect(allocateCalls(fetchMock)).toHaveLength(0);
  });

  it("never opens the assign rider step and lists the New job for a milk job", async () => {
    created.job = {
      ...futureJob,
      jobType: "milk",
      milkLitres: 2.5,
      needsMotherContact: false,
    };
    const { router, visited, fetchMock } = renderBoard();

    await openNewJobAndCreate(router);

    const card = await screen.findByRole("link", { name: /JB-2001/ });
    expect(within(card).getByText("New")).toBeInTheDocument();
    expect(within(card).getByText(/^Collection /)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/jobs");
    expect(screen.queryByText("Job detail page")).not.toBeInTheDocument();
    expect(visited.some((path) => path.includes("assign"))).toBe(false);
    expect(
      screen.queryByRole("heading", { name: "Assign rider" }),
    ).not.toBeInTheDocument();
    expect(allocateCalls(fetchMock)).toHaveLength(0);
  });
});
