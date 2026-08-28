import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "~/lib/auth";
import { clearAuthToken, setAuthToken } from "~/lib/auth-token";
import { Role } from "~/lib/roles";

import {
  mockAuthUser,
  stubAuthenticatedFetch,
} from "../../tests/auth-fixtures";
import ShiftsPage, { meta } from "./shifts";

afterEach(() => {
  clearAuthToken();
  vi.unstubAllGlobals();
});

function renderShiftsPage({ roles = [Role.Controller] } = {}) {
  setAuthToken("test-google-id-token");
  vi.stubGlobal("fetch", stubAuthenticatedFetch({ ...mockAuthUser, roles }));

  const router = createMemoryRouter(
    [
      {
        path: "/shifts",
        element: (
          <AuthProvider>
            <ShiftsPage />
          </AuthProvider>
        ),
      },
    ],
    { initialEntries: ["/shifts"] },
  );

  return render(<RouterProvider router={router} />);
}

describe("ShiftsPage", () => {
  it("exports page meta", () => {
    expect(meta({} as Parameters<typeof meta>[0])).toEqual([
      { title: "Shifts — Plasma Controller" },
    ]);
  });

  it("renders the page heading and the currently active shift", async () => {
    renderShiftsPage();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Shifts" }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Mike Davies")).toBeInTheDocument();
    expect(screen.getByText("CF34 DEF")).toBeInTheDocument();
    expect(screen.getByText("1 on duty")).toBeInTheDocument();
  });

  it("lets a coordinator log on a rider with a bike and mileage", async () => {
    const user = userEvent.setup();
    renderShiftsPage();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Log on rider" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Log on rider" }));

    await user.click(screen.getByRole("combobox", { name: "Rider" }));
    await user.click(
      await screen.findByRole("option", { name: "Sarah Jones" }),
    );

    await user.click(screen.getByRole("combobox", { name: "Bike" }));
    await user.click(await screen.findByRole("option", { name: "CF12 ABC" }));

    await user.type(screen.getByLabelText("Start mileage"), "15234");

    const logOnButton = screen.getByRole("button", { name: "Log on" });
    expect(logOnButton).toBeEnabled();
    await user.click(logOnButton);

    await waitFor(() => {
      expect(screen.getByText("2 on duty")).toBeInTheDocument();
    });
    expect(screen.getByText("Sarah Jones")).toBeInTheDocument();
  });

  it("requires a reason when start mileage does not match the bike's last recorded mileage", async () => {
    const user = userEvent.setup();
    renderShiftsPage();

    await user.click(
      await screen.findByRole("button", { name: "Log on rider" }),
    );

    await user.click(screen.getByRole("combobox", { name: "Rider" }));
    await user.click(
      await screen.findByRole("option", { name: "Sarah Jones" }),
    );

    await user.click(screen.getByRole("combobox", { name: "Bike" }));
    await user.click(await screen.findByRole("option", { name: "CF12 ABC" }));

    await user.type(screen.getByLabelText("Start mileage"), "16000");

    const logOnButton = screen.getByRole("button", { name: "Log on" });
    expect(logOnButton).toBeDisabled();
    expect(
      screen.getByText(/does not match this bike's last recorded mileage/i),
    ).toBeInTheDocument();

    await user.type(
      screen.getByLabelText("Reason for the mileage difference"),
      "Odometer reset after a repair",
    );
    expect(logOnButton).toBeEnabled();
  });

  it("does not allow selecting a rider or bike that is already on shift", async () => {
    const user = userEvent.setup();
    renderShiftsPage();

    await user.click(
      await screen.findByRole("button", { name: "Log on rider" }),
    );

    await user.click(screen.getByRole("combobox", { name: "Rider" }));
    expect(
      screen.queryByRole("option", { name: "Mike Davies" }),
    ).not.toBeInTheDocument();
    await user.click(
      await screen.findByRole("option", { name: "Sarah Jones" }),
    );

    await user.click(screen.getByRole("combobox", { name: "Bike" }));
    expect(
      screen.queryByRole("option", { name: "CF34 DEF" }),
    ).not.toBeInTheDocument();
  });

  it("lets a coordinator log off a rider and updates the bike mileage", async () => {
    const user = userEvent.setup();
    renderShiftsPage();

    await user.click(await screen.findByRole("button", { name: "Log off" }));

    await user.type(screen.getByLabelText("End mileage"), "9950");
    await user.click(screen.getByRole("button", { name: "Log off" }));

    await waitFor(() => {
      expect(screen.getByText("0 on duty")).toBeInTheDocument();
    });
    expect(
      screen.getByText("No riders are currently on shift."),
    ).toBeInTheDocument();
  });

  it("rejects an end mileage lower than the start mileage", async () => {
    const user = userEvent.setup();
    renderShiftsPage();

    await user.click(await screen.findByRole("button", { name: "Log off" }));

    await user.type(screen.getByLabelText("End mileage"), "100");

    expect(
      screen.getByText(/cannot be lower than the start mileage/i),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Log off" }).at(-1),
    ).toBeDisabled();
  });

  it("hides the management UI for read-only roles", async () => {
    renderShiftsPage({ roles: [Role.Rider] });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Shifts" }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Mike Davies")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Log on rider" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Log off" }),
    ).not.toBeInTheDocument();
  });
});
