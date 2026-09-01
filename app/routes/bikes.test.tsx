import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "~/lib/auth";
import { clearAuthToken, setAuthToken } from "~/lib/auth-token";
import { Role } from "~/lib/roles";

import { mockAuthUser } from "../../tests/auth-fixtures";
import { stubBikesFetch } from "../../tests/bike-fixtures";
import BikesPage, { meta } from "./bikes";

afterEach(() => {
  clearAuthToken();
  vi.unstubAllGlobals();
});

describe("BikesPage", () => {
  it("exports page meta", () => {
    expect(meta({} as Parameters<typeof meta>[0])).toEqual([
      { title: "Bikes — Plasma Controller" },
    ]);
  });

  it("renders the fleet list for trustees", async () => {
    setAuthToken("test-google-id-token");
    vi.stubGlobal(
      "fetch",
      stubBikesFetch({ ...mockAuthUser, roles: [Role.Trustee] }),
    );

    const router = createMemoryRouter(
      [
        {
          path: "/bikes",
          element: (
            <AuthProvider>
              <BikesPage />
            </AuthProvider>
          ),
        },
      ],
      { initialEntries: ["/bikes"] },
    );

    render(<RouterProvider router={router} />);

    expect(await screen.findByText("CF12 ABC")).toBeInTheDocument();
    expect(screen.getByText("CF34 DEF")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Add bike/i }),
    ).toBeInTheDocument();
  });
});
