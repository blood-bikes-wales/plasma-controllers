import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "~/lib/auth";
import { clearAuthToken, setAuthToken } from "~/lib/auth-token";
import type { PostcodeAreaMapping } from "~/lib/postcode-areas";
import { Role } from "~/lib/roles";

import { mockAuthUser } from "../../tests/auth-fixtures";
import OperationsPostcodeAreasPage, { meta } from "./operations.postcode-areas";

const mappings: PostcodeAreaMapping[] = [
  {
    id: "area-1",
    outboundPostcode: "CF14",
    areaCode: "E",
    areaFullName: "East",
    sortOrder: 1,
    active: true,
  },
  {
    id: "area-2",
    outboundPostcode: "LL57",
    areaCode: "NW",
    areaFullName: "North West",
    sortOrder: 2,
    active: false,
  },
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function stubFetch(roles: Role[] = [Role.Trustee]) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method?.toUpperCase() ?? "GET";

    if (url.includes("/me")) {
      return jsonResponse({ ...mockAuthUser, roles });
    }

    if (url.includes("/postcode-areas") && method === "GET") {
      return jsonResponse({ data: mappings });
    }

    if (url.includes("/postcode-areas") && method === "POST") {
      return jsonResponse(
        {
          id: "area-3",
          outboundPostcode: "SA1",
          areaCode: "S",
          areaFullName: "Swansea",
          sortOrder: 3,
          active: true,
        },
        201,
      );
    }

    return jsonResponse({ message: "Not found" }, 404);
  });
}

afterEach(() => {
  clearAuthToken();
  vi.unstubAllGlobals();
});

describe("OperationsPostcodeAreasPage", () => {
  it("exports page meta", () => {
    expect(meta({} as Parameters<typeof meta>[0])).toEqual([
      { title: "Postcode areas — Plasma Controller" },
    ]);
  });

  it("denies controllers", async () => {
    setAuthToken("test-google-id-token");
    vi.stubGlobal("fetch", stubFetch([Role.Controller]));

    const router = createMemoryRouter(
      [
        {
          path: "/operations/postcode-areas",
          element: (
            <AuthProvider>
              <OperationsPostcodeAreasPage />
            </AuthProvider>
          ),
        },
      ],
      { initialEntries: ["/operations/postcode-areas"] },
    );

    render(<RouterProvider router={router} />);

    expect(
      await screen.findByText(
        "You do not have permission to manage postcode area mappings.",
      ),
    ).toBeInTheDocument();
  });

  it("lists mappings for trustees", async () => {
    setAuthToken("test-google-id-token");
    vi.stubGlobal("fetch", stubFetch([Role.Trustee]));

    const router = createMemoryRouter(
      [
        {
          path: "/operations/postcode-areas",
          element: (
            <AuthProvider>
              <OperationsPostcodeAreasPage />
            </AuthProvider>
          ),
        },
      ],
      { initialEntries: ["/operations/postcode-areas"] },
    );

    render(<RouterProvider router={router} />);

    expect(await screen.findByText("CF14")).toBeInTheDocument();
    expect(screen.getByText("LL57")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Add mapping/i }),
    ).toBeInTheDocument();
  });

  it("opens the add mapping drawer", async () => {
    const user = userEvent.setup();
    setAuthToken("test-google-id-token");
    vi.stubGlobal("fetch", stubFetch([Role.Trustee]));

    const router = createMemoryRouter(
      [
        {
          path: "/operations/postcode-areas",
          element: (
            <AuthProvider>
              <OperationsPostcodeAreasPage />
            </AuthProvider>
          ),
        },
      ],
      { initialEntries: ["/operations/postcode-areas"] },
    );

    render(<RouterProvider router={router} />);

    await screen.findByText("CF14");
    await user.click(screen.getByRole("button", { name: /Add mapping/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Add mapping" }),
      ).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Outbound postcode")).toBeInTheDocument();
  });
});
