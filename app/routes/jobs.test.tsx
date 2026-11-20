import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearActiveRole } from "~/lib/active-role";
import { AuthProvider } from "~/lib/auth";
import { clearAuthToken, setAuthToken } from "~/lib/auth-token";
import { Role } from "~/lib/roles";

import { mockAuthUser } from "../../tests/auth-fixtures";
import {
  mockActiveJobs,
  mockCompletedJobs,
  stubJobsFetch,
} from "../../tests/job-fixtures";
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
  {
    roles = [Role.Controller],
    fetchImpl,
  }: {
    roles?: Role[];
    fetchImpl?: ReturnType<typeof stubJobsFetch>;
  } = {},
) {
  setAuthToken("test-google-id-token");
  vi.stubGlobal(
    "fetch",
    fetchImpl ?? stubJobsFetch({ ...mockAuthUser, roles }),
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
    expect(screen.getByText("JB-1042")).toBeInTheDocument();
  });
}

describe("JobsPage", () => {
  it("exports page meta", () => {
    expect(meta({} as Parameters<typeof meta>[0])).toEqual([
      { title: "Jobs — Plasma Controller" },
    ]);
  });

  it("renders the page heading", async () => {
    renderJobsPage();
    await waitForJobsLoaded();

    expect(
      screen.getByRole("heading", { name: "Jobs", level: 1 }),
    ).toBeInTheDocument();
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

  it("renders active job cards with status badges", async () => {
    renderJobsPage();
    await waitForJobsLoaded();

    expect(screen.getByText("JB-1038")).toBeInTheDocument();
    expect(
      within(screen.getByRole("link", { name: /JB-1042/i })).getByText("New"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("link", { name: /JB-1038/i })).getByText(
        "Allocated",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Royal Glamorgan Hospital")).toBeInTheDocument();
    expect(screen.getAllByText("Open").length).toBeGreaterThan(0);
  });

  it("shows the Milk label with litres on a milk job card only", async () => {
    const [standard, other] = mockActiveJobs;
    renderJobsPage("/jobs", {
      fetchImpl: stubJobsFetch(
        { ...mockAuthUser, roles: [Role.Controller] },
        {
          active: [
            { ...standard, jobType: "standard", milkLitres: null },
            {
              ...other,
              id: "99999999-9999-9999-9999-999999999991",
              reference: "JB-2001",
              jobType: "milk",
              milkLitres: 2.5,
            },
            {
              ...other,
              id: "99999999-9999-9999-9999-999999999992",
              reference: "JB-2002",
              jobType: "milk",
              milkLitres: 2,
            },
          ],
        },
      ),
    });
    await waitForJobsLoaded();

    const milkCard = screen.getByRole("link", { name: /JB-2001/ });
    expect(within(milkCard).getByText("Milk")).toBeInTheDocument();
    expect(within(milkCard).getByText("2.5 L")).toBeInTheDocument();
    expect(
      within(screen.getByRole("link", { name: /JB-2002/ })).getByText("2 L"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("link", { name: /JB-1042/ })).queryByText("Milk"),
    ).not.toBeInTheDocument();
  });

  describe("arranged collection time", () => {
    // Local time (no "Z") so the label is the same in any timezone.
    const scheduledCollectionAt = "2026-08-29T14:30:00";

    it("shows the arranged time on a scheduled New or Allocated job only", async () => {
      const [first, second] = mockActiveJobs;
      renderJobsPage("/jobs", {
        fetchImpl: stubJobsFetch(
          { ...mockAuthUser, roles: [Role.Controller] },
          {
            active: [
              { ...first, scheduledCollectionAt },
              { ...second, scheduledCollectionAt },
              {
                ...first,
                id: "99999999-9999-9999-9999-999999999991",
                reference: "JB-2001",
                scheduledCollectionAt: null,
              },
              {
                ...first,
                id: "99999999-9999-9999-9999-999999999992",
                reference: "JB-2002",
                status: "Collected",
                scheduledCollectionAt,
              },
            ],
          },
        ),
      });
      await waitForJobsLoaded();

      for (const reference of [/JB-1042/, /JB-1038/]) {
        expect(
          within(screen.getByRole("link", { name: reference })).getByText(
            "Collection Sat 29 Aug, 14:30",
          ),
        ).toBeInTheDocument();
      }
      for (const reference of [/JB-2001/, /JB-2002/]) {
        expect(
          within(screen.getByRole("link", { name: reference })).queryByText(
            /^Collection /,
          ),
        ).not.toBeInTheDocument();
      }
    });

    it("shows no arranged time on a delivered job", async () => {
      const user = userEvent.setup();
      const [delivered] = mockCompletedJobs;
      renderJobsPage("/jobs", {
        fetchImpl: stubJobsFetch(
          { ...mockAuthUser, roles: [Role.Controller] },
          { completed: [{ ...delivered, scheduledCollectionAt }] },
        ),
      });
      await waitForJobsLoaded();

      await user.click(screen.getByRole("tab", { name: "Completed" }));

      const card = await screen.findByRole("link", {
        name: new RegExp(delivered.reference),
      });
      expect(within(card).queryByText(/^Collection /)).not.toBeInTheDocument();
    });
  });

  describe("future jobs", () => {
    // Only Date is faked (userEvent and waitFor keep their real timers), and
    // the clock is pinned mid-day so no test depends on when it really runs.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(2026, 10, 20, 12, 0));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    // Local calendar parts, so "today" and "next week" mean the same in any timezone.
    const at = (daysAhead: number, hours: number, minutes = 0) => {
      const today = new Date();
      return new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + daysAhead,
        hours,
        minutes,
      ).toISOString();
    };
    const [first, second] = mockActiveJobs;
    const make = (
      reference: string,
      overrides: Partial<(typeof mockActiveJobs)[number]> = {},
    ) => ({
      ...first,
      id: `99999999-9999-9999-9999-${reference.replace(/\D/g, "").padStart(12, "0")}`,
      reference,
      ...overrides,
    });

    function renderWithFutureJobs() {
      return renderJobsPage("/jobs", {
        fetchImpl: stubJobsFetch(
          { ...mockAuthUser, roles: [Role.Controller] },
          {
            active: [
              // The API sends the most recently updated first.
              make("JB-3001", { scheduledCollectionAt: at(7, 10) }),
              { ...first, scheduledCollectionAt: at(0, 23, 30) },
              make("JB-3002", { scheduledCollectionAt: at(2, 9, 15) }),
              { ...second, scheduledCollectionAt: null },
              make("JB-3003", {
                status: "Allocated",
                scheduledCollectionAt: at(0, 0, 5),
              }),
            ],
          },
        ),
      });
    }

    function listedReferences() {
      return within(screen.getByRole("region", { name: "Active jobs" }))
        .getAllByRole("link")
        .map((link) => /JB-\d+/.exec(link.textContent ?? "")?.[0]);
    }

    it("lists future jobs under All and New with their date and time, without any filter", async () => {
      const user = userEvent.setup();
      renderWithFutureJobs();
      await waitForJobsLoaded();

      const label = (iso: string) => {
        const date = new Date(iso);
        const day = date.toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
        });
        const time = date.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        });
        return `Collection ${day}, ${time}`;
      };

      const card = screen.getByRole("link", { name: /JB-3001/ });
      expect(within(card).getByText(label(at(7, 10)))).toBeInTheDocument();
      expect(within(card).getByText("Open")).toBeInTheDocument();
      expect(within(card).queryByText(/Today|Created/)).not.toBeInTheDocument();

      await user.click(screen.getByRole("tab", { name: "New" }));

      expect(screen.getByRole("link", { name: /JB-3001/ })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /JB-3002/ })).toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: /JB-3003/ }),
      ).not.toBeInTheDocument();

      await user.click(screen.getByRole("tab", { name: "Allocated" }));
      expect(screen.getByRole("link", { name: /JB-3003/ })).toBeInTheDocument();
    });

    it("sorts them after today's jobs, soonest first, and keeps the API order for the rest", async () => {
      renderWithFutureJobs();
      await waitForJobsLoaded();

      expect(listedReferences()).toEqual([
        "JB-1042", // scheduled later today
        "JB-1038", // unscheduled
        "JB-3003", // scheduled for early today
        "JB-3002", // in two days
        "JB-3001", // next week
      ]);
    });

    it.each([
      ["a minute before midnight", new Date(2026, 10, 20, 23, 59, 30)],
      ["a minute after midnight", new Date(2026, 10, 20, 0, 0, 30)],
    ])("does not push a job scheduled for today into the future group %s", async (_label, now) => {
      vi.setSystemTime(now);
      renderJobsPage("/jobs", {
        fetchImpl: stubJobsFetch(
          { ...mockAuthUser, roles: [Role.Controller] },
          {
            active: [
              make("JB-3001", { scheduledCollectionAt: at(0, 23, 59) }),
              make("JB-3002", { scheduledCollectionAt: at(0, 0, 1) }),
              make("JB-3003", { scheduledCollectionAt: null }),
            ],
          },
        ),
      });
      await waitFor(() => {
        expect(screen.getByText("JB-3001")).toBeInTheDocument();
      });

      expect(listedReferences()).toEqual(["JB-3001", "JB-3002", "JB-3003"]);
    });

    it("finds a future job by search, and keeps the order", async () => {
      const user = userEvent.setup();
      renderWithFutureJobs();
      await waitForJobsLoaded();

      await user.type(
        screen.getByRole("searchbox", {
          name: /search jobs by reference or hospital/i,
        }),
        "JB-300",
      );

      expect(listedReferences()).toEqual(["JB-3003", "JB-3002", "JB-3001"]);

      await user.clear(screen.getByRole("searchbox"));
      await user.type(screen.getByRole("searchbox"), "JB-3001");
      expect(listedReferences()).toEqual(["JB-3001"]);
    });

    it("leaves the Completed list in the order the API sent", async () => {
      const user = userEvent.setup();
      const [delivered, cancelled] = mockCompletedJobs;
      renderJobsPage("/jobs", {
        fetchImpl: stubJobsFetch(
          { ...mockAuthUser, roles: [Role.Controller] },
          {
            completed: [
              { ...cancelled, scheduledCollectionAt: at(0, 9) },
              { ...delivered, scheduledCollectionAt: at(7, 9) },
            ],
          },
        ),
      });
      await waitForJobsLoaded();

      await user.click(screen.getByRole("tab", { name: "Completed" }));

      const links = within(
        screen.getByRole("region", { name: "Completed jobs" }),
      ).getAllByRole("link");
      expect(links[0]).toHaveTextContent(cancelled.reference);
      expect(links[1]).toHaveTextContent(delivered.reference);
    });

    it("keeps the created time when the arranged time cannot be read", async () => {
      renderJobsPage("/jobs", {
        fetchImpl: stubJobsFetch(
          { ...mockAuthUser, roles: [Role.Controller] },
          {
            active: [{ ...first, scheduledCollectionAt: "not a date" }],
          },
        ),
      });
      await waitForJobsLoaded();

      const card = screen.getByRole("link", { name: /JB-1042/ });
      expect(within(card).queryByText(/^Collection /)).not.toBeInTheDocument();
      expect(
        within(card).getByText(/\d{1,2} \w{3}, \d\d:\d\d/),
      ).toBeInTheDocument();
    });

    it("keeps the created time on a job with no arranged time", async () => {
      renderWithFutureJobs();
      await waitForJobsLoaded();

      const card = screen.getByRole("link", { name: /JB-1038/ });
      expect(
        within(card).getByText(/Today, |\d{1,2} \w{3}, \d\d:\d\d/),
      ).toBeInTheDocument();
    });
  });

  it("shows the Bereavement badge only on jobs flagged as a bereavement", async () => {
    const [standard, other] = mockActiveJobs;
    renderJobsPage("/jobs", {
      fetchImpl: stubJobsFetch(
        { ...mockAuthUser, roles: [Role.Controller] },
        {
          active: [
            standard,
            {
              ...other,
              id: "99999999-9999-9999-9999-999999999991",
              reference: "JB-2001",
              jobType: "milk",
              milkLitres: 2.5,
              isBereavement: true,
            },
            {
              ...other,
              id: "99999999-9999-9999-9999-999999999992",
              reference: "JB-2002",
              jobType: "milk",
              milkLitres: 2,
              isBereavement: false,
            },
          ],
        },
      ),
    });
    await waitForJobsLoaded();

    expect(
      within(screen.getByRole("link", { name: /JB-2001/ })).getByText(
        "Bereavement",
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("link", { name: /JB-2002/ })).queryByText(
        "Bereavement",
      ),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("link", { name: /JB-1042/ })).queryByText(
        "Bereavement",
      ),
    ).not.toBeInTheDocument();
  });

  it("does not show the mother's contact on the board", async () => {
    const [standard, other] = mockActiveJobs;
    renderJobsPage("/jobs", {
      fetchImpl: stubJobsFetch(
        { ...mockAuthUser, roles: [Role.Controller] },
        {
          active: [
            standard,
            {
              ...other,
              id: "99999999-9999-9999-9999-999999999991",
              reference: "JB-2001",
              jobType: "milk",
              milkLitres: 2.5,
              mother: {
                name: "Megan Evans",
                phone: "07700 900101",
                secondaryPhone: "029 2018 0000",
              },
            },
          ],
        },
      ),
    });
    await waitForJobsLoaded();

    expect(screen.getByRole("link", { name: /JB-2001/ })).toBeInTheDocument();
    expect(screen.queryByText(/Megan Evans/)).not.toBeInTheDocument();
    expect(screen.queryByText(/07700 900101/)).not.toBeInTheDocument();
    expect(screen.queryByText(/029 2018 0000/)).not.toBeInTheDocument();
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
    expect(screen.getByText("Delivered")).toBeInTheDocument();
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
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

  it("shows an empty state when there are no active jobs", async () => {
    renderJobsPage("/jobs", {
      fetchImpl: stubJobsFetch(mockAuthUser, { active: [], completed: [] }),
    });

    await waitFor(() => {
      expect(screen.getByText("No active jobs.")).toBeInTheDocument();
    });
  });

  it("shows an error when the jobs list cannot be loaded", async () => {
    setAuthToken("test-google-id-token");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/me")) {
          return new Response(JSON.stringify(mockAuthUser), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ message: "Server error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }),
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
        },
      ],
      { initialEntries: ["/jobs"] },
    );
    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Server error");
    });
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
    expect(jobLink).toHaveAttribute(
      "href",
      "/jobs/11111111-1111-1111-1111-111111111111",
    );
  });

  it("shows an estimate on the card next to the matching address", async () => {
    const collection = new Date();
    collection.setHours(9, 30, 0, 0);
    const [first, ...rest] = mockActiveJobs;
    renderJobsPage("/jobs", {
      fetchImpl: stubJobsFetch(
        { ...mockAuthUser, roles: [Role.Controller] },
        {
          active: [
            {
              ...first,
              estimatedCollectionAt: collection.toISOString(),
              estimatedDeliveryAt: null,
            },
            ...rest,
          ],
        },
      ),
    });
    await waitForJobsLoaded();

    const card = within(screen.getByRole("link", { name: /JB-1042/i }));
    const estimate = card.getByText("Estimated collection: Today, 09:30");
    expect(estimate.previousElementSibling).toHaveTextContent(
      first.collection.address,
    );
    expect(card.queryByText(/Estimated delivery/)).not.toBeInTheDocument();
  });

  it("shows no estimate lines when a job has none", async () => {
    renderJobsPage();
    await waitForJobsLoaded();

    expect(screen.queryByText(/Estimated collection/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Estimated delivery/)).not.toBeInTheDocument();
  });

  it("shows each postcode after its address, and not twice when the address has it", async () => {
    const [first, ...rest] = mockActiveJobs;
    renderJobsPage("/jobs", {
      fetchImpl: stubJobsFetch(
        { ...mockAuthUser, roles: [Role.Controller] },
        {
          active: [
            {
              ...first,
              collection: { ...first.collection, postcode: "CF72 8XR" },
              delivery: {
                ...first.delivery,
                address: "University Hospital of Wales, Cardiff CF14 4XW, UK",
                postcode: "cf144xw",
              },
            },
            ...rest,
          ],
        },
      ),
    });
    await waitForJobsLoaded();

    const card = within(screen.getByRole("link", { name: /JB-1042/i }));
    expect(
      card.getByText(`${first.collection.address}, CF72 8XR`),
    ).toBeInTheDocument();
    expect(
      card.getByText("University Hospital of Wales, Cardiff CF14 4XW, UK"),
    ).toBeInTheDocument();
    expect(card.queryByText(/cf144xw/i)).not.toBeInTheDocument();
  });

  it("shows just the address when the place has no postcode", async () => {
    const [first, ...rest] = mockActiveJobs;
    renderJobsPage("/jobs", {
      fetchImpl: stubJobsFetch(
        { ...mockAuthUser, roles: [Role.Controller] },
        {
          active: [
            {
              ...first,
              collection: { ...first.collection, postcode: null },
            },
            ...rest,
          ],
        },
      ),
    });
    await waitForJobsLoaded();

    const card = within(screen.getByRole("link", { name: /JB-1042/i }));
    expect(card.getByText(first.collection.address)).toBeInTheDocument();
  });
});

