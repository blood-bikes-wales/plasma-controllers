import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "~/lib/auth";
import { clearAuthToken, setAuthToken } from "~/lib/auth-token";
import { Role } from "~/lib/roles";

import { mockAuthUser } from "../../tests/auth-fixtures";
import { stubDirectoryFetch } from "../../tests/directory-fixtures";
import DirectoryPage, { meta } from "./directory";

afterEach(() => {
  clearAuthToken();
  vi.unstubAllGlobals();
});

function renderDirectoryPage({ roles = [Role.Rider] } = {}) {
  setAuthToken("test-google-id-token");
  vi.stubGlobal("fetch", stubDirectoryFetch({ ...mockAuthUser, roles }));

  const router = createMemoryRouter(
    [
      {
        path: "/directory",
        element: (
          <AuthProvider>
            <DirectoryPage />
          </AuthProvider>
        ),
      },
    ],
    { initialEntries: ["/directory"] },
  );

  return render(<RouterProvider router={router} />);
}

describe("DirectoryPage", () => {
  it("exports page meta", () => {
    expect(meta({} as Parameters<typeof meta>[0])).toEqual([
      { title: "Directory — Plasma Controller" },
    ]);
  });

  it("shows guidance before a search is entered", async () => {
    renderDirectoryPage();
    expect(
      await screen.findByText("Search by name, role, or area to find riders."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Alex Morgan")).not.toBeInTheDocument();
  });

  it("returns matching riders after search", async () => {
    const user = userEvent.setup();
    renderDirectoryPage();

    await user.type(screen.getByLabelText("Name"), "alex");

    await waitFor(() => {
      expect(screen.getByText("Alex Morgan")).toBeInTheDocument();
    });
    expect(screen.getByText("South Wales")).toBeInTheDocument();
    expect(screen.getByText("07700 900001")).toBeInTheDocument();
  });

  it("returns matching bikes after search and can expand mileage history", async () => {
    const user = userEvent.setup();
    renderDirectoryPage();

    await user.click(screen.getByRole("button", { name: "Bikes" }));
    await user.type(screen.getByLabelText("Registration"), "cf12");

    await waitFor(() => {
      expect(screen.getByText("CF12 ABC")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Show history" }));

    await waitFor(() => {
      expect(screen.getByText("15234 miles")).toBeInTheDocument();
    });
  });
});
