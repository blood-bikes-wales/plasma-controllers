import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "~/lib/auth";
import { clearAuthToken, setAuthToken } from "~/lib/auth-token";
import type { ManagedJobContent } from "~/lib/job-contents";
import { Role } from "~/lib/roles";

import { mockAuthUser } from "../../tests/auth-fixtures";
import OperationsJobContentsPage, { meta } from "./operations.job-contents";

function initialEntries(): ManagedJobContent[] {
  return [
    { id: "c1", name: "Blood samples", active: true, sortOrder: 1 },
    { id: "c2", name: "Milk", active: true, sortOrder: 2 },
    { id: "c3", name: "Retired thing", active: false, sortOrder: 3 },
  ];
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** An in-memory stand-in for the API's /job-contents endpoints. */
function stubFetch(roles: Role[] = [Role.Trustee]) {
  const entries = initialEntries();

  const handler = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method?.toUpperCase() ?? "GET";

      if (url.includes("/me")) {
        return jsonResponse({ ...mockAuthUser, roles });
      }

      if (url.endsWith("/job-contents") && method === "GET") {
        return jsonResponse({ data: entries });
      }

      if (url.endsWith("/job-contents") && method === "POST") {
        const { name } = JSON.parse(String(init?.body)) as { name: string };
        if (entries.some((e) => e.name.toLowerCase() === name.toLowerCase())) {
          return jsonResponse(
            {
              message: "There is already a contents entry with that name.",
              errors: {
                name: ["There is already a contents entry with that name."],
              },
            },
            422,
          );
        }
        const created = {
          id: `c${entries.length + 1}`,
          name,
          active: true,
          sortOrder: entries.length + 1,
        };
        entries.push(created);
        return jsonResponse(created, 201);
      }

      const match = url.match(/\/job-contents\/(\w+)$/);
      if (match && method === "PATCH") {
        const entry = entries.find((e) => e.id === match[1]);
        if (!entry) {
          return jsonResponse({ message: "Not found" }, 404);
        }
        Object.assign(entry, JSON.parse(String(init?.body)));
        return jsonResponse(entry);
      }

      return jsonResponse({ message: "Not found" }, 404);
    },
  );

  return handler;
}

function renderPage() {
  const router = createMemoryRouter(
    [
      {
        path: "/operations/job-contents",
        element: (
          <AuthProvider>
            <OperationsJobContentsPage />
          </AuthProvider>
        ),
      },
    ],
    { initialEntries: ["/operations/job-contents"] },
  );

  return render(<RouterProvider router={router} />);
}

afterEach(() => {
  clearAuthToken();
  vi.unstubAllGlobals();
});

