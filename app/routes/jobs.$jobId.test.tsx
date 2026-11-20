import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import {
  createMemoryRouter,
  Outlet,
  type RouteObject,
  RouterProvider,
} from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearActiveRole, setActiveRole } from "~/lib/active-role";
import { AuthProvider } from "~/lib/auth";
import { clearAuthToken, setAuthToken } from "~/lib/auth-token";
import type { DeliveryJob } from "~/lib/jobs";
import { Role } from "~/lib/roles";
import type { ActiveShift } from "~/lib/shifts";
import { mockAuthUser } from "../../tests/auth-fixtures";
import {
  mockActiveJobs,
  mockActiveShifts,
  type RecordFailures,
  stubJobsFetch,
} from "../../tests/job-fixtures";
import { appRoutes } from "../../tests/routes-config";

function withAuthProvider(routes: RouteObject[]): RouteObject[] {
  return [
    {
      element: (
        <AuthProvider>
          <Outlet />
        </AuthProvider>
      ),
      children: routes,
    },
  ];
}

function renderJobDetail({
  jobId = mockActiveJobs[0].id,
  roles = [Role.Controller],
  active,
  olderCompleted,
  activeShifts,
  allocateError,
  allocateFailure,
  recordFailures,
  strictMode = false,
}: {
  jobId?: string;
  strictMode?: boolean;
  roles?: Role[];
  active?: DeliveryJob[];
  olderCompleted?: DeliveryJob[];
  activeShifts?: ActiveShift[];
  allocateError?: string;
  allocateFailure?: {
    status: number;
    message: string;
    errors?: Record<string, string[]>;
  };
  recordFailures?: RecordFailures;
} = {}) {
  const user = { ...mockAuthUser, roles };
  setAuthToken("test-google-id-token");
  setActiveRole(roles[0]);
  const fetchStub = vi.fn(
    stubJobsFetch(user, {
      ...(active ? { active } : {}),
      ...(olderCompleted ? { olderCompleted } : {}),
      ...(activeShifts ? { activeShifts } : {}),
      ...(allocateError ? { allocateError } : {}),
      ...(allocateFailure ? { allocateFailure } : {}),
      ...(recordFailures ? { recordFailures } : {}),
    }),
  );
  vi.stubGlobal("fetch", fetchStub);

  const router = createMemoryRouter(withAuthProvider(appRoutes), {
    initialEntries: [`/jobs/${jobId}`],
  });

  const page = <RouterProvider router={router} />;
  render(strictMode ? <StrictMode>{page}</StrictMode> : page);

  return { fetchStub, router };
}

afterEach(() => {
  clearAuthToken();
  clearActiveRole();
  vi.unstubAllGlobals();
});

describe("Job detail loading", () => {
  const oldJob: DeliveryJob = {
    ...mockActiveJobs[0],
    id: "10410410-1111-1111-1111-111111111104",
    reference: "JB-0900",
    status: "Delivered",
    allowedActions: [],
  };

  it("opens a job through GET /jobs/{id}, not by searching the lists", async () => {
    const { fetchStub } = renderJobDetail();

    expect(
      await screen.findByRole("heading", { name: "JB-1042" }),
    ).toBeInTheDocument();

    const urls = fetchStub.mock.calls.map(([url]) => String(url));
    expect(
      urls.some((url) => url.endsWith(`/jobs/${mockActiveJobs[0].id}`)),
    ).toBe(true);
    expect(urls.some((url) => url.endsWith("/jobs/active"))).toBe(false);
    expect(urls.some((url) => url.endsWith("/jobs/completed"))).toBe(false);
  });

  it("opens a completed job the list hides, such as one older than 24 hours", async () => {
    renderJobDetail({ jobId: oldJob.id, olderCompleted: [oldJob] });

    expect(
      await screen.findByRole("heading", { name: "JB-0900" }),
    ).toBeInTheDocument();
  });

  it("says the job was not found when the API returns 404", async () => {
    renderJobDetail({ jobId: "99999999-9999-9999-9999-999999999999" });

    expect(await screen.findByText(/not found/i)).toBeInTheDocument();
  });
});

