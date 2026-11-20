import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "~/lib/auth";
import { clearAuthToken, setAuthToken } from "~/lib/auth-token";
import { Role } from "~/lib/roles";

import { mockAuthUser } from "../../tests/auth-fixtures";
import {
  mockMikeShift,
  mockSarahBikelessShift,
  stubShiftsFetch,
} from "../../tests/shift-fixtures";
import ShiftsPage, { meta } from "./shifts";

afterEach(() => {
  clearAuthToken();
  vi.unstubAllGlobals();
});

function renderShiftsPage({
  roles = [Role.Controller],
  shifts,
}: {
  roles?: Role[];
  shifts?: Parameters<typeof stubShiftsFetch>[1];
} = {}) {
  setAuthToken("test-google-id-token");
  vi.stubGlobal("fetch", stubShiftsFetch({ ...mockAuthUser, roles }, shifts));

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

async function waitForShiftsLoaded() {
  await waitFor(() => {
    expect(screen.getByText("Mike Davies")).toBeInTheDocument();
  });
}

async function logOffMike(
  user: ReturnType<typeof userEvent.setup>,
  faults: string,
) {
  await user.click(screen.getByRole("button", { name: "Log off" }));
  await user.type(screen.getByLabelText("End mileage"), "9950");
  if (faults) await user.type(screen.getByLabelText(/Faults/), faults);
  const dialog = await screen.findByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name: "Log off" }));
  await waitFor(() => {
    expect(screen.getByText("0 on duty")).toBeInTheDocument();
  });
}

async function logOnSarahToBike(
  user: ReturnType<typeof userEvent.setup>,
  registration: string,
) {
  await user.click(screen.getByRole("button", { name: "Log on rider" }));
  await user.click(screen.getByRole("combobox", { name: "Rider" }));
  await user.click(await screen.findByRole("option", { name: "Sarah Jones" }));
  await user.click(screen.getByRole("combobox", { name: "Bike" }));
  await user.click(await screen.findByRole("option", { name: registration }));
}