describe("OperationsJobContentsPage", () => {
  it("exports page meta", () => {
    expect(meta({} as Parameters<typeof meta>[0])).toEqual([
      { title: "Job contents — Plasma Controller" },
    ]);
  });

  it("denies controllers without loading the list", async () => {
    setAuthToken("test-google-id-token");
    const fetchStub = stubFetch([Role.Controller]);
    vi.stubGlobal("fetch", fetchStub);

    renderPage();

    expect(
      await screen.findByText(
        "You do not have permission to manage job contents.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("New contents")).not.toBeInTheDocument();
    const urls = fetchStub.mock.calls.map(([input]) => String(input));
    expect(urls.some((url) => url.endsWith("/job-contents"))).toBe(false);
  });

  it("lists every entry for trustees, marking inactive ones", async () => {
    setAuthToken("test-google-id-token");
    vi.stubGlobal("fetch", stubFetch());

    renderPage();

    expect(await screen.findByText("Blood samples")).toBeInTheDocument();
    expect(screen.getByText("Milk")).toBeInTheDocument();
    const retired = screen.getByText("Retired thing").closest("li");
    expect(retired).not.toBeNull();
    expect(within(retired as HTMLElement).getByText("Inactive")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Reactivate Retired thing" }),
    ).toBeInTheDocument();
  });

  it("also lets admins manage the list", async () => {
    setAuthToken("test-google-id-token");
    vi.stubGlobal("fetch", stubFetch([Role.Admin]));

    renderPage();

    expect(await screen.findByText("Blood samples")).toBeInTheDocument();
    expect(screen.getByLabelText("New contents")).toBeInTheDocument();
  });

  it("adds an entry, trimming the name", async () => {
    const user = userEvent.setup();
    setAuthToken("test-google-id-token");
    const fetchStub = stubFetch();
    vi.stubGlobal("fetch", fetchStub);

    renderPage();
    await screen.findByText("Blood samples");

    await user.type(screen.getByLabelText("New contents"), "  Platelets ");
    await user.click(screen.getByRole("button", { name: "Add contents" }));

    expect(await screen.findByText("Added Platelets.")).toBeInTheDocument();
    expect(screen.getByLabelText("New contents")).toHaveValue("");
    const post = fetchStub.mock.calls.find(
      ([, init]) => init?.method === "POST",
    );
    expect(post?.[1]?.body).toBe(JSON.stringify({ name: "Platelets" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("blocks a blank name without calling the API", async () => {
    const user = userEvent.setup();
    setAuthToken("test-google-id-token");
    const fetchStub = stubFetch();
    vi.stubGlobal("fetch", fetchStub);

    renderPage();
    await screen.findByText("Blood samples");

    await user.type(screen.getByLabelText("New contents"), "   ");
    await user.click(screen.getByRole("button", { name: "Add contents" }));

    expect(
      screen.getByText("Enter a name for the contents"),
    ).toBeInTheDocument();
    expect(
      fetchStub.mock.calls.some(([, init]) => init?.method === "POST"),
    ).toBe(false);
  });

  it("shows the API's message for a duplicate name", async () => {
    const user = userEvent.setup();
    setAuthToken("test-google-id-token");
    vi.stubGlobal("fetch", stubFetch());

    renderPage();
    await screen.findByText("Blood samples");

    await user.type(screen.getByLabelText("New contents"), "milk");
    await user.click(screen.getByRole("button", { name: "Add contents" }));

    expect(
      await screen.findByText(
        "There is already a contents entry with that name.",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("renames an entry", async () => {
    const user = userEvent.setup();
    setAuthToken("test-google-id-token");
    const fetchStub = stubFetch();
    vi.stubGlobal("fetch", fetchStub);

    renderPage();
    await screen.findByText("Blood samples");

    await user.click(screen.getByRole("button", { name: "Rename Milk" }));
    const input = screen.getByLabelText("Rename Milk");
    await user.clear(input);
    await user.type(input, "Breast milk");
    await user.click(screen.getByRole("button", { name: "Save name" }));

    expect(
      await screen.findByText("Renamed to Breast milk."),
    ).toBeInTheDocument();
    expect(screen.getByText("Breast milk")).toBeInTheDocument();
    expect(screen.queryByText("Milk")).not.toBeInTheDocument();
    const patch = fetchStub.mock.calls.find(
      ([, init]) => init?.method === "PATCH",
    );
    expect(String(patch?.[0])).toMatch(/\/job-contents\/c2$/);
    expect(patch?.[1]?.body).toBe(JSON.stringify({ name: "Breast milk" }));
  });

  it("cancels a rename without saving", async () => {
    const user = userEvent.setup();
    setAuthToken("test-google-id-token");
    const fetchStub = stubFetch();
    vi.stubGlobal("fetch", fetchStub);

    renderPage();
    await screen.findByText("Blood samples");

    await user.click(screen.getByRole("button", { name: "Rename Milk" }));
    await user.type(screen.getByLabelText("Rename Milk"), "x");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText("Milk")).toBeInTheDocument();
    expect(
      fetchStub.mock.calls.some(([, init]) => init?.method === "PATCH"),
    ).toBe(false);
  });

  it("deactivates and reactivates an entry", async () => {
    const user = userEvent.setup();
    setAuthToken("test-google-id-token");
    vi.stubGlobal("fetch", stubFetch());

    renderPage();
    await screen.findByText("Blood samples");

    await user.click(
      screen.getByRole("button", { name: "Deactivate Blood samples" }),
    );
    expect(
      await screen.findByText("Deactivated Blood samples."),
    ).toBeInTheDocument();
    await user.click(
      await screen.findByRole("button", { name: "Reactivate Blood samples" }),
    );
    expect(
      await screen.findByText("Reactivated Blood samples."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Deactivate Blood samples" }),
    ).toBeInTheDocument();
  });

  it("shows an error when the list cannot be loaded", async () => {
    setAuthToken("test-google-id-token");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).includes("/me")
          ? jsonResponse({ ...mockAuthUser, roles: [Role.Trustee] })
          : jsonResponse({ message: "Server exploded" }, 500),
      ),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Server exploded");
    });
  });

  it("keeps the load error visible after adding an entry and retries", async () => {
    const user = userEvent.setup();
    setAuthToken("test-google-id-token");
    const entries = initialEntries();
    let listCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method?.toUpperCase() ?? "GET";
        if (url.includes("/me")) {
          return jsonResponse({ ...mockAuthUser, roles: [Role.Trustee] });
        }
        if (url.endsWith("/job-contents") && method === "GET") {
          listCalls += 1;
          return listCalls === 1
            ? jsonResponse({ message: "Server exploded" }, 500)
            : jsonResponse({ data: entries });
        }
        if (url.endsWith("/job-contents") && method === "POST") {
          return jsonResponse(
            { id: "c9", name: "Platelets", active: true, sortOrder: 9 },
            201,
          );
        }
        return jsonResponse({ message: "Not found" }, 404);
      }),
    );

    renderPage();
    expect(await screen.findByText("Server exploded")).toBeInTheDocument();
    expect(
      screen.queryByText("No contents have been set up yet. Add one above."),
    ).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("New contents"), "Platelets");
    await user.click(screen.getByRole("button", { name: "Add contents" }));
    expect(await screen.findByText("Added Platelets.")).toBeInTheDocument();

    // The partial list is still flagged as incomplete.
    expect(screen.getByText("Server exploded")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Blood samples")).toBeInTheDocument();
    expect(screen.queryByText("Server exploded")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });
});