describe("Show all previous jobs", () => {
  const [recentJob] = mockCompletedJobs;
  const olderJob = {
    ...mockCompletedJobs[1],
    id: "10410410-1111-1111-1111-111111111104",
    reference: "JB-0900",
  };
  const SWITCH_NAME = "Show all previous jobs";

  function fetchWithOlderJob(
    options: { showCompletedJobs?: boolean; failSettingsSave?: boolean } = {},
  ) {
    return stubJobsFetch(
      {
        ...mockAuthUser,
        settings: { showCompletedJobs: options.showCompletedJobs ?? false },
      },
      {
        completed: [recentJob],
        olderCompleted: [olderJob],
        failSettingsSave: options.failSettingsSave,
      },
    );
  }

  async function openCompletedTab() {
    const user = userEvent.setup();
    await waitForJobsLoaded();
    await user.click(screen.getByRole("tab", { name: "Completed" }));
    return user;
  }

  function requestsTo(
    fetchImpl: ReturnType<typeof stubJobsFetch>,
    method: string,
    pathEnd: string,
  ) {
    return fetchImpl.mock.calls.filter(
      ([url, init]) =>
        String(url).endsWith(pathEnd) &&
        (init?.method?.toUpperCase() ?? "GET") === method,
    );
  }

  it("only appears on the Completed tab", async () => {
    renderJobsPage("/jobs", { fetchImpl: fetchWithOlderJob() });
    await waitForJobsLoaded();

    expect(
      screen.queryByRole("switch", { name: SWITCH_NAME }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Completed" }));

    expect(screen.getByRole("switch", { name: SWITCH_NAME })).toBeVisible();
  });

  it("is off by default and lists only what the API returns", async () => {
    renderJobsPage("/jobs", { fetchImpl: fetchWithOlderJob() });
    await openCompletedTab();

    expect(screen.getByRole("switch", { name: SWITCH_NAME })).not.toBeChecked();
    expect(screen.getByText("JB-1020")).toBeInTheDocument();
    expect(screen.queryByText("JB-0900")).not.toBeInTheDocument();
  });

  it("starts on when the signed-in user has saved it, and shows the older jobs", async () => {
    renderJobsPage("/jobs", {
      fetchImpl: fetchWithOlderJob({ showCompletedJobs: true }),
    });
    await openCompletedTab();

    expect(screen.getByRole("switch", { name: SWITCH_NAME })).toBeChecked();
    expect(screen.getByText("JB-0900")).toBeInTheDocument();
  });

  it("saves through PATCH /me, then refetches the completed list and shows the older jobs", async () => {
    const fetchImpl = fetchWithOlderJob();
    renderJobsPage("/jobs", { fetchImpl });
    const user = await openCompletedTab();
    const completedBefore = requestsTo(
      fetchImpl,
      "GET",
      "/jobs/completed",
    ).length;

    await user.click(screen.getByRole("switch", { name: SWITCH_NAME }));

    expect(await screen.findByText("JB-0900")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: SWITCH_NAME })).toBeChecked();

    const patches = requestsTo(fetchImpl, "PATCH", "/me");
    expect(patches).toHaveLength(1);
    expect(JSON.parse(String(patches[0][1]?.body))).toEqual({
      showCompletedJobs: true,
    });
    expect(requestsTo(fetchImpl, "GET", "/jobs/completed")).toHaveLength(
      completedBefore + 1,
    );

    // The saved write comes first, so the refetch sees the new setting.
    const order = fetchImpl.mock.calls.map(
      ([url, init]) => `${init?.method ?? "GET"} ${String(url)}`,
    );
    const patchAt = order.findIndex((call) => call.startsWith("PATCH"));
    expect(
      order.slice(patchAt + 1).some((call) => call.endsWith("/jobs/completed")),
    ).toBe(true);
  });

  it("hides the older jobs again when it is turned off", async () => {
    renderJobsPage("/jobs", {
      fetchImpl: fetchWithOlderJob({ showCompletedJobs: true }),
    });
    const user = await openCompletedTab();
    expect(screen.getByText("JB-0900")).toBeInTheDocument();

    await user.click(screen.getByRole("switch", { name: SWITCH_NAME }));

    await waitFor(() => {
      expect(screen.queryByText("JB-0900")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("switch", { name: SWITCH_NAME })).not.toBeChecked();
    expect(screen.getByText("JB-1020")).toBeInTheDocument();
  });

  it("goes back and shows an error when the save fails", async () => {
    const fetchImpl = fetchWithOlderJob({ failSettingsSave: true });
    renderJobsPage("/jobs", { fetchImpl });
    const user = await openCompletedTab();
    const completedBefore = requestsTo(
      fetchImpl,
      "GET",
      "/jobs/completed",
    ).length;

    await user.click(screen.getByRole("switch", { name: SWITCH_NAME }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not save your setting.",
    );
    expect(screen.getByRole("switch", { name: SWITCH_NAME })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: SWITCH_NAME })).toBeEnabled();
    expect(screen.queryByText("JB-0900")).not.toBeInTheDocument();
    expect(requestsTo(fetchImpl, "GET", "/jobs/completed")).toHaveLength(
      completedBefore,
    );
  });

  it("survives a remount with the same signed-in user", async () => {
    const fetchImpl = fetchWithOlderJob();
    setAuthToken("test-google-id-token");
    vi.stubGlobal("fetch", fetchImpl);
    const router = createMemoryRouter(
      [
        {
          element: (
            <AuthProvider>
              <Outlet />
            </AuthProvider>
          ),
          children: [
            { path: "/jobs", element: <JobsPage /> },
            { path: "/elsewhere", element: <p>Somewhere else</p> },
          ],
        },
      ],
      { initialEntries: ["/jobs"] },
    );
    render(<RouterProvider router={router} />);
    const user = await openCompletedTab();
    await user.click(screen.getByRole("switch", { name: SWITCH_NAME }));
    expect(await screen.findByText("JB-0900")).toBeInTheDocument();

    await router.navigate("/elsewhere");
    expect(await screen.findByText("Somewhere else")).toBeInTheDocument();
    await router.navigate("/jobs");
    await waitForJobsLoaded();
    await user.click(screen.getByRole("tab", { name: "Completed" }));

    expect(screen.getByRole("switch", { name: SWITCH_NAME })).toBeChecked();
    expect(await screen.findByText("JB-0900")).toBeInTheDocument();
    expect(requestsTo(fetchImpl, "PATCH", "/me")).toHaveLength(1);
  });

  it("is still on after signing in again, because the API holds it", async () => {
    const fetchImpl = fetchWithOlderJob();
    const first = renderJobsPage("/jobs", { fetchImpl });
    const user = await openCompletedTab();
    await user.click(screen.getByRole("switch", { name: SWITCH_NAME }));
    expect(await screen.findByText("JB-0900")).toBeInTheDocument();
    first.unmount();

    // A new session: nothing is carried over in the browser, only GET /me.
    renderJobsPage("/jobs", { fetchImpl });
    await openCompletedTab();

    expect(screen.getByRole("switch", { name: SWITCH_NAME })).toBeChecked();
    expect(await screen.findByText("JB-0900")).toBeInTheDocument();
  });

  it("does no age filtering of its own", async () => {
    // Completed long ago, yet listed because that is what the API returned.
    const ancient = {
      ...recentJob,
      id: "10510510-1111-1111-1111-111111111105",
      reference: "JB-0001",
      createdAt: "2020-01-01T00:00:00.000Z",
      deliveryRecord: {
        recipient: "Someone",
        noRecipient: false,
        deliveredAt: "2020-01-01T01:00:00.000Z",
      },
    };
    renderJobsPage("/jobs", {
      fetchImpl: stubJobsFetch(mockAuthUser, { completed: [ancient] }),
    });
    await openCompletedTab();

    expect(screen.getByText("JB-0001")).toBeInTheDocument();
  });

  it("keeps the setting out of localStorage and sessionStorage", async () => {
    const fetchImpl = fetchWithOlderJob();
    renderJobsPage("/jobs", { fetchImpl });
    const user = await openCompletedTab();
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    await user.click(screen.getByRole("switch", { name: SWITCH_NAME }));
    expect(await screen.findByText("JB-0900")).toBeInTheDocument();

    const written = setItem.mock.calls.map(([key, value]) => `${key}=${value}`);
    expect(written.filter((entry) => /complet|show/i.test(entry))).toEqual([]);
    setItem.mockRestore();
  });

  it("does not crash when an older API sends no settings", async () => {
    setAuthToken("test-google-id-token");
    const stub = fetchWithOlderJob();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const response = await stub(input, init);
        if (String(input).endsWith("/me")) {
          const { settings: _settings, ...profile } = await response.json();
          return new Response(JSON.stringify(profile), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return response;
      }),
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
        },
      ],
      { initialEntries: ["/jobs"] },
    );
    render(<RouterProvider router={router} />);
    await openCompletedTab();

    expect(screen.getByRole("switch", { name: SWITCH_NAME })).not.toBeChecked();
    expect(screen.getByText("JB-1020")).toBeInTheDocument();
  });

  it("says when nothing was completed in the last 24 hours", async () => {
    renderJobsPage("/jobs", {
      fetchImpl: stubJobsFetch(mockAuthUser, { completed: [] }),
    });
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Completed" })).toBeVisible();
    });
    await userEvent.click(screen.getByRole("tab", { name: "Completed" }));

    expect(
      screen.getByText("No jobs completed in the last 24 hours."),
    ).toBeInTheDocument();
  });
});