describe("ShiftsPage", () => {
  it("exports page meta", () => {
    expect(meta({} as Parameters<typeof meta>[0])).toEqual([
      { title: "Shifts — Plasma Controller" },
    ]);
  });

  it("renders the page heading and the currently active shift", async () => {
    renderShiftsPage();
    await waitForShiftsLoaded();
    expect(screen.getByText("CF34 DEF")).toBeInTheDocument();
    expect(screen.getByText("1 on duty")).toBeInTheDocument();
  });

  it("shows the shift type badge next to On duty when the shift has one", async () => {
    renderShiftsPage({
      shifts: [{ ...mockMikeShift, shiftType: "Milk" }],
    });
    await waitForShiftsLoaded();

    const badge = screen.getByText("Milk");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("Shift type: Milk");
    expect(screen.getByText("On duty")).toBeInTheDocument();
  });

  it("shows no shift type badge when the shift type is null, missing or blank", async () => {
    renderShiftsPage({
      shifts: [
        { ...mockMikeShift, shiftType: null },
        { ...mockSarahBikelessShift, shiftType: "  " },
      ],
    });
    await waitForShiftsLoaded();

    expect(screen.getAllByText("On duty")).toHaveLength(2);
    expect(screen.queryByText(/Shift type/)).not.toBeInTheDocument();
  });

  it("lets a coordinator log on a rider with a bike and mileage", async () => {
    const user = userEvent.setup();
    renderShiftsPage();
    await waitForShiftsLoaded();

    await user.click(screen.getByRole("button", { name: "Log on rider" }));

    await user.click(screen.getByRole("combobox", { name: "Rider" }));
    await user.click(
      await screen.findByRole("option", { name: "Sarah Jones" }),
    );

    await user.click(screen.getByRole("combobox", { name: "Bike" }));
    await user.click(await screen.findByRole("option", { name: "CF12 ABC" }));

    expect(screen.getByLabelText("Start mileage")).toHaveValue(15234);

    const logOnButton = screen.getByRole("button", { name: "Log on" });
    expect(logOnButton).toBeEnabled();
    await user.click(logOnButton);

    await waitFor(() => {
      expect(screen.getByText("2 on duty")).toBeInTheDocument();
    });
    expect(screen.getByText("Sarah Jones")).toBeInTheDocument();
  });

  it("logs a rider on with only a rider chosen and shows no bike assigned", async () => {
    const user = userEvent.setup();
    renderShiftsPage();
    await waitForShiftsLoaded();

    await user.click(screen.getByRole("button", { name: "Log on rider" }));

    await user.click(screen.getByRole("combobox", { name: "Rider" }));
    await user.click(
      await screen.findByRole("option", { name: "Sarah Jones" }),
    );

    const logOnButton = screen.getByRole("button", { name: "Log on" });
    expect(logOnButton).toBeEnabled();
    await user.click(logOnButton);

    await waitFor(() => {
      expect(screen.getByText("2 on duty")).toBeInTheDocument();
    });
    expect(screen.getByText("Sarah Jones")).toBeInTheDocument();
    expect(screen.getByText("No bike assigned")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Assign bike" }),
    ).toBeInTheDocument();
  });

  it("shows Assign bike only on a shift with no bike", async () => {
    renderShiftsPage({ shifts: [mockMikeShift, mockSarahBikelessShift] });
    await waitForShiftsLoaded();

    expect(screen.getAllByRole("button", { name: "Assign bike" })).toHaveLength(
      1,
    );
    expect(screen.getByText("No bike assigned")).toBeInTheDocument();
    expect(screen.getByText("CF34 DEF")).toBeInTheDocument();
  });

  it("assigns a bike later, prefilling its mileage and updating the card", async () => {
    const user = userEvent.setup();
    renderShiftsPage({ shifts: [mockMikeShift, mockSarahBikelessShift] });
    await waitForShiftsLoaded();

    await user.click(screen.getByRole("button", { name: "Assign bike" }));

    const dialog = await screen.findByRole("dialog");
    const bike = within(dialog).getByRole("combobox", { name: "Bike" });
    await user.click(bike);
    const names = (await screen.findAllByRole("option")).map(
      (option) => option.textContent,
    );
    // Only bikes from Sarah's area (E) that are not already on a shift.
    expect(names).toEqual(["CF12 ABC"]);

    await user.type(bike, "12");
    await user.click(await screen.findByRole("option", { name: "CF12 ABC" }));
    expect(within(dialog).getByLabelText("Start mileage")).toHaveValue(15234);

    await user.click(
      within(dialog).getByRole("button", { name: "Assign bike" }),
    );

    await waitFor(() => {
      expect(screen.queryByText("No bike assigned")).not.toBeInTheDocument();
    });
    expect(screen.getByText("CF12 ABC")).toBeInTheDocument();
    expect(screen.getByText("Start mileage: 15234")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Assign bike" }),
    ).not.toBeInTheDocument();
  });

  it("logs off a rider with no bike without asking for mileage", async () => {
    const user = userEvent.setup();
    renderShiftsPage({ shifts: [mockSarahBikelessShift] });
    await waitFor(() => {
      expect(screen.getByText("Sarah Jones")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Log off" }));
    expect(screen.queryByLabelText("End mileage")).not.toBeInTheDocument();

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Log off" }));

    await waitFor(() => {
      expect(screen.getByText("0 on duty")).toBeInTheDocument();
    });
  });

  it("requires a reason when start mileage does not match the bike's last recorded mileage", async () => {
    const user = userEvent.setup();
    renderShiftsPage();
    await waitForShiftsLoaded();

    await user.click(screen.getByRole("button", { name: "Log on rider" }));

    await user.click(screen.getByRole("combobox", { name: "Rider" }));
    await user.click(
      await screen.findByRole("option", { name: "Sarah Jones" }),
    );

    await user.click(screen.getByRole("combobox", { name: "Bike" }));
    await user.click(await screen.findByRole("option", { name: "CF12 ABC" }));

    const mileageInput = screen.getByLabelText("Start mileage");
    await user.clear(mileageInput);
    await user.type(mileageInput, "16000");

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
    await waitForShiftsLoaded();

    await user.click(screen.getByRole("button", { name: "Log on rider" }));

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

  it("only offers bikes from the selected rider's areas", async () => {
    const user = userEvent.setup();
    renderShiftsPage();
    await waitForShiftsLoaded();

    await user.click(screen.getByRole("button", { name: "Log on rider" }));

    await user.click(screen.getByRole("combobox", { name: "Rider" }));
    await user.click(
      await screen.findByRole("option", { name: "Sarah Jones" }),
    );

    await user.click(screen.getByRole("combobox", { name: "Bike" }));
    expect(
      await screen.findByRole("option", { name: "CF12 ABC" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "CF56 GHI" }),
    ).not.toBeInTheDocument();
  });

  it("offers a multi-area rider the bikes from each of their areas", async () => {
    const user = userEvent.setup();
    renderShiftsPage();
    await waitForShiftsLoaded();

    await user.click(screen.getByRole("button", { name: "Log on rider" }));

    await user.click(screen.getByRole("combobox", { name: "Rider" }));
    await user.click(
      await screen.findByRole("option", { name: "Emma Williams" }),
    );

    await user.click(screen.getByRole("combobox", { name: "Bike" }));
    expect(
      await screen.findByRole("option", { name: "CF12 ABC" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "CF56 GHI" }),
    ).toBeInTheDocument();
  });

  it("explains that a rider with no area role cannot be given a bike", async () => {
    const user = userEvent.setup();
    renderShiftsPage();
    await waitForShiftsLoaded();

    await user.click(screen.getByRole("button", { name: "Log on rider" }));

    await user.click(screen.getByRole("combobox", { name: "Rider" }));
    await user.click(
      await screen.findByRole("option", { name: "Priya Patel" }),
    );

    expect(screen.getByRole("combobox", { name: "Bike" })).toBeDisabled();
    expect(
      screen.getByText(
        "This rider has no area role in Three Rings, so no bike can be assigned.",
      ),
    ).toBeInTheDocument();
  });

  it("lets a coordinator log off a rider and updates the bike mileage", async () => {
    const user = userEvent.setup();
    renderShiftsPage();
    await waitForShiftsLoaded();

    await user.click(screen.getByRole("button", { name: "Log off" }));

    await user.type(screen.getByLabelText("End mileage"), "9950");
    await user.click(screen.getByRole("button", { name: "Log off" }));

    await waitFor(() => {
      expect(screen.getByText("0 on duty")).toBeInTheDocument();
    });
    expect(
      screen.getByText("No riders are currently on shift."),
    ).toBeInTheDocument();
  });

  it("shows the faults left at log off when the next rider is logged on to that bike", async () => {
    const user = userEvent.setup();
    renderShiftsPage();
    await waitForShiftsLoaded();

    await logOffMike(user, "Rear brake feels soft");

    await logOnSarahToBike(user, "CF34 DEF");
    expect(screen.getByTestId("last-shift-note")).toHaveTextContent(
      "Rear brake feels soft",
    );
  });

  it("stops showing the note once the next rider logs off with no faults", async () => {
    const user = userEvent.setup();
    renderShiftsPage();
    await waitForShiftsLoaded();

    await logOffMike(user, "Rear brake feels soft");
    await logOnSarahToBike(user, "CF34 DEF");
    expect(screen.getByTestId("last-shift-note")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Log on" }));
    await waitFor(() => {
      expect(screen.getByText("1 on duty")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Log off" }));
    await user.type(screen.getByLabelText("End mileage"), "10020");
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Log off" }));
    await waitFor(() => {
      expect(screen.getByText("0 on duty")).toBeInTheDocument();
    });

    await logOnSarahToBike(user, "CF34 DEF");
    expect(screen.queryByTestId("last-shift-note")).not.toBeInTheDocument();
  });

  it("rejects an end mileage lower than the start mileage", async () => {
    const user = userEvent.setup();
    renderShiftsPage();
    await waitForShiftsLoaded();

    await user.click(screen.getByRole("button", { name: "Log off" }));

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
    await waitForShiftsLoaded();

    expect(
      screen.queryByRole("button", { name: "Log on rider" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Log off" }),
    ).not.toBeInTheDocument();
  });
});