describe("Job detail lifecycle", () => {
  it("shows allocate controls for a new job when the user can manage jobs", async () => {
    renderJobDetail();

    expect(
      await screen.findByRole("heading", { name: "JB-1042" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Allocate rider" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Record collection" }),
    ).not.toBeInTheDocument();
  });

  it("shows the Milk label and litres on a milk job", async () => {
    const [first, ...rest] = mockActiveJobs;
    renderJobDetail({
      active: [{ ...first, jobType: "milk", milkLitres: 2.5 }, ...rest],
    });

    expect(
      await screen.findByRole("heading", { name: "JB-1042" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Milk")).toBeInTheDocument();
    expect(screen.getByText("2.5 L")).toBeInTheDocument();
  });

  it("shows Milk and litres to every role, including riders", async () => {
    const [first, ...rest] = mockActiveJobs;
    renderJobDetail({
      roles: [Role.Rider],
      active: [{ ...first, jobType: "milk", milkLitres: 2 }, ...rest],
    });

    expect(
      await screen.findByRole("heading", { name: "JB-1042" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Milk")).toBeInTheDocument();
    expect(screen.getByText("2 L")).toBeInTheDocument();
  });

  it("shows the Bereavement badge on a bereavement milk job", async () => {
    const [first, ...rest] = mockActiveJobs;
    renderJobDetail({
      active: [
        { ...first, jobType: "milk", milkLitres: 2.5, isBereavement: true },
        ...rest,
      ],
    });

    expect(
      await screen.findByRole("heading", { name: "JB-1042" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Bereavement")).toBeInTheDocument();
  });

  it("shows no Bereavement badge when the flag is off or absent", async () => {
    const [first, ...rest] = mockActiveJobs;
    renderJobDetail({
      active: [
        { ...first, jobType: "milk", milkLitres: 2.5, isBereavement: false },
        ...rest,
      ],
    });

    expect(
      await screen.findByRole("heading", { name: "JB-1042" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Milk")).toBeInTheDocument();
    expect(screen.queryByText("Bereavement")).not.toBeInTheDocument();
  });

  it("shows the Bereavement badge to every role, including riders", async () => {
    const [first, ...rest] = mockActiveJobs;
    renderJobDetail({
      roles: [Role.Rider],
      active: [
        { ...first, jobType: "milk", milkLitres: 2, isBereavement: true },
        ...rest,
      ],
    });

    expect(
      await screen.findByRole("heading", { name: "JB-1042" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Bereavement")).toBeInTheDocument();
  });

  describe("mother's contact", () => {
    const mother = {
      name: "Megan Evans",
      phone: "07700 900101",
      secondaryPhone: "029 2018 0000",
    };

    function milkJobWith(extra: Partial<DeliveryJob>): DeliveryJob[] {
      const [first, ...rest] = mockActiveJobs;
      return [
        { ...first, jobType: "milk", milkLitres: 2.5, ...extra },
        ...rest,
      ];
    }

    it("shows the mother's name with both numbers as tel: links", async () => {
      renderJobDetail({ active: milkJobWith({ mother }) });

      const section = await screen.findByRole("region", {
        name: "Mother's contact",
      });
      expect(section).toHaveTextContent("Megan Evans");

      const first = screen.getByRole("link", {
        name: "Call Megan Evans: 07700 900101",
      });
      expect(first).toHaveAttribute("href", "tel:07700900101");
      const second = screen.getByRole("link", {
        name: "Call Megan Evans on second number: 029 2018 0000",
      });
      expect(second).toHaveAttribute("href", "tel:02920180000");
    });

    it("shows a single link when there is no second phone", async () => {
      renderJobDetail({
        active: milkJobWith({ mother: { ...mother, secondaryPhone: null } }),
      });

      await screen.findByRole("region", { name: "Mother's contact" });
      expect(screen.getAllByRole("link", { name: /^Call Megan/ })).toHaveLength(
        1,
      );
    });

    it("renders nothing when the API did not send the mother", async () => {
      renderJobDetail({
        roles: [Role.Rider],
        active: milkJobWith({}),
      });

      expect(
        await screen.findByRole("heading", { name: "JB-1042" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Milk")).toBeInTheDocument();
      expect(
        screen.queryByRole("region", { name: "Mother's contact" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByText("Megan Evans")).not.toBeInTheDocument();
    });

    it("renders nothing for a standard job whose mother is null", async () => {
      renderJobDetail({
        active: [
          { ...mockActiveJobs[0], mother: null },
          ...mockActiveJobs.slice(1),
        ],
      });

      expect(
        await screen.findByRole("heading", { name: "JB-1042" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("region", { name: "Mother's contact" }),
      ).not.toBeInTheDocument();
    });
  });

  it("shows no Milk label on a standard job", async () => {
    renderJobDetail();

    expect(
      await screen.findByRole("heading", { name: "JB-1042" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Milk")).not.toBeInTheDocument();
  });

  it("hides lifecycle controls for riders", async () => {
    renderJobDetail({ roles: [Role.Rider] });

    expect(
      await screen.findByRole("heading", { name: "JB-1042" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Allocate rider" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Cancel job" }),
    ).not.toBeInTheDocument();
  });

  it("shows relay conversion controls for a new job", async () => {
    renderJobDetail();

    expect(
      await screen.findByRole("heading", { name: "JB-1042" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Convert to relay" }),
    ).toBeInTheDocument();
  });

  it("allocates a rider as soon as one is chosen and advances the job status", async () => {
    const user = userEvent.setup();
    renderJobDetail();

    expect(
      await screen.findByRole("heading", { name: "Allocate rider" }),
    ).toBeInTheDocument();

    await user.click(screen.getByLabelText("Active shift rider"));
    await user.click(
      await screen.findByRole("option", { name: /Alex Morgan/ }),
    );

    // No button was pressed: choosing the rider is the commit.
    await waitFor(() => {
      expect(screen.getByText("Allocated")).toBeInTheDocument();
    });
    expect(screen.getByText(/Allocated rider:/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Record collection" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Allocate rider" }),
    ).not.toBeInTheDocument();
  });
});

function allocateCalls(fetchStub: ReturnType<typeof vi.fn>) {
  return fetchStub.mock.calls.filter(([input]) =>
    String(input instanceof Request ? input.url : input).includes(
      "/actions/allocate",
    ),
  );
}

function allocateBodies(fetchStub: ReturnType<typeof vi.fn>) {
  return allocateCalls(fetchStub).map(([, init]) =>
    JSON.parse(String((init as RequestInit | undefined)?.body)),
  );
}

/** GET /jobs/{id} calls the page makes, with the response swapped for `served` once the page has loaded. */
function serveJobAfterLoad(jobId: string, served: DeliveryJob) {
  const realFetch = globalThis.fetch;
  const reads: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method?.toUpperCase() ?? "GET";
      if (method === "GET" && url.endsWith(`/jobs/${jobId}`)) {
        reads.push(url);
        return new Response(JSON.stringify(served), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return realFetch(input, init);
    }),
  );
  return reads;
}

describe("Allocate rider on selection", () => {
  const newJobId = mockActiveJobs[0].id;
  const allocatedJobId = mockActiveJobs[1].id;

  it("has no Allocate rider button", async () => {
    renderJobDetail();

    expect(
      await screen.findByRole("heading", { name: "Allocate rider" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /allocate rider/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Active shift rider")).toBeInTheDocument();
  });

  it("posts once with the chosen shiftId", async () => {
    const user = userEvent.setup();
    const { fetchStub } = renderJobDetail();

    await user.click(await screen.findByLabelText("Active shift rider"));
    await user.click(await screen.findByRole("option", { name: /Sam Taylor/ }));

    const riderLine = (await screen.findByText(/Allocated rider:/)).closest(
      "p",
    );
    expect(riderLine).toHaveTextContent("Allocated rider: Sam Taylor");
    expect(allocateBodies(fetchStub)).toEqual([{ shiftId: "shift-2" }]);
  });

  it("disables the field and says Allocating… while the request runs", async () => {
    const user = userEvent.setup();
    renderJobDetail();
    const field = await screen.findByLabelText("Active shift rider");

    // Hold the allocate request open.
    const realFetch = globalThis.fetch;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).includes("/actions/allocate")) {
          await gate;
        }
        return realFetch(input, init);
      }),
    );

    await user.click(field);
    await user.click(
      await screen.findByRole("option", { name: /Alex Morgan/ }),
    );

    expect(await screen.findByText("Allocating…")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Allocating…");
    expect(screen.getByRole("button", { name: "Change" })).toBeDisabled();

    release();

    expect(await screen.findByText(/Allocated rider:/)).toBeInTheDocument();
    expect(screen.queryByText("Allocating…")).not.toBeInTheDocument();
  });

  it("shows a failure under the field, clears the selection and leaves the field usable", async () => {
    const user = userEvent.setup();
    const { fetchStub } = renderJobDetail({
      allocateError: "Allocate only accepts a rider on an active Plasma shift.",
    });

    await user.click(await screen.findByLabelText("Active shift rider"));
    await user.click(
      await screen.findByRole("option", { name: /Alex Morgan/ }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Allocate only accepts a rider on an active Plasma shift.",
    );
    const field = screen.getByLabelText("Active shift rider");
    expect(field).toHaveValue("");
    expect(field).toBeEnabled();
    expect(field).toHaveFocus();
    // Still a New job with the form on show.
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Allocate rider" }),
    ).toBeInTheDocument();

    // And the controller can pick again.
    await user.click(await screen.findByRole("option", { name: /Sam Taylor/ }));
    await waitFor(() => expect(allocateCalls(fetchStub)).toHaveLength(2));
    expect(allocateBodies(fetchStub)).toEqual([
      { shiftId: "shift-1" },
      { shiftId: "shift-2" },
    ]);
  });

  it("shows the empty message when no rider is on shift", async () => {
    renderJobDetail({ activeShifts: [] });

    expect(
      await screen.findByText("No riders are currently on an active shift."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Active shift rider")).toBeDisabled();
  });

  it("posts once when the choice is reported twice", async () => {
    const user = userEvent.setup();
    const { fetchStub } = renderJobDetail();

    await user.click(await screen.findByLabelText("Active shift rider"));
    const option = await screen.findByRole("option", { name: /Sam Taylor/ });
    act(() => {
      fireEvent.click(option);
      fireEvent.click(option);
    });

    expect(await screen.findByText(/Allocated rider:/)).toBeInTheDocument();
    expect(allocateCalls(fetchStub)).toHaveLength(1);
  });

  it("offers the form on an Allocated job, labelled as a change, with the current rider as its value", async () => {
    renderJobDetail({ jobId: allocatedJobId });

    expect(
      await screen.findByRole("heading", { name: "Change rider" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Allocate rider" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("New rider on shift")).toHaveValue(
      "Alex Morgan · CF12 ABC",
    );
    expect(screen.getByText(/Currently allocated to/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Record collection" }),
    ).toBeInTheDocument();
  });

  it("re-allocates an Allocated job, posts once and shows the new rider", async () => {
    const user = userEvent.setup();
    const { fetchStub } = renderJobDetail({ jobId: allocatedJobId });

    await user.click(await screen.findByRole("button", { name: "Change" }));
    await user.click(await screen.findByRole("option", { name: /Sam Taylor/ }));

    await waitFor(() => {
      expect(
        screen.getByText(/Allocated rider:/).closest("p"),
      ).toHaveTextContent("Allocated rider: Sam Taylor");
    });
    expect(screen.getByText(/Currently allocated to/)).toHaveTextContent(
      "Currently allocated to Sam Taylor",
    );
    expect(screen.getByLabelText("New rider on shift")).toHaveValue(
      "Sam Taylor · CF34 DEF",
    );
    expect(screen.getByText("Allocated")).toBeInTheDocument();
    expect(allocateBodies(fetchStub)).toEqual([{ shiftId: "shift-2" }]);
  });

  it("posts nothing when the already-allocated rider is chosen again", async () => {
    const user = userEvent.setup();
    const { fetchStub } = renderJobDetail({ jobId: allocatedJobId });

    await user.click(await screen.findByRole("button", { name: "Change" }));
    await user.click(
      await screen.findByRole("option", { name: /Alex Morgan/ }),
    );

    expect(screen.getByLabelText("New rider on shift")).toHaveValue(
      "Alex Morgan · CF12 ABC",
    );
    expect(allocateCalls(fetchStub)).toHaveLength(0);
  });

  it("does not offer the form to roles that cannot manage jobs", async () => {
    renderJobDetail({ jobId: allocatedJobId, roles: [Role.Rider] });

    expect(
      await screen.findByRole("heading", { name: "JB-1038" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Change rider" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("New rider on shift"),
    ).not.toBeInTheDocument();
  });

  it("does not offer the form once the job is Collected", async () => {
    const [, allocated] = mockActiveJobs;
    const collected: DeliveryJob = {
      ...allocated,
      status: "Collected",
      allowedActions: ["deliver", "cancel"],
    };
    renderJobDetail({ jobId: collected.id, active: [collected] });

    expect(
      await screen.findByRole("heading", { name: "Record delivery" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /change rider|allocate rider/i }),
    ).not.toBeInTheDocument();
  });

  it("does not offer the form on an Allocated job when the API does not allow allocate", async () => {
    const [, allocated] = mockActiveJobs;
    const older: DeliveryJob = {
      ...allocated,
      allowedActions: ["collect", "cancel"],
    };
    renderJobDetail({ jobId: older.id, active: [older] });

    expect(
      await screen.findByRole("heading", { name: "Record collection" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Change rider" }),
    ).not.toBeInTheDocument();
  });

  it("puts the field back on the current rider when re-allocating fails", async () => {
    const user = userEvent.setup();
    renderJobDetail({
      jobId: allocatedJobId,
      allocateError: "Allocate only accepts a rider on an active Plasma shift.",
    });

    await user.click(await screen.findByRole("button", { name: "Change" }));
    await user.click(await screen.findByRole("option", { name: /Sam Taylor/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Allocate only accepts a rider on an active Plasma shift.",
    );
    expect(screen.getByLabelText("New rider on shift")).toHaveValue(
      "Alex Morgan · CF12 ABC",
    );
    expect(screen.getByLabelText("New rider on shift")).toHaveFocus();
    expect(screen.getByRole("button", { name: "Change" })).toBeEnabled();
  });

  /** Replace GET /shifts/active after load: each call takes the next entry (the last repeats); "error" fails it. */
  function stubShiftsAfterLoad(responses: (ActiveShift[] | "error")[]) {
    const realFetch = globalThis.fetch;
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (!String(input).includes("/shifts/active")) {
          return realFetch(input, init);
        }

        const next =
          responses[Math.min(calls.length, responses.length - 1)] ?? [];
        calls.push("shifts");
        if (next === "error") {
          return new Response(JSON.stringify({ message: "Boom" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ data: next }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
    return calls;
  }

  it("re-reads the active shifts after a failed allocation so a rider who logged off is not offered again", async () => {
    const user = userEvent.setup();
    renderJobDetail({ allocateError: "The selected shift is invalid." });
    await screen.findByLabelText("Active shift rider");
    const calls = stubShiftsAfterLoad([[mockActiveShifts[1]]]);

    await user.click(screen.getByLabelText("Active shift rider"));
    await user.click(
      await screen.findByRole("option", { name: /Alex Morgan/ }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The selected shift is invalid.",
    );
    await waitFor(() => expect(calls).toHaveLength(1));
    await user.click(screen.getByLabelText("Active shift rider"));
    expect(
      await screen.findByRole("option", { name: /Sam Taylor/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /Alex Morgan/ }),
    ).not.toBeInTheDocument();
  });

  it("re-reads the active shifts after a successful allocation too", async () => {
    const user = userEvent.setup();
    renderJobDetail();
    await screen.findByLabelText("Active shift rider");
    const calls = stubShiftsAfterLoad([mockActiveShifts]);

    await user.click(screen.getByLabelText("Active shift rider"));
    await user.click(await screen.findByRole("option", { name: /Sam Taylor/ }));

    await screen.findByText(/Allocated rider:/);
    await waitFor(() => expect(calls).toHaveLength(1));
  });

  it("keeps the old list and the error when the refresh fails", async () => {
    const user = userEvent.setup();
    renderJobDetail({ allocateError: "The selected shift is invalid." });
    await screen.findByLabelText("Active shift rider");
    const calls = stubShiftsAfterLoad(["error"]);

    await user.click(screen.getByLabelText("Active shift rider"));
    await user.click(
      await screen.findByRole("option", { name: /Alex Morgan/ }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The selected shift is invalid.",
    );
    await waitFor(() => expect(calls).toHaveLength(1));
    await user.click(screen.getByLabelText("Active shift rider"));
    expect(
      await screen.findByRole("option", { name: /Alex Morgan/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("ignores an allocation result that arrives after the page moved to another job", async () => {
    const user = userEvent.setup();
    const { router } = renderJobDetail();
    const field = await screen.findByLabelText("Active shift rider");

    // Hold the allocate request for JB-1042 open.
    const realFetch = globalThis.fetch;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const response = await realFetch(input, init);
        if (String(input).includes("/actions/allocate")) {
          await gate;
        }
        return response;
      }),
    );

    await user.click(field);
    await user.click(await screen.findByRole("option", { name: /Sam Taylor/ }));
    expect(await screen.findByText("Allocating…")).toBeInTheDocument();

    await act(async () => {
      await router.navigate(`/jobs/${allocatedJobId}`);
    });
    expect(
      await screen.findByRole("heading", { name: "JB-1038" }),
    ).toBeInTheDocument();

    await act(async () => {
      release();
      await gate;
    });
    // Let the stale result land.
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(
      screen.getByRole("heading", { name: "JB-1038" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "JB-1042" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Allocated rider:/).closest("p")).toHaveTextContent(
      "Allocated rider: Alex Morgan",
    );
  });

  it("reloads the job once after a failure about the job's state, so a stale page corrects itself", async () => {
    const user = userEvent.setup();
    const [, allocated] = mockActiveJobs;
    const message = "Job is Collected. Allowed actions: deliver, cancel.";
    const { fetchStub } = renderJobDetail({
      jobId: allocatedJobId,
      allocateFailure: { status: 422, message, errors: { action: [message] } },
    });
    await screen.findByRole("heading", { name: "Change rider" });
    const reads = serveJobAfterLoad(allocatedJobId, {
      ...allocated,
      status: "Collected",
      allowedActions: ["deliver", "cancel"],
    });

    await user.click(screen.getByRole("button", { name: "Change" }));
    await user.click(await screen.findByRole("option", { name: /Sam Taylor/ }));

    // The page now shows the job as it really is, and says why the change failed.
    expect(
      await screen.findByRole("heading", { name: "Record delivery" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Change rider" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(screen.getByText("Collected")).toBeInTheDocument();

    // One re-read, one allocate attempt: no loop.
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(reads).toHaveLength(1);
    expect(allocateCalls(fetchStub)).toHaveLength(1);
  });

  it("keeps the form and its error when the reload shows the job can still be allocated", async () => {
    const user = userEvent.setup();
    const [, allocated] = mockActiveJobs;
    const message = "Something about the job.";
    renderJobDetail({
      jobId: allocatedJobId,
      allocateFailure: { status: 409, message },
    });
    await screen.findByRole("heading", { name: "Change rider" });
    const reads = serveJobAfterLoad(allocatedJobId, allocated);

    await user.click(screen.getByRole("button", { name: "Change" }));
    await user.click(await screen.findByRole("option", { name: /Sam Taylor/ }));

    await waitFor(() => expect(reads).toHaveLength(1));
    // The field's own error is the only alert.
    expect(await screen.findAllByRole("alert")).toHaveLength(1);
    expect(
      screen.getByRole("heading", { name: "Change rider" }),
    ).toBeInTheDocument();
  });

  it("does not reload the job after a validation error on the shift", async () => {
    const user = userEvent.setup();
    const [newJob] = mockActiveJobs;
    renderJobDetail({
      allocateFailure: {
        status: 422,
        message: "The selected shift is invalid.",
        errors: { shiftId: ["The selected shift is invalid."] },
      },
    });
    await screen.findByLabelText("Active shift rider");
    const reads = serveJobAfterLoad(newJob.id, newJob);

    await user.click(screen.getByLabelText("Active shift rider"));
    await user.click(
      await screen.findByRole("option", { name: /Alex Morgan/ }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The selected shift is invalid.",
    );
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(reads).toHaveLength(0);
  });

  it("does not reload the job after a server error", async () => {
    const user = userEvent.setup();
    const [newJob] = mockActiveJobs;
    renderJobDetail({
      allocateFailure: { status: 500, message: "Server error." },
    });
    await screen.findByLabelText("Active shift rider");
    const reads = serveJobAfterLoad(newJob.id, newJob);

    await user.click(screen.getByLabelText("Active shift rider"));
    await user.click(
      await screen.findByRole("option", { name: /Alex Morgan/ }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Server error.");
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(reads).toHaveLength(0);
  });

  it("shows no allocate form on a relay parent", async () => {
    const [newJob] = mockActiveJobs;
    const parent: DeliveryJob = {
      ...newJob,
      id: "33333333-3333-3333-3333-333333333333",
      reference: "JB-2000",
      isRelay: true,
      allowedActions: ["cancel"],
      legs: [],
    };
    renderJobDetail({ jobId: parent.id, active: [parent] });

    expect(
      await screen.findByRole("heading", { name: "Cancel job" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /allocate rider|change rider/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Active shift rider"),
    ).not.toBeInTheDocument();
  });

  it("offers a New job's form unchanged when the API sends no allowed actions", async () => {
    const [newJob] = mockActiveJobs;
    const { allowedActions: _omitted, ...withoutActions } = newJob;
    renderJobDetail({ jobId: newJobId, active: [withoutActions] });

    expect(
      await screen.findByRole("heading", { name: "Allocate rider" }),
    ).toBeInTheDocument();
  });
});

describe("Record collection job number", () => {
  const allocatedJobId = mockActiveJobs[1].id;

  it("labels the field Job number and not Receipt number", async () => {
    renderJobDetail({ jobId: allocatedJobId });

    expect(
      await screen.findByRole("heading", { name: "Record collection" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Job number")).toBeInTheDocument();
    expect(screen.queryByLabelText("Receipt number")).not.toBeInTheDocument();
  });

  it("requires a job number", async () => {
    const user = userEvent.setup();
    renderJobDetail({ jobId: allocatedJobId });

    await user.click(await screen.findByLabelText("Job number"));
    await user.keyboard("{Enter}");

    expect(await screen.findByText("Enter a job number")).toBeInTheDocument();
    expect(screen.queryByText(/receipt number/i)).not.toBeInTheDocument();
  });

  it("shows the job number on the job detail after collection", async () => {
    const user = userEvent.setup();
    renderJobDetail({ jobId: allocatedJobId });

    await user.click(await screen.findByLabelText("Contents confirmed"));
    await user.click(await screen.findByRole("option", { name: "Yes" }));
    await user.type(screen.getByLabelText("Job number"), "JN-2042{Enter}");

    expect(
      await screen.findByText(/^Collected .+ · job JN-2042$/),
    ).toBeVisible();
    expect(screen.queryByText(/receipt/i)).not.toBeInTheDocument();
  });
});

describe("Record collection fields", () => {
  const allocatedJobId = mockActiveJobs[1].id;

  it("does not ask whether the package is sealed or for a seal number", async () => {
    renderJobDetail({ jobId: allocatedJobId });

    expect(
      await screen.findByRole("heading", { name: "Record collection" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Contents confirmed")).toBeInTheDocument();
    expect(screen.getByLabelText("Job number")).toBeInTheDocument();
    expect(screen.getByLabelText("Collection time")).toBeInTheDocument();
    expect(screen.queryByLabelText("Suitably sealed")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Seal number")).not.toBeInTheDocument();
    expect(screen.queryByText(/seal/i)).not.toBeInTheDocument();
  });

  it("submits the collection without seal fields", async () => {
    const user = userEvent.setup();
    const { fetchStub } = renderJobDetail({ jobId: allocatedJobId });

    await user.click(await screen.findByLabelText("Contents confirmed"));
    await user.click(await screen.findByRole("option", { name: "Yes" }));
    await user.type(screen.getByLabelText("Job number"), "JN-2043{Enter}");

    expect(
      await screen.findByText(/^Collected .+ · job JN-2043$/),
    ).toBeVisible();

    const collectCall = fetchStub.mock.calls.find(([input]) =>
      String(input instanceof Request ? input.url : input).includes(
        "/actions/collect",
      ),
    );
    expect(collectCall).toBeDefined();
    const [, init] = collectCall ?? [];
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      contentsConfirmed: true,
      receiptNumber: "JN-2043",
    });
    expect(body).not.toHaveProperty("suitablySealed");
    expect(body).not.toHaveProperty("sealNumber");
  });
});

describe("Record collection and delivery time only", () => {
  // Local time (no "Z") so the job's calendar day is the same in any timezone.
  const createdAt = "2026-03-10T09:00:00";
  const base = mockActiveJobs[1];
  const allocated: DeliveryJob = { ...base, createdAt };
  const collected: DeliveryJob = {
    ...base,
    id: "33333333-3333-3333-3333-333333333333",
    status: "Collected",
    createdAt,
    allowedActions: ["deliver", "cancel"],
  };
  const relayLeg: DeliveryJob = {
    ...base,
    id: "44444444-4444-4444-4444-444444444444",
    reference: "JB-2000-L1",
    createdAt,
    parentJobId: "55555555-5555-5555-5555-555555555555",
    legNumber: 1,
  };
  const relayParent: DeliveryJob = {
    ...base,
    id: "55555555-5555-5555-5555-555555555555",
    reference: "JB-2000",
    createdAt,
    isRelay: true,
    legs: [relayLeg],
  };

  function requestBody(
    fetchStub: ReturnType<typeof renderJobDetail>["fetchStub"],
    action: string,
  ) {
    const call = fetchStub.mock.calls.find(([input]) =>
      String(input instanceof Request ? input.url : input).includes(
        `/actions/${action}`,
      ),
    );
    expect(call).toBeDefined();
    return JSON.parse(String(call?.[1]?.body));
  }

  function localDay(iso: string) {
    const date = new Date(iso);
    return [date.getFullYear(), date.getMonth() + 1, date.getDate()];
  }

  async function fillCollection(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByLabelText("Contents confirmed"));
    await user.click(await screen.findByRole("option", { name: "Yes" }));
    await user.type(screen.getByLabelText("Job number"), "JN-3001");
  }

  it("shows a time input and no date input when recording collection", async () => {
    renderJobDetail({ jobId: allocated.id, active: [allocated] });

    const input = await screen.findByLabelText("Collection time");
    expect(input).toHaveAttribute("type", "time");
    expect((input as HTMLInputElement).value).toMatch(/^\d{2}:\d{2}$/);
    expect(document.querySelector('input[type="datetime-local"]')).toBeNull();
    expect(document.querySelector('input[type="date"]')).toBeNull();
  });

  it("sends a collection timestamp on the job's created day", async () => {
    const user = userEvent.setup();
    const { fetchStub } = renderJobDetail({
      jobId: allocated.id,
      active: [allocated],
    });

    await fillCollection(user);
    fireEvent.change(screen.getByLabelText("Collection time"), {
      target: { value: "14:30" },
    });
    await user.click(screen.getByLabelText("Job number"));
    await user.keyboard("{Enter}");

    expect(
      await screen.findByText("Collected 10 Mar, 14:30 · job JN-3001"),
    ).toBeVisible();
    const { collectedAt } = requestBody(fetchStub, "collect");
    expect(localDay(collectedAt)).toEqual([2026, 3, 10]);
    const sent = new Date(collectedAt);
    expect([sent.getHours(), sent.getMinutes()]).toEqual([14, 30]);
  });

  it("shows a time input and sends a delivery timestamp on the job's created day", async () => {
    const user = userEvent.setup();
    const { fetchStub } = renderJobDetail({
      jobId: collected.id,
      active: [collected],
    });

    const input = await screen.findByLabelText("Delivery time");
    expect(input).toHaveAttribute("type", "time");
    expect(document.querySelector('input[type="datetime-local"]')).toBeNull();
    expect(document.querySelector('input[type="date"]')).toBeNull();

    await user.type(screen.getByLabelText("Recipient"), "Sister Jones");
    fireEvent.change(input, { target: { value: "16:45" } });
    await user.click(screen.getByLabelText("Recipient"));
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(
        screen.getByText("Delivered 10 Mar, 16:45 to Sister Jones"),
      ).toBeVisible();
    });
    const { deliveredAt } = requestBody(fetchStub, "deliver");
    expect(localDay(deliveredAt)).toEqual([2026, 3, 10]);
    const sent = new Date(deliveredAt);
    expect([sent.getHours(), sent.getMinutes()]).toEqual([16, 45]);
  });

  it("shows the Recipient error when it is empty and the box is not ticked", async () => {
    const user = userEvent.setup();
    const { fetchStub } = renderJobDetail({
      jobId: collected.id,
      active: [collected],
    });

    expect(await screen.findByLabelText("Recipient")).toBeEnabled();
    expect(
      screen.getByRole("checkbox", { name: "No person or recipient" }),
    ).not.toBeChecked();
    await user.click(screen.getByLabelText("Recipient"));
    await user.keyboard("{Enter}");

    expect(await screen.findByText("Enter the recipient")).toBeVisible();
    expect(
      fetchStub.mock.calls.some(([input]) =>
        String(input instanceof Request ? input.url : input).includes(
          "/actions/deliver",
        ),
      ),
    ).toBe(false);
  });

  it("disables and clears Recipient when 'No person or recipient' is ticked, and re-enables it when unticked", async () => {
    const user = userEvent.setup();
    renderJobDetail({ jobId: collected.id, active: [collected] });

    const recipient = await screen.findByLabelText("Recipient");
    const checkbox = screen.getByRole("checkbox", {
      name: "No person or recipient",
    });

    await user.type(recipient, "Sister Jones");
    await user.click(checkbox);
    expect(recipient).toBeDisabled();
    expect(recipient).toHaveValue("");

    await user.click(checkbox);
    expect(recipient).toBeEnabled();
    expect(recipient).toHaveValue("");
  });

  it("clears a showing Recipient error when the box is ticked", async () => {
    const user = userEvent.setup();
    renderJobDetail({ jobId: collected.id, active: [collected] });

    await user.click(await screen.findByLabelText("Recipient"));
    await user.keyboard("{Enter}");
    expect(await screen.findByText("Enter the recipient")).toBeVisible();

    await user.click(
      screen.getByRole("checkbox", { name: "No person or recipient" }),
    );
    expect(screen.queryByText("Enter the recipient")).not.toBeInTheDocument();
  });

  it("records a delivery with no recipient and says so on the job", async () => {
    const user = userEvent.setup();
    const { fetchStub } = renderJobDetail({
      jobId: collected.id,
      active: [collected],
    });

    // Ticking the box is the last missing field: it records at once.
    await user.click(
      await screen.findByRole("checkbox", { name: "No person or recipient" }),
    );

    expect(
      await screen.findByText(/^Delivered .+, no recipient$/),
    ).toBeVisible();
    expect(screen.queryByText(/Delivered .* to /)).not.toBeInTheDocument();
    const body = requestBody(fetchStub, "deliver");
    expect(body.noRecipient).toBe(true);
    expect(body).not.toHaveProperty("recipient");
  });

  it("sends noRecipient false with the recipient when the box is not ticked", async () => {
    const user = userEvent.setup();
    const { fetchStub } = renderJobDetail({
      jobId: collected.id,
      active: [collected],
    });

    await user.type(
      await screen.findByLabelText("Recipient"),
      "Sister Jones{Enter}",
    );

    expect(
      await screen.findByText(/^Delivered .+ to Sister Jones$/),
    ).toBeVisible();
    const body = requestBody(fetchStub, "deliver");
    expect(body.noRecipient).toBe(false);
    expect(body.recipient).toBe("Sister Jones");
  });

  it("shows 'Delivered, no recipient' for an already delivered job with a null recipient", async () => {
    const delivered: DeliveryJob = {
      ...base,
      id: "66666666-6666-6666-6666-666666666666",
      status: "Delivered",
      createdAt,
      allowedActions: [],
      deliveryRecord: {
        recipient: null,
        noRecipient: true,
        deliveredAt: "2026-03-10T16:45:00",
      },
    };
    renderJobDetail({ jobId: delivered.id, active: [delivered] });

    expect(
      await screen.findByText("Delivered 10 Mar, 16:45, no recipient"),
    ).toBeVisible();
  });

  it("keeps the date-and-time picker for a leg of a relay", async () => {
    renderJobDetail({
      jobId: relayLeg.id,
      active: [relayParent],
    });

    const input = await screen.findByLabelText("Collection time");
    expect(input).toHaveAttribute("type", "datetime-local");
  });

  it("keeps the date-and-time picker for a relay parent", async () => {
    renderJobDetail({
      jobId: relayParent.id,
      active: [relayParent],
    });

    const input = await screen.findByLabelText("Collection time");
    expect(input).toHaveAttribute("type", "datetime-local");
  });
});

describe("Job detail location notes", () => {
  const [baseJob] = mockActiveJobs;

  it("shows the collection and delivery notes under the matching addresses", async () => {
    renderJobDetail({
      active: [
        {
          ...baseJob,
          collection: { ...baseJob.collection, notes: "path lab" },
          delivery: { ...baseJob.delivery, notes: "reception outside" },
        },
      ],
    });

    const collectionNote = await screen.findByText("path lab");
    const deliveryNote = screen.getByText("reception outside");
    expect(collectionNote.previousElementSibling).toHaveTextContent(
      baseJob.collection.address,
    );
    expect(deliveryNote.previousElementSibling).toHaveTextContent(
      baseJob.delivery.address,
    );
  });

  it("shows only the note that was entered", async () => {
    renderJobDetail({
      active: [
        {
          ...baseJob,
          collection: { ...baseJob.collection, notes: "path lab" },
          delivery: { ...baseJob.delivery, notes: null },
        },
      ],
    });

    const collectionNote = await screen.findByText("path lab");
    expect(collectionNote.parentElement?.children).toHaveLength(2);
    const deliveryAddress = screen.getByText(baseJob.delivery.address);
    expect(deliveryAddress.parentElement?.children).toHaveLength(1);
  });

  it("hides the note lines when the notes are null or absent", async () => {
    renderJobDetail({
      active: [
        {
          ...baseJob,
          collection: { ...baseJob.collection, notes: null },
          delivery: { ...baseJob.delivery },
        },
      ],
    });

    const address = await screen.findByText(baseJob.collection.address);
    expect(address.parentElement?.children).toHaveLength(1);
    const deliveryAddress = screen.getByText(baseJob.delivery.address);
    expect(deliveryAddress.parentElement?.children).toHaveLength(1);
  });
});

describe("Job detail estimated times", () => {
  const [baseJob] = mockActiveJobs;

  function atToday(hours: number, minutes: number) {
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date.toISOString();
  }

  it("shows each estimate under the matching address", async () => {
    renderJobDetail({
      active: [
        {
          ...baseJob,
          estimatedCollectionAt: atToday(9, 30),
          estimatedDeliveryAt: atToday(11, 15),
        },
      ],
    });

    const collection = await screen.findByText(
      "Estimated collection: Today, 09:30",
    );
    const delivery = screen.getByText("Estimated delivery: Today, 11:15");
    expect(collection.previousElementSibling).toHaveTextContent(
      baseJob.collection.address,
    );
    expect(delivery.previousElementSibling).toHaveTextContent(
      baseJob.delivery.address,
    );
  });

  it("shows only the estimate that was set", async () => {
    renderJobDetail({
      active: [
        {
          ...baseJob,
          estimatedCollectionAt: atToday(9, 30),
          estimatedDeliveryAt: null,
        },
      ],
    });

    expect(
      await screen.findByText("Estimated collection: Today, 09:30"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Estimated delivery/)).not.toBeInTheDocument();
  });

  it("shows no estimate lines when both are null or absent", async () => {
    renderJobDetail({
      active: [{ ...baseJob, estimatedCollectionAt: null }],
    });

    const address = await screen.findByText(baseJob.collection.address);
    expect(address.parentElement?.children).toHaveLength(1);
    expect(screen.queryByText(/Estimated/)).not.toBeInTheDocument();
  });

  it("shows estimates to a rider who can only view jobs", async () => {
    renderJobDetail({
      roles: [Role.Rider],
      active: [{ ...baseJob, estimatedDeliveryAt: atToday(11, 15) }],
    });

    expect(
      await screen.findByText("Estimated delivery: Today, 11:15"),
    ).toBeInTheDocument();
  });
});

describe("Job detail relay arrival times", () => {
  const [baseJob] = mockActiveJobs;

  function atToday(hours: number, minutes: number) {
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date.toISOString();
  }

  function leg(
    legNumber: number,
    delivery: string,
    plannedArrivalAt: string | null,
  ): DeliveryJob {
    return {
      ...baseJob,
      id: `leg-${legNumber}`,
      reference: `JB-2100-L${legNumber}`,
      legNumber,
      parentJobId: "relay-parent",
      delivery: { ...baseJob.delivery, address: delivery },
      plannedArrivalAt,
      allowedActions: ["allocate", "cancel"],
    };
  }

  it("lists each handoff's arrival time in the legs and none for the final hospital", async () => {
    const parent: DeliveryJob = {
      ...baseJob,
      id: "relay-parent",
      reference: "JB-2100",
      isRelay: true,
      allowedActions: ["cancel"],
      legs: [
        leg(1, "Handoff One", atToday(10, 15)),
        leg(2, "Handoff Two", atToday(13, 40)),
        leg(3, "Final Hospital", null),
      ],
    };
    renderJobDetail({ jobId: parent.id, active: [parent] });

    const first = await screen.findByText("Arrives: Today, 10:15");
    const second = screen.getByText("Arrives: Today, 13:40");
    expect(screen.getAllByText(/^Arrives:/)).toHaveLength(2);
    expect(first.previousElementSibling).toHaveTextContent("Handoff One");
    expect(second.previousElementSibling).toHaveTextContent("Handoff Two");
  });

  describe("Job detail postcodes", () => {
    const [baseJob] = mockActiveJobs;

    it("shows each postcode after its address", async () => {
      renderJobDetail({
        active: [
          {
            ...baseJob,
            collection: { ...baseJob.collection, postcode: "CF72 8XR" },
            delivery: { ...baseJob.delivery, postcode: "CF14 4XW" },
          },
        ],
      });

      expect(
        await screen.findByText(`${baseJob.collection.address}, CF72 8XR`),
      ).toBeInTheDocument();
      expect(
        screen.getByText(`${baseJob.delivery.address}, CF14 4XW`),
      ).toBeInTheDocument();
    });

    it("does not repeat a postcode the address already contains", async () => {
      const address = "University Hospital of Wales, Cardiff CF14 4XW, UK";
      renderJobDetail({
        active: [
          {
            ...baseJob,
            delivery: { ...baseJob.delivery, address, postcode: "CF14 4XW" },
          },
        ],
      });

      expect(await screen.findByText(address)).toBeInTheDocument();
    });

    it("shows the postcodes of relay legs", async () => {
      const parent: DeliveryJob = {
        ...baseJob,
        id: "relay-parent",
        reference: "JB-2200",
        isRelay: true,
        allowedActions: ["cancel"],
        legs: [
          {
            ...baseJob,
            id: "leg-1",
            reference: "JB-2200-L1",
            legNumber: 1,
            parentJobId: "relay-parent",
            collection: {
              ...baseJob.collection,
              address: "Start",
              postcode: "CF1 1AA",
            },
            delivery: {
              ...baseJob.delivery,
              address: "Handoff One CF2 2BB",
              postcode: "CF2 2BB",
            },
          },
        ],
      };
      renderJobDetail({ jobId: parent.id, active: [parent] });

      expect(await screen.findByText("Start, CF1 1AA")).toBeInTheDocument();
      expect(screen.getByText("Handoff One CF2 2BB")).toBeInTheDocument();
    });
  });
});

describe("Job detail waiting for an earlier relay leg", () => {
  const [baseJob] = mockActiveJobs;

  function leg(
    legNumber: number,
    overrides: Partial<DeliveryJob>,
  ): DeliveryJob {
    return {
      ...baseJob,
      id: `leg-${legNumber}`,
      reference: `JB-2300-L${legNumber}`,
      legNumber,
      parentJobId: "relay-parent",
      ...overrides,
    };
  }

  const parent: DeliveryJob = {
    ...baseJob,
    id: "relay-parent",
    reference: "JB-2300",
    isRelay: true,
    allowedActions: ["cancel"],
    legs: [
      leg(1, { status: "Collected", allowedActions: ["deliver", "cancel"] }),
      leg(2, {
        status: "Allocated",
        waitingForLeg: 1,
        allowedActions: ["cancel"],
      }),
      leg(3, {
        status: "Allocated",
        waitingForLeg: 2,
        allowedActions: ["cancel"],
      }),
    ],
  };

  it("shows the waiting message and no Record forms on a blocked leg", async () => {
    renderJobDetail({ jobId: "leg-3", active: [parent] });

    expect(
      await screen.findByText("Waiting for leg 2 to be delivered"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Record collection" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Record delivery" }),
    ).not.toBeInTheDocument();
  });

  it("shows the Record delivery form and no waiting message on a leg that is free", async () => {
    renderJobDetail({ jobId: "leg-1", active: [parent] });

    expect(
      await screen.findByRole("region", { name: "Record delivery" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Waiting for leg/)).not.toBeInTheDocument();
  });

  it("shows the waiting message beside each blocked leg in the legs panel", async () => {
    renderJobDetail({ jobId: parent.id, active: [parent] });

    expect(
      await screen.findByText("Waiting for leg 1 to be delivered"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Waiting for leg 2 to be delivered"),
    ).toBeInTheDocument();
  });
});

describe("Job detail: call the mother and schedule a milk collection", () => {
  const mother = {
    name: "Megan Evans",
    phone: "07700 900101",
    secondaryPhone: "029 2018 0000",
  };
  const base = mockActiveJobs[0];
  const unscheduledMilk: DeliveryJob = {
    ...base,
    jobType: "milk",
    milkLitres: 2.5,
    mother,
    needsMotherContact: true,
    scheduledCollectionAt: null,
  };

  /** A local date-time a week from now at 10:00, as a datetime-local value. */
  function nextWeekAtTen() {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    date.setHours(10, 0, 0, 0);
    const pad = (value: number) => String(value).padStart(2, "0");
    return {
      date,
      value: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T10:00`,
    };
  }

  function scheduleCall(
    fetchStub: ReturnType<typeof renderJobDetail>["fetchStub"],
  ) {
    return fetchStub.mock.calls.find(([input]) =>
      String(input).endsWith("/schedule"),
    );
  }

  it("shows the reminder card with the mother's calls and a time field on an unscheduled milk job", async () => {
    renderJobDetail({ active: [unscheduledMilk] });

    expect(
      await screen.findByRole("heading", {
        name: "Call the mother to arrange collection",
      }),
    ).toBeInTheDocument();
    const card = screen.getByRole("region", { name: "Arrange collection" });
    expect(card).toHaveTextContent("Megan Evans");
    expect(
      within(card).getByRole("link", {
        name: "Call Megan Evans: 07700 900101",
      }),
    ).toHaveAttribute("href", "tel:07700900101");
    expect(
      within(card).getByRole("link", {
        name: "Call Megan Evans on second number: 029 2018 0000",
      }),
    ).toHaveAttribute("href", "tel:02920180000");

    const field = within(card).getByLabelText("Collection date and time");
    expect(field).toHaveAttribute("type", "datetime-local");
    expect(
      within(card).getByRole("button", { name: "Save collection time" }),
    ).toBeInTheDocument();

    // The mother's contact is in the card only, not repeated below it.
    expect(
      screen.getAllByRole("region", { name: "Mother's contact" }),
    ).toHaveLength(1);
  });

  it("shows the reminder to an admin as well", async () => {
    renderJobDetail({ roles: [Role.Admin], active: [unscheduledMilk] });

    expect(
      await screen.findByRole("heading", {
        name: "Call the mother to arrange collection",
      }),
    ).toBeInTheDocument();
  });

  it("never shows the reminder on a standard job", async () => {
    renderJobDetail({
      active: [
        { ...base, jobType: "standard", needsMotherContact: false },
        ...mockActiveJobs.slice(1),
      ],
    });

    expect(
      await screen.findByRole("heading", { name: "JB-1042" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Call the mother to arrange collection"),
    ).not.toBeInTheDocument();
  });

  it("does not show the reminder on a standard job even if the flag were set", async () => {
    renderJobDetail({
      active: [
        { ...base, jobType: "standard", needsMotherContact: true },
        ...mockActiveJobs.slice(1),
      ],
    });

    expect(
      await screen.findByRole("heading", { name: "JB-1042" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Call the mother to arrange collection"),
    ).not.toBeInTheDocument();
  });

  it("does not show the reminder to a rider, who is never sent the flag", async () => {
    const {
      needsMotherContact: _flag,
      mother: _mother,
      ...asRiderSees
    } = unscheduledMilk;
    renderJobDetail({ roles: [Role.Rider], active: [asRiderSees] });

    expect(
      await screen.findByRole("heading", { name: "JB-1042" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Milk")).toBeInTheDocument();
    expect(
      screen.queryByText("Call the mother to arrange collection"),
    ).not.toBeInTheDocument();
  });

  it("does not show the reminder to a rider even if the flag were present", async () => {
    renderJobDetail({ roles: [Role.Rider], active: [unscheduledMilk] });

    expect(
      await screen.findByRole("heading", { name: "JB-1042" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Call the mother to arrange collection"),
    ).not.toBeInTheDocument();
  });

  it("does not show the reminder once the job has a scheduled time", async () => {
    renderJobDetail({
      active: [
        {
          ...unscheduledMilk,
          needsMotherContact: false,
          scheduledCollectionAt: "2026-08-29T14:30:00",
        },
      ],
    });

    expect(
      await screen.findByText("Collection arranged for Sat 29 Aug, 14:30"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Call the mother to arrange collection"),
    ).not.toBeInTheDocument();
    // With the card gone the mother's contact sits in the job card as before.
    expect(
      screen.getByRole("region", { name: "Mother's contact" }),
    ).toBeInTheDocument();
  });

  it("only says the collection is arranged while the job is New or Allocated", async () => {
    const scheduledCollectionAt = "2026-08-29T14:30:00";

    renderJobDetail({
      active: [
        {
          ...base,
          status: "Collected",
          allowedActions: ["deliver", "cancel"],
          scheduledCollectionAt,
        },
      ],
    });

    expect(
      await screen.findByRole("heading", { name: "JB-1042" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/^Collection arranged for/),
    ).not.toBeInTheDocument();
  });

  it("shows the arranged time on an Allocated job", async () => {
    renderJobDetail({
      jobId: mockActiveJobs[1].id,
      active: [
        { ...mockActiveJobs[1], scheduledCollectionAt: "2026-08-29T14:30:00" },
      ],
    });

    expect(
      await screen.findByText("Collection arranged for Sat 29 Aug, 14:30"),
    ).toBeInTheDocument();
  });

  it("saves the time, then replaces the card with the arranged time", async () => {
    const user = userEvent.setup();
    const { fetchStub } = renderJobDetail({ active: [unscheduledMilk] });
    const { date, value } = nextWeekAtTen();

    fireEvent.change(await screen.findByLabelText("Collection date and time"), {
      target: { value },
    });
    await user.click(
      screen.getByRole("button", { name: "Save collection time" }),
    );

    const arranged = await screen.findByText(/^Collection arranged for /);
    expect(arranged).toHaveTextContent(
      `Collection arranged for ${date.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })}, 10:00`,
    );
    expect(
      screen.queryByText("Call the mother to arrange collection"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save collection time" }),
    ).not.toBeInTheDocument();

    const call = scheduleCall(fetchStub);
    expect(call?.[1]?.method).toBe("POST");
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      scheduledCollectionAt: date.toISOString(),
    });
  });

  it("asks for a time before saving", async () => {
    const user = userEvent.setup();
    const { fetchStub } = renderJobDetail({ active: [unscheduledMilk] });

    await user.click(
      await screen.findByRole("button", { name: "Save collection time" }),
    );

    expect(
      await screen.findByText("Enter the collection date and time"),
    ).toBeInTheDocument();
    expect(scheduleCall(fetchStub)).toBeUndefined();
  });

  it("rejects a time that has passed without calling the API", async () => {
    const user = userEvent.setup();
    const { fetchStub } = renderJobDetail({ active: [unscheduledMilk] });

    fireEvent.change(await screen.findByLabelText("Collection date and time"), {
      target: { value: "2020-01-01T10:00" },
    });
    await user.click(
      screen.getByRole("button", { name: "Save collection time" }),
    );

    expect(
      await screen.findByText("Choose a collection time in the future"),
    ).toBeInTheDocument();
    expect(scheduleCall(fetchStub)).toBeUndefined();
    expect(
      screen.getByText("Call the mother to arrange collection"),
    ).toBeInTheDocument();
  });

  it("shows the API's message and keeps the card when the API refuses the time", async () => {
    const user = userEvent.setup();
    const { fetchStub } = renderJobDetail({ active: [unscheduledMilk] });
    const { value } = nextWeekAtTen();

    fireEvent.change(await screen.findByLabelText("Collection date and time"), {
      target: { value },
    });
    fetchStub.mockImplementationOnce(
      async () =>
        new Response(
          JSON.stringify({
            message: "Choose a collection time in the future.",
            errors: {
              scheduledCollectionAt: [
                "Choose a collection time in the future.",
              ],
            },
          }),
          { status: 422, headers: { "Content-Type": "application/json" } },
        ),
    );
    await user.click(
      screen.getByRole("button", { name: "Save collection time" }),
    );

    expect(
      await screen.findByText("Choose a collection time in the future."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Call the mother to arrange collection"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save collection time" }),
    ).toBeEnabled();
  });

  describe("record forms use the scheduled day", () => {
    // Local times (no "Z") so the calendar days are the same in any timezone.
    const createdAt = "2026-03-10T09:00:00";
    const scheduledCollectionAt = "2026-03-12T11:00:00";
    const allocated: DeliveryJob = {
      ...mockActiveJobs[1],
      createdAt,
      scheduledCollectionAt,
    };
    const collected: DeliveryJob = {
      ...mockActiveJobs[1],
      id: "33333333-3333-3333-3333-333333333333",
      status: "Collected",
      createdAt,
      scheduledCollectionAt,
      allowedActions: ["deliver", "cancel"],
    };

    function localDay(iso: string) {
      const date = new Date(iso);
      return [date.getFullYear(), date.getMonth() + 1, date.getDate()];
    }

    function bodyOf(
      fetchStub: ReturnType<typeof renderJobDetail>["fetchStub"],
      action: string,
    ) {
      const call = fetchStub.mock.calls.find(([input]) =>
        String(input).includes(`/actions/${action}`),
      );
      expect(call).toBeDefined();
      return JSON.parse(String(call?.[1]?.body));
    }

    it("sends the collection time on the scheduled day, not the created day", async () => {
      const user = userEvent.setup();
      const { fetchStub } = renderJobDetail({
        jobId: allocated.id,
        active: [allocated],
      });

      await user.click(await screen.findByLabelText("Contents confirmed"));
      await user.click(await screen.findByRole("option", { name: "Yes" }));
      await user.type(screen.getByLabelText("Job number"), "JN-3001");
      expect(screen.getByText("On Thu 12 Mar (the job's day)")).toBeVisible();
      fireEvent.change(screen.getByLabelText("Collection time"), {
        target: { value: "14:30" },
      });
      await user.click(screen.getByLabelText("Job number"));
      await user.keyboard("{Enter}");

      expect(
        await screen.findByText("Collected 12 Mar, 14:30 · job JN-3001"),
      ).toBeVisible();
      const { collectedAt } = bodyOf(fetchStub, "collect");
      expect(localDay(collectedAt)).toEqual([2026, 3, 12]);
      const sent = new Date(collectedAt);
      expect([sent.getHours(), sent.getMinutes()]).toEqual([14, 30]);
    });

    it("sends the delivery time on the scheduled day, not the created day", async () => {
      const user = userEvent.setup();
      const { fetchStub } = renderJobDetail({
        jobId: collected.id,
        active: [collected],
      });

      const input = await screen.findByLabelText("Delivery time");
      expect(screen.getByText("On Thu 12 Mar (the job's day)")).toBeVisible();
      await user.type(screen.getByLabelText("Recipient"), "Sister Jones");
      fireEvent.change(input, { target: { value: "16:45" } });
      await user.click(screen.getByLabelText("Recipient"));
      await user.keyboard("{Enter}");

      await waitFor(() => {
        expect(
          screen.getByText("Delivered 12 Mar, 16:45 to Sister Jones"),
        ).toBeVisible();
      });
      const { deliveredAt } = bodyOf(fetchStub, "deliver");
      expect(localDay(deliveredAt)).toEqual([2026, 3, 12]);
    });

    it("still uses the created day when nothing is scheduled", async () => {
      renderJobDetail({
        jobId: allocated.id,
        active: [{ ...allocated, scheduledCollectionAt: null }],
      });

      expect(
        await screen.findByText("On Tue 10 Mar (the job's day)"),
      ).toBeVisible();
    });
  });
});

describe("Record collection and delivery on submit", () => {
  // Local time (no "Z") so the job's calendar day is the same in any timezone.
  const createdAt = "2026-03-10T09:00:00";
  const allocated: DeliveryJob = {
    ...mockActiveJobs[1],
    createdAt,
    scheduledCollectionAt: null,
  };
  const collected: DeliveryJob = {
    ...allocated,
    id: "33333333-3333-3333-3333-333333333333",
    status: "Collected",
    allowedActions: ["deliver", "cancel"],
  };
  const relayLeg: DeliveryJob = {
    ...allocated,
    id: "44444444-4444-4444-4444-444444444444",
    reference: "JB-2000-L1",
    parentJobId: "55555555-5555-5555-5555-555555555555",
    legNumber: 1,
  };
  const relayParent: DeliveryJob = {
    ...allocated,
    id: "55555555-5555-5555-5555-555555555555",
    reference: "JB-2000",
    isRelay: true,
    legs: [relayLeg],
  };

  type Stub = ReturnType<typeof renderJobDetail>["fetchStub"];
  type User = ReturnType<typeof userEvent.setup>;

  function posts(fetchStub: Stub, action: "collect" | "deliver") {
    return fetchStub.mock.calls.filter(
      ([input, init]) =>
        String(input).includes(`/actions/${action}`) &&
        (init as RequestInit | undefined)?.method === "POST",
    );
  }

  function bodies(fetchStub: Stub, action: "collect" | "deliver") {
    return posts(fetchStub, action).map(([, init]) =>
      JSON.parse(String((init as RequestInit).body)),
    );
  }

  /** Let any request the page would make go out, then check none did. */
  async function settle() {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
    });
  }

  function renderCollect(options: Parameters<typeof renderJobDetail>[0] = {}) {
    return renderJobDetail({
      jobId: allocated.id,
      active: [allocated],
      ...options,
    });
  }

  function renderDeliver(options: Parameters<typeof renderJobDetail>[0] = {}) {
    return renderJobDetail({
      jobId: collected.id,
      active: [collected],
      ...options,
    });
  }

  async function chooseContents(user: User, option = "Yes") {
    await user.click(await screen.findByLabelText("Contents confirmed"));
    await user.click(await screen.findByRole("option", { name: option }));
  }

  function setTime(label: string, value: string) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }

  /** Hold every request for `action` open until `release()`. */
  function holdRequests(action: "collect" | "deliver") {
    const realFetch = globalThis.fetch;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).includes(`/actions/${action}`)) {
          await gate;
        }
        return realFetch(input, init);
      }),
    );
    return release;
  }

  describe("no buttons", () => {
    it("has no Record collection button, only the fields and a hint about when it saves", async () => {
      renderCollect();

      const section = await screen.findByRole("region", {
        name: "Record collection",
      });
      expect(
        screen.queryByRole("button", { name: /record collection/i }),
      ).not.toBeInTheDocument();
      expect(within(section).queryByRole("button")).not.toBeInTheDocument();
      expect(
        within(section).getByText(
          /Records when you press Enter or leave the form once everything is filled in/,
        ),
      ).toBeVisible();
      expect(screen.getByLabelText("Contents confirmed")).toBeInTheDocument();
      expect(screen.getByLabelText("Job number")).toBeInTheDocument();
      expect(screen.getByLabelText("Collection time")).toBeInTheDocument();
    });

    it("has no Record delivery button, only the fields and the same hint", async () => {
      renderDeliver();

      const section = await screen.findByRole("region", {
        name: "Record delivery",
      });
      expect(
        screen.queryByRole("button", { name: /record delivery/i }),
      ).not.toBeInTheDocument();
      expect(within(section).queryByRole("button")).not.toBeInTheDocument();
      expect(
        within(section).getByText(
          /Records when you press Enter or leave the form once everything is filled in/,
        ),
      ).toBeVisible();
      expect(screen.getByLabelText("Recipient")).toBeInTheDocument();
      expect(
        screen.getByRole("checkbox", { name: "No person or recipient" }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Delivery time")).toBeInTheDocument();
    });

    it("describes the form with the hint", async () => {
      renderCollect();

      const section = await screen.findByRole("region", {
        name: "Record collection",
      });
      const form = section.querySelector("form");
      expect(form).toHaveAccessibleDescription(
        /Records when you press Enter or leave the form/,
      );
    });
  });

  describe("an incomplete form posts nothing", () => {
    it.each([
      {
        missing: "contents confirmed",
        fill: async (user: User) => {
          await user.type(screen.getByLabelText("Job number"), "JN-1");
        },
        error: "Confirm whether the contents match the job",
      },
      {
        missing: "job number",
        fill: async (user: User) => {
          await chooseContents(user);
          await user.click(screen.getByLabelText("Job number"));
        },
        error: "Enter a job number",
      },
      {
        missing: "job number (only spaces)",
        fill: async (user: User) => {
          await chooseContents(user);
          await user.type(screen.getByLabelText("Job number"), "   ");
        },
        error: "Enter a job number",
      },
      {
        missing: "collection time",
        fill: async (user: User) => {
          await chooseContents(user);
          await user.type(screen.getByLabelText("Job number"), "JN-1");
          setTime("Collection time", "");
        },
        error: "Enter a collection time",
      },
    ])("collection: $missing missing, Enter and leaving the form both do nothing", async ({
      fill,
      error,
    }) => {
      const user = userEvent.setup();
      const { fetchStub } = renderCollect();
      await screen.findByLabelText("Job number");

      await fill(user);
      await user.keyboard("{Enter}");
      expect(await screen.findByText(error)).toBeVisible();

      await user.click(document.body);
      await settle();

      expect(posts(fetchStub, "collect")).toHaveLength(0);
    });

    it("collection: a time that is not a time is refused", async () => {
      const user = userEvent.setup();
      const { fetchStub } = renderCollect();

      await chooseContents(user);
      await user.type(screen.getByLabelText("Job number"), "JN-1");
      // A time input reports "" for a half-typed time, but never trust that.
      fireEvent.change(screen.getByLabelText("Collection time"), {
        target: { value: "25:99" },
      });
      await user.keyboard("{Enter}");
      await settle();

      expect(posts(fetchStub, "collect")).toHaveLength(0);
    });

    it.each([
      {
        missing: "recipient",
        fill: async (user: User) => {
          await user.click(screen.getByLabelText("Recipient"));
        },
        error: "Enter the recipient",
      },
      {
        missing: "recipient (only spaces)",
        fill: async (user: User) => {
          await user.type(screen.getByLabelText("Recipient"), "   ");
        },
        error: "Enter the recipient",
      },
      {
        missing: "delivery time",
        fill: async (user: User) => {
          await user.type(screen.getByLabelText("Recipient"), "Sister Jones");
          setTime("Delivery time", "");
        },
        error: "Enter a delivery time",
      },
    ])("delivery: $missing missing, Enter and leaving the form both do nothing", async ({
      fill,
      error,
    }) => {
      const user = userEvent.setup();
      const { fetchStub } = renderDeliver();
      await screen.findByLabelText("Recipient");

      await fill(user);
      await user.keyboard("{Enter}");
      expect(await screen.findByText(error)).toBeVisible();

      await user.click(document.body);
      await settle();

      expect(posts(fetchStub, "deliver")).toHaveLength(0);
    });

    it("delivery: ticking 'No person or recipient' with no delivery time posts nothing", async () => {
      const user = userEvent.setup();
      const { fetchStub } = renderDeliver();
      await screen.findByLabelText("Delivery time");

      setTime("Delivery time", "");
      await user.click(
        screen.getByRole("checkbox", { name: "No person or recipient" }),
      );
      await settle();

      expect(posts(fetchStub, "deliver")).toHaveLength(0);
    });

    it("collection: choosing the contents does not record while the job number is empty", async () => {
      const user = userEvent.setup();
      const { fetchStub } = renderCollect();

      await chooseContents(user);
      await settle();

      expect(posts(fetchStub, "collect")).toHaveLength(0);
    });

    it("delivery: unticking the box does not record", async () => {
      const user = userEvent.setup();
      const { fetchStub } = renderDeliver({
        recordFailures: { deliver: [{ status: 500, message: "Nope." }] },
      });

      const box = await screen.findByRole("checkbox", {
        name: "No person or recipient",
      });
      await user.click(box);
      expect(await screen.findByRole("alert")).toHaveTextContent("Nope.");
      await user.click(box);
      await settle();

      expect(posts(fetchStub, "deliver")).toHaveLength(1);
    });
  });

  describe("nothing happens by itself", () => {
    it.each([
      { name: "plain", strictMode: false },
      { name: "StrictMode", strictMode: true },
    ])("posts nothing on mount ($name)", async ({ strictMode }) => {
      const { fetchStub } = renderCollect({ strictMode });
      await screen.findByLabelText("Job number");
      await settle();

      expect(posts(fetchStub, "collect")).toHaveLength(0);
    });

    it("posts nothing when tabbing through the unchanged collection form and out of it", async () => {
      const user = userEvent.setup();
      const { fetchStub } = renderCollect();
      const field = await screen.findByLabelText("Contents confirmed");

      field.focus();
      // Contents, job number, collection time, then out into the next section.
      await user.tab();
      await user.tab();
      await user.tab();
      await user.tab();
      await user.click(document.body);
      await settle();

      expect(posts(fetchStub, "collect")).toHaveLength(0);
    });

    it("posts nothing when tabbing through the delivery form whose time is prefilled", async () => {
      const user = userEvent.setup();
      const { fetchStub } = renderDeliver();
      const recipient = await screen.findByLabelText("Recipient");

      expect(screen.getByLabelText("Delivery time")).not.toHaveValue("");
      recipient.focus();
      await user.tab();
      await user.tab();
      await user.tab();
      await user.tab();
      await user.click(document.body);
      await settle();

      expect(posts(fetchStub, "deliver")).toHaveLength(0);
    });

    it("posts nothing for a field that was changed and put back", async () => {
      const user = userEvent.setup();
      const { fetchStub } = renderDeliver({
        recordFailures: { deliver: [{ status: 500, message: "Nope." }] },
      });
      const recipient = await screen.findByLabelText("Recipient");
      const original = (
        screen.getByLabelText("Delivery time") as HTMLInputElement
      ).value;

      // A failed attempt first, so the form is complete and kept.
      await user.type(recipient, "Sister Jones{Enter}");
      expect(await screen.findByRole("alert")).toBeVisible();
      expect(posts(fetchStub, "deliver")).toHaveLength(1);

      setTime("Delivery time", "04:20");
      setTime("Delivery time", original);
      await user.click(document.body);
      await settle();

      expect(posts(fetchStub, "deliver")).toHaveLength(1);
    });

    it("does not post per keystroke", async () => {
      const user = userEvent.setup();
      const { fetchStub } = renderCollect();

      await chooseContents(user);
      await user.type(screen.getByLabelText("Job number"), "JN-0042");
      await settle();

      expect(posts(fetchStub, "collect")).toHaveLength(0);
    });
  });

  describe("completing the form", () => {
    it("collection: choosing the contents last records once with the right payload", async () => {
      const user = userEvent.setup();
      const { fetchStub } = renderCollect();

      await user.type(await screen.findByLabelText("Job number"), "JN-0042");
      setTime("Collection time", "14:30");
      expect(posts(fetchStub, "collect")).toHaveLength(0);
      await chooseContents(user, "No");

      expect(
        await screen.findByText("Collected 10 Mar, 14:30 · job JN-0042"),
      ).toBeVisible();
      expect(posts(fetchStub, "collect")).toHaveLength(1);
      const [body] = bodies(fetchStub, "collect");
      expect(Object.keys(body).sort()).toEqual([
        "collectedAt",
        "contentsConfirmed",
        "receiptNumber",
      ]);
      expect(body.contentsConfirmed).toBe(false);
      expect(body.receiptNumber).toBe("JN-0042");
      const sent = new Date(body.collectedAt);
      expect([
        sent.getFullYear(),
        sent.getMonth() + 1,
        sent.getDate(),
        sent.getHours(),
        sent.getMinutes(),
      ]).toEqual([2026, 3, 10, 14, 30]);
    });

    it("collection: Enter in the job number records once, trimmed", async () => {
      const user = userEvent.setup();
      const { fetchStub } = renderCollect();

      await chooseContents(user);
      await user.type(screen.getByLabelText("Job number"), "  JN-7  {Enter}");

      expect(await screen.findByText(/job JN-7$/)).toBeVisible();
      expect(bodies(fetchStub, "collect")).toMatchObject([
        { contentsConfirmed: true, receiptNumber: "JN-7" },
      ]);
    });

    it.each([
      "Contents confirmed",
      "Job number",
      "Collection time",
    ])("collection: Enter in the %s field of a complete form records", async (label) => {
      const user = userEvent.setup();
      const { fetchStub } = renderCollect();

      await chooseContents(user);
      await user.type(screen.getByLabelText("Job number"), "JN-8");
      await user.click(screen.getByLabelText(label));
      await user.keyboard("{Enter}");

      expect(await screen.findByText(/job JN-8$/)).toBeVisible();
      expect(posts(fetchStub, "collect")).toHaveLength(1);
    });

    it("delivery: ticking 'No person or recipient' last records once without a recipient", async () => {
      const user = userEvent.setup();
      const { fetchStub } = renderDeliver();
      await screen.findByLabelText("Delivery time");

      setTime("Delivery time", "15:10");
      await user.click(
        screen.getByRole("checkbox", { name: "No person or recipient" }),
      );

      expect(
        await screen.findByText("Delivered 10 Mar, 15:10, no recipient"),
      ).toBeVisible();
      expect(posts(fetchStub, "deliver")).toHaveLength(1);
      const [body] = bodies(fetchStub, "deliver");
      expect(body.noRecipient).toBe(true);
      expect(body).not.toHaveProperty("recipient");
      expect(new Date(body.deliveredAt).getHours()).toBe(15);
      expect(new Date(body.deliveredAt).getMinutes()).toBe(10);
    });

    it("delivery: Enter with a recipient records once with it", async () => {
      const user = userEvent.setup();
      const { fetchStub } = renderDeliver();
      await screen.findByLabelText("Delivery time");

      setTime("Delivery time", "15:10");
      await user.type(
        screen.getByLabelText("Recipient"),
        "Sister Jones{Enter}",
      );

      expect(
        await screen.findByText("Delivered 10 Mar, 15:10 to Sister Jones"),
      ).toBeVisible();
      expect(bodies(fetchStub, "deliver")).toMatchObject([
        { recipient: "Sister Jones", noRecipient: false },
      ]);
    });

    it("delivery: ticking the box on an already complete form waits for Enter", async () => {
      const user = userEvent.setup();
      const { fetchStub } = renderDeliver();
      await screen.findByLabelText("Delivery time");

      await user.type(screen.getByLabelText("Recipient"), "Sister Jones");
      await user.click(
        screen.getByRole("checkbox", { name: "No person or recipient" }),
      );
      await settle();
      // The recipient field is now cleared and disabled; nothing was missing,
      // so the toggle alone was not the completing step.
      expect(posts(fetchStub, "deliver")).toHaveLength(0);

      await user.keyboard("{Enter}");
      expect(await screen.findByText(/, no recipient$/)).toBeVisible();
      expect(bodies(fetchStub, "deliver")).toMatchObject([
        { noRecipient: true },
      ]);
    });

    it("relay leg: the date-and-time picker records the entered date and time", async () => {
      const user = userEvent.setup();
      const { fetchStub } = renderJobDetail({
        jobId: relayLeg.id,
        active: [relayParent],
      });

      await chooseContents(user);
      await user.type(screen.getByLabelText("Job number"), "JN-9");
      setTime("Collection time", "2026-03-11T08:15");
      await user.keyboard("{Enter}");
      await settle();

      const [body] = bodies(fetchStub, "collect");
      const sent = new Date(body.collectedAt);
      expect([sent.getDate(), sent.getHours(), sent.getMinutes()]).toEqual([
        11, 8, 15,
      ]);
    });
  });

  describe("leaving the form", () => {
    it("records after an edit when focus leaves the form", async () => {
      const user = userEvent.setup();
      const { fetchStub } = renderCollect();

      await chooseContents(user);
      await user.type(screen.getByLabelText("Job number"), "JN-0050");
      expect(posts(fetchStub, "collect")).toHaveLength(0);
      await user.click(document.body);

      expect(await screen.findByText(/job JN-0050$/)).toBeVisible();
      expect(posts(fetchStub, "collect")).toHaveLength(1);
    });

    it("records when tabbing out of the last field after editing an earlier one", async () => {
      const user = userEvent.setup();
      const { fetchStub } = renderCollect();

      await chooseContents(user);
      await user.type(screen.getByLabelText("Job number"), "JN-0051");
      // Into the time field: still inside the form.
      await user.tab();
      expect(screen.getByLabelText("Collection time")).toHaveFocus();
      await settle();
      expect(posts(fetchStub, "collect")).toHaveLength(0);
      // Out of the form.
      await user.tab();

      expect(await screen.findByText(/job JN-0051$/)).toBeVisible();
      expect(posts(fetchStub, "collect")).toHaveLength(1);
    });

    it("does not record when focus moves to another field inside the form", async () => {
      const user = userEvent.setup();
      const { fetchStub } = renderDeliver();
      await screen.findByLabelText("Delivery time");

      await user.type(screen.getByLabelText("Recipient"), "Sister Jones");
      await user.click(screen.getByLabelText("Delivery time"));
      await user.click(screen.getByLabelText("Recipient"));
      await user.click(
        screen.getByRole("checkbox", { name: "No person or recipient" }),
      );
      await settle();

      expect(posts(fetchStub, "deliver")).toHaveLength(0);
    });

    it("does not record when the window loses focus and the field keeps it", async () => {
      const user = userEvent.setup();
      const { fetchStub } = renderDeliver();
      await screen.findByLabelText("Delivery time");

      const recipient = screen.getByLabelText("Recipient");
      await user.type(recipient, "Sister Jones");
      expect(recipient).toHaveFocus();
      // What a browser sends when the user switches tab or app.
      fireEvent.blur(recipient);
      await settle();

      expect(posts(fetchStub, "deliver")).toHaveLength(0);
    });

    it("does not record when a press inside the form blurs the field without focusing another (Safari/Firefox on a checkbox)", async () => {
      const user = userEvent.setup();
      const { fetchStub } = renderDeliver();
      await screen.findByLabelText("Delivery time");

      const recipient = screen.getByLabelText("Recipient");
      await user.type(recipient, "Sister Jones");
      const box = screen.getByRole("checkbox", {
        name: "No person or recipient",
      });
      fireEvent.mouseDown(box);
      act(() => recipient.blur());
      fireEvent.mouseUp(box);
      await settle();

      expect(posts(fetchStub, "deliver")).toHaveLength(0);

      // The same blur without a press inside is leaving the form.
      act(() => recipient.focus());
      fireEvent.change(recipient, { target: { value: "Sister Jones 2" } });
      act(() => recipient.blur());
      expect(await screen.findByText(/to Sister Jones 2$/)).toBeVisible();
      expect(posts(fetchStub, "deliver")).toHaveLength(1);
    });
  });

  describe("while the request runs", () => {
    it("disables every field and says Saving… in a status that is always there", async () => {
      const user = userEvent.setup();
      renderCollect();
      const section = await screen.findByRole("region", {
        name: "Record collection",
      });
      // Always rendered, empty while idle.
      const status = within(section).getByRole("status");
      expect(status).toBeEmptyDOMElement();
      const release = holdRequests("collect");

      await chooseContents(user);
      await user.type(screen.getByLabelText("Job number"), "JN-1{Enter}");

      expect(await within(section).findByText("Saving…")).toBeVisible();
      expect(within(section).getByRole("status")).toBe(status);
      expect(screen.getByLabelText("Job number")).toBeDisabled();
      expect(screen.getByLabelText("Collection time")).toBeDisabled();
      expect(
        within(section).getByRole("button", { name: "Change" }),
      ).toBeDisabled();

      release();
      expect(await screen.findByText(/job JN-1$/)).toBeVisible();
    });

    it("disables the delivery fields too", async () => {
      const user = userEvent.setup();
      renderDeliver();
      const section = await screen.findByRole("region", {
        name: "Record delivery",
      });
      const release = holdRequests("deliver");

      await user.type(
        screen.getByLabelText("Recipient"),
        "Sister Jones{Enter}",
      );

      expect(await within(section).findByText("Saving…")).toBeVisible();
      expect(screen.getByLabelText("Recipient")).toBeDisabled();
      expect(screen.getByLabelText("Delivery time")).toBeDisabled();
      expect(
        screen.getByRole("checkbox", { name: "No person or recipient" }),
      ).toBeDisabled();

      release();
      expect(await screen.findByText(/to Sister Jones$/)).toBeVisible();
    });

    it("posts once for a double Enter, an Enter then a blur, and repeated selection", async () => {
      const user = userEvent.setup();
      const { fetchStub } = renderCollect();

      await chooseContents(user);
      const job = screen.getByLabelText("Job number");
      await user.type(job, "JN-2");
      act(() => {
        fireEvent.keyDown(job, { key: "Enter" });
        fireEvent.keyDown(job, { key: "Enter" });
        fireEvent.blur(job);
        fireEvent.keyDown(job, { key: "Enter" });
      });

      expect(await screen.findByText(/job JN-2$/)).toBeVisible();
      expect(posts(fetchStub, "collect")).toHaveLength(1);
    });

    it("posts once for the delivery checkbox reported twice", async () => {
      const { fetchStub } = renderDeliver();

      const box = await screen.findByRole("checkbox", {
        name: "No person or recipient",
      });
      act(() => {
        fireEvent.click(box);
        fireEvent.click(box);
      });

      expect(await screen.findByText(/, no recipient$/)).toBeVisible();
      expect(posts(fetchStub, "deliver")).toHaveLength(1);
    });

    it("posts once under StrictMode", async () => {
      const user = userEvent.setup();
      const { fetchStub } = renderCollect({ strictMode: true });

      await chooseContents(user);
      await user.type(screen.getByLabelText("Job number"), "JN-3{Enter}");

      expect(await screen.findByText(/job JN-3$/)).toBeVisible();
      await settle();
      expect(posts(fetchStub, "collect")).toHaveLength(1);
    });

    it("ignores Enter while a key is held down", async () => {
      const user = userEvent.setup();
      const { fetchStub } = renderCollect();

      await chooseContents(user);
      const job = screen.getByLabelText("Job number");
      await user.type(job, "JN-4");
      fireEvent.keyDown(job, { key: "Enter", repeat: true });
      fireEvent.keyDown(job, { key: "Enter", isComposing: true });
      fireEvent.keyDown(job, { key: "Enter", keyCode: 229 });
      await settle();

      expect(posts(fetchStub, "collect")).toHaveLength(0);
    });
  });

  describe("when the request fails", () => {
    it("collection: keeps the values, shows the error under the form and retries on the next Enter", async () => {
      const user = userEvent.setup();
      const { fetchStub } = renderCollect({
        recordFailures: {
          collect: [
            {
              status: 422,
              message: "That job number is already in use.",
              errors: { receiptNumber: ["That job number is already in use."] },
            },
          ],
        },
      });
      const section = await screen.findByRole("region", {
        name: "Record collection",
      });

      await chooseContents(user);
      setTime("Collection time", "14:30");
      await user.type(screen.getByLabelText("Job number"), "JN-5{Enter}");

      const alert = await within(section).findByRole("alert");
      expect(alert).toHaveTextContent("That job number is already in use.");
      expect(screen.getByLabelText("Contents confirmed")).toHaveValue("Yes");
      expect(screen.getByLabelText("Job number")).toHaveValue("JN-5");
      expect(screen.getByLabelText("Collection time")).toHaveValue("14:30");
      expect(screen.getByLabelText("Job number")).toBeEnabled();
      expect(screen.getByLabelText("Job number")).toHaveFocus();
      expect(within(section).getByRole("status")).toBeEmptyDOMElement();
      expect(screen.getByText("Allocated")).toBeInTheDocument();

      // Nothing retries by itself, not even on leaving the unchanged form.
      await user.click(document.body);
      await settle();
      expect(posts(fetchStub, "collect")).toHaveLength(1);

      // Enter tries again with the same values.
      await user.click(screen.getByLabelText("Job number"));
      await user.keyboard("{Enter}");
      expect(await screen.findByText(/job JN-5$/)).toBeVisible();
      expect(posts(fetchStub, "collect")).toHaveLength(2);
      expect(bodies(fetchStub, "collect")[1]).toEqual(
        bodies(fetchStub, "collect")[0],
      );
    });

    it("collection: after a failure an edit and leaving the form retries once", async () => {
      const user = userEvent.setup();
      const { fetchStub } = renderCollect({
        recordFailures: {
          collect: [{ status: 422, message: "Bad job number." }],
        },
      });

      await chooseContents(user);
      await user.type(screen.getByLabelText("Job number"), "JN-6{Enter}");
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Bad job number.",
      );

      await user.type(screen.getByLabelText("Job number"), "7");
      await user.click(document.body);

      expect(await screen.findByText(/job JN-67$/)).toBeVisible();
      expect(posts(fetchStub, "collect")).toHaveLength(2);
      expect(bodies(fetchStub, "collect")[1].receiptNumber).toBe("JN-67");
    });

    it("delivery: keeps the values after a network error and retries on Enter", async () => {
      const user = userEvent.setup();
      const { fetchStub } = renderDeliver({
        recordFailures: { deliver: ["network"] },
      });
      const section = await screen.findByRole("region", {
        name: "Record delivery",
      });

      await user.type(
        screen.getByLabelText("Recipient"),
        "Sister Jones{Enter}",
      );

      expect(await within(section).findByRole("alert")).toBeVisible();
      expect(screen.getByLabelText("Recipient")).toHaveValue("Sister Jones");
      expect(screen.getByLabelText("Recipient")).toBeEnabled();
      expect(posts(fetchStub, "deliver")).toHaveLength(1);

      await user.keyboard("{Enter}");
      expect(await screen.findByText(/to Sister Jones$/)).toBeVisible();
      expect(posts(fetchStub, "deliver")).toHaveLength(2);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("delivery: a failed toggle keeps the box ticked and Enter retries", async () => {
      const user = userEvent.setup();
      const { fetchStub } = renderDeliver({
        recordFailures: {
          deliver: [{ status: 500, message: "Server error." }],
        },
      });

      const box = await screen.findByRole("checkbox", {
        name: "No person or recipient",
      });
      await user.click(box);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Server error.",
      );
      expect(box).toBeChecked();
      expect(box).toBeEnabled();

      box.focus();
      await user.keyboard("{Enter}");
      expect(await screen.findByText(/, no recipient$/)).toBeVisible();
      expect(posts(fetchStub, "deliver")).toHaveLength(2);
    });
  });

  describe("after it is recorded", () => {
    it("shows what was recorded in place of the collection form", async () => {
      const user = userEvent.setup();
      renderCollect();

      await chooseContents(user);
      setTime("Collection time", "14:30");
      await user.type(screen.getByLabelText("Job number"), "JB-0042{Enter}");

      const line = await screen.findByText(
        "Collected 10 Mar, 14:30 · job JB-0042",
      );
      expect(line).toBeVisible();
      expect(line).toHaveAttribute("role", "status");
      expect(screen.getAllByText(/job JB-0042/)).toHaveLength(1);
      expect(screen.getByText("Collected")).toBeInTheDocument();
      expect(
        screen.queryByRole("region", { name: "Record collection" }),
      ).not.toBeInTheDocument();
      // The delivery form is the next step.
      expect(
        screen.getByRole("region", { name: "Record delivery" }),
      ).toBeInTheDocument();
    });

    it("shows what was recorded in place of the delivery form", async () => {
      const user = userEvent.setup();
      renderDeliver();
      await screen.findByLabelText("Delivery time");

      setTime("Delivery time", "15:10");
      await user.type(
        screen.getByLabelText("Recipient"),
        "Sister Jones{Enter}",
      );

      const line = await screen.findByText(
        "Delivered 10 Mar, 15:10 to Sister Jones",
      );
      expect(line).toBeVisible();
      expect(screen.getAllByText(/Sister Jones/)).toHaveLength(1);
      expect(screen.getByText("Delivered")).toBeInTheDocument();
      expect(
        screen.queryByRole("region", { name: "Record delivery" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("when the job has moved on", () => {
    it("reloads the job once after a failure about its state and says why", async () => {
      const user = userEvent.setup();
      const message = "Job is Collected. Allowed actions: deliver, cancel.";
      const { fetchStub } = renderCollect({
        recordFailures: {
          collect: [{ status: 422, message, errors: { action: [message] } }],
        },
      });
      await screen.findByRole("region", { name: "Record collection" });
      const reads = serveJobAfterLoad(allocated.id, {
        ...allocated,
        status: "Collected",
        allowedActions: ["deliver", "cancel"],
      });

      await chooseContents(user);
      await user.type(screen.getByLabelText("Job number"), "JN-10{Enter}");

      expect(
        await screen.findByRole("region", { name: "Record delivery" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("region", { name: "Record collection" }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(message);
      expect(screen.getByText("Collected")).toBeInTheDocument();

      await settle();
      expect(reads).toHaveLength(1);
      expect(posts(fetchStub, "collect")).toHaveLength(1);
    });

    it("reloads the job once after a 409 on delivery", async () => {
      const user = userEvent.setup();
      const message = "This job was already delivered.";
      const { fetchStub } = renderDeliver({
        recordFailures: { deliver: [{ status: 409, message }] },
      });
      await screen.findByRole("region", { name: "Record delivery" });
      const reads = serveJobAfterLoad(collected.id, {
        ...collected,
        status: "Delivered",
        allowedActions: [],
        deliveryRecord: {
          recipient: "Matron",
          noRecipient: false,
          deliveredAt: "2026-03-10T15:00:00",
        },
      });

      await user.type(
        screen.getByLabelText("Recipient"),
        "Sister Jones{Enter}",
      );

      expect(
        await screen.findByText("Delivered 10 Mar, 15:00 to Matron"),
      ).toBeVisible();
      expect(screen.getByRole("alert")).toHaveTextContent(message);
      await settle();
      expect(reads).toHaveLength(1);
      expect(posts(fetchStub, "deliver")).toHaveLength(1);
    });

    it("keeps the form and its error when the reload shows the job can still be collected", async () => {
      const user = userEvent.setup();
      renderCollect({
        recordFailures: { collect: [{ status: 409, message: "Conflict." }] },
      });
      await screen.findByRole("region", { name: "Record collection" });
      const reads = serveJobAfterLoad(allocated.id, allocated);

      await chooseContents(user);
      await user.type(screen.getByLabelText("Job number"), "JN-11{Enter}");

      await waitFor(() => expect(reads).toHaveLength(1));
      expect(await screen.findAllByRole("alert")).toHaveLength(1);
      expect(screen.getByLabelText("Job number")).toHaveValue("JN-11");
    });

    it.each([
      {
        name: "a validation error on a field",
        status: 422,
        errors: { receiptNumber: ["Bad."] },
      },
      { name: "a server error", status: 500, errors: undefined },
    ])("does not reload the job after $name", async ({ status, errors }) => {
      const user = userEvent.setup();
      renderCollect({
        recordFailures: {
          collect: [{ status, message: "Bad.", ...(errors ? { errors } : {}) }],
        },
      });
      await screen.findByRole("region", { name: "Record collection" });
      const reads = serveJobAfterLoad(allocated.id, allocated);

      await chooseContents(user);
      await user.type(screen.getByLabelText("Job number"), "JN-12{Enter}");

      expect(await screen.findByRole("alert")).toHaveTextContent("Bad.");
      await settle();
      expect(reads).toHaveLength(0);
    });
  });
});
