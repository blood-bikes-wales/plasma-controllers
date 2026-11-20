import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
import { mockAuthUser } from "../../tests/auth-fixtures";
import { mockActiveJobs, stubJobsFetch } from "../../tests/job-fixtures";
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
}: {
  jobId?: string;
  roles?: Role[];
  active?: DeliveryJob[];
  olderCompleted?: DeliveryJob[];
} = {}) {
  const user = { ...mockAuthUser, roles };
  setAuthToken("test-google-id-token");
  setActiveRole(roles[0]);
  const fetchStub = vi.fn(
    stubJobsFetch(user, {
      ...(active ? { active } : {}),
      ...(olderCompleted ? { olderCompleted } : {}),
    }),
  );
  vi.stubGlobal("fetch", fetchStub);

  const router = createMemoryRouter(withAuthProvider(appRoutes), {
    initialEntries: [`/jobs/${jobId}`],
  });

  render(<RouterProvider router={router} />);

  return { fetchStub };
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

  it("allocates a rider and advances the job status", async () => {
    const user = userEvent.setup();
    renderJobDetail();

    expect(
      await screen.findByRole("heading", { name: "Allocate rider" }),
    ).toBeInTheDocument();

    await user.click(screen.getByLabelText("Active shift rider"));
    await user.click(
      await screen.findByRole("option", { name: /Alex Morgan/ }),
    );

    await user.click(screen.getByRole("button", { name: "Allocate rider" }));

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

    await user.click(
      await screen.findByRole("button", { name: "Record collection" }),
    );

    expect(await screen.findByText("Enter a job number")).toBeInTheDocument();
    expect(screen.queryByText(/receipt number/i)).not.toBeInTheDocument();
  });

  it("shows the job number on the job detail after collection", async () => {
    const user = userEvent.setup();
    renderJobDetail({ jobId: allocatedJobId });

    await user.click(await screen.findByLabelText("Contents confirmed"));
    await user.click(await screen.findByRole("option", { name: "Yes" }));
    await user.type(screen.getByLabelText("Job number"), "JN-2042");
    await user.click(screen.getByRole("button", { name: "Record collection" }));

    expect(await screen.findByText("Collected · job JN-2042")).toBeVisible();
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
    await user.type(screen.getByLabelText("Job number"), "JN-2043");
    await user.click(screen.getByRole("button", { name: "Record collection" }));

    expect(await screen.findByText("Collected · job JN-2043")).toBeVisible();

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
    await user.click(screen.getByRole("button", { name: "Record collection" }));

    expect(await screen.findByText("Collected · job JN-3001")).toBeVisible();
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
    await user.click(screen.getByRole("button", { name: "Record delivery" }));

    await waitFor(() => {
      expect(screen.getByText("Delivered to Sister Jones")).toBeVisible();
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
    await user.click(screen.getByRole("button", { name: "Record delivery" }));

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

    await user.click(
      await screen.findByRole("button", { name: "Record delivery" }),
    );
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

    await user.click(
      await screen.findByRole("checkbox", { name: "No person or recipient" }),
    );
    await user.click(screen.getByRole("button", { name: "Record delivery" }));

    expect(await screen.findByText("Delivered, no recipient")).toBeVisible();
    expect(screen.queryByText(/Delivered to/)).not.toBeInTheDocument();
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

    await user.type(await screen.findByLabelText("Recipient"), "Sister Jones");
    await user.click(screen.getByRole("button", { name: "Record delivery" }));

    expect(await screen.findByText("Delivered to Sister Jones")).toBeVisible();
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

    expect(await screen.findByText("Delivered, no recipient")).toBeVisible();
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
      await user.click(
        screen.getByRole("button", { name: "Record collection" }),
      );

      expect(await screen.findByText("Collected · job JN-3001")).toBeVisible();
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
      await user.click(screen.getByRole("button", { name: "Record delivery" }));

      await waitFor(() => {
        expect(screen.getByText("Delivered to Sister Jones")).toBeVisible();
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
