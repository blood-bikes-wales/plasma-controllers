import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LogonShiftDrawer } from "./logon-shift-drawer";

const RIDERS = [
  { id: "r1", name: "Sarah Jones", areas: ["E"] },
  { id: "r2", name: "Emma Williams", areas: ["E", "C"] },
  { id: "r3", name: "Mark Evans", areas: ["S"] },
  { id: "r4", name: "Priya Patel", areas: [] },
];

const BIKES = [
  {
    id: "bk1",
    registration: "CF12 ABC",
    area: "E",
    lastRecordedMileage: 15234,
  },
  { id: "bk2", registration: "CF34 DEF", area: "C", lastRecordedMileage: 9820 },
  {
    id: "bk3",
    registration: "CF56 GHI",
    area: "S",
    lastRecordedMileage: 22110,
  },
  { id: "bk4", registration: "CF78 JKL", lastRecordedMileage: 4000 },
];

function renderDrawer(
  overrides: Partial<Parameters<typeof LogonShiftDrawer>[0]> = {},
) {
  const onLogon = vi.fn();
  const onOpenChange = vi.fn();

  render(
    <LogonShiftDrawer
      open
      onOpenChange={onOpenChange}
      riders={RIDERS}
      bikes={BIKES}
      onLogon={onLogon}
      {...overrides}
    />,
  );

  return { onLogon, onOpenChange };
}

async function selectOption(
  user: ReturnType<typeof userEvent.setup>,
  triggerName: string,
  optionName: string,
) {
  await user.click(screen.getByRole("combobox", { name: triggerName }));
  await user.click(await screen.findByRole("option", { name: optionName }));
}

describe("LogonShiftDrawer", () => {
  it("renders the logon form when open", () => {
    renderDrawer();

    expect(
      screen.getByRole("heading", { name: "Log on rider", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Rider")).toBeInTheDocument();
    expect(screen.getByLabelText("Bike")).toBeInTheDocument();
    expect(screen.getByLabelText("Start mileage")).toBeInTheDocument();
  });

  it("disables Log on until rider, bike and start mileage are set", async () => {
    const user = userEvent.setup();
    renderDrawer();

    const submitButton = screen.getByRole("button", { name: "Log on" });
    expect(submitButton).toBeDisabled();

    await selectOption(user, "Rider", "Sarah Jones");
    expect(screen.getByDisplayValue("Sarah Jones")).toBeInTheDocument();
    expect(submitButton).toBeDisabled();

    await selectOption(user, "Bike", "CF12 ABC");
    expect(screen.getByDisplayValue("CF12 ABC")).toBeInTheDocument();
    expect(submitButton).toBeDisabled();

    await user.type(screen.getByLabelText("Start mileage"), "15234");
    expect(submitButton).toBeEnabled();
  });

  it("submits the logon details for a matching start mileage", async () => {
    const user = userEvent.setup();
    const { onLogon } = renderDrawer();

    await selectOption(user, "Rider", "Sarah Jones");
    await selectOption(user, "Bike", "CF12 ABC");
    await user.type(screen.getByLabelText("Start mileage"), "15234");
    await user.click(screen.getByRole("button", { name: "Log on" }));

    expect(onLogon).toHaveBeenCalledWith({
      riderId: "r1",
      riderName: "Sarah Jones",
      bikeId: "bk1",
      bikeRegistration: "CF12 ABC",
      startMileage: 15234,
      mileageVarianceReason: undefined,
    });
  });

  it("requires a reason when the start mileage does not match the bike's last recorded mileage", async () => {
    const user = userEvent.setup();
    const { onLogon } = renderDrawer();

    await selectOption(user, "Rider", "Sarah Jones");
    await selectOption(user, "Bike", "CF12 ABC");
    await user.type(screen.getByLabelText("Start mileage"), "16000");

    expect(
      screen.getByText(/does not match this bike's last recorded mileage/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log on" })).toBeDisabled();

    await user.type(
      screen.getByLabelText("Reason for the mileage difference"),
      "Odometer reset after a repair",
    );
    const submitButton = screen.getByRole("button", { name: "Log on" });
    expect(submitButton).toBeEnabled();

    await user.click(submitButton);
    expect(onLogon).toHaveBeenCalledWith({
      riderId: "r1",
      riderName: "Sarah Jones",
      bikeId: "bk1",
      bikeRegistration: "CF12 ABC",
      startMileage: 16000,
      mileageVarianceReason: "Odometer reset after a repair",
    });
  });

  describe("bikes in the rider's area", () => {
    async function bikeOptionNames(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole("combobox", { name: "Bike" }));
      const options = await screen.findAllByRole("option");
      return options.map((option) => option.textContent);
    }

    it("asks for a rider before offering any bikes", () => {
      renderDrawer();

      expect(screen.getByRole("combobox", { name: "Bike" })).toBeDisabled();
      expect(
        screen.getByText("Select a rider to see the bikes in their area."),
      ).toBeInTheDocument();
    });

    it("lists only bikes from the rider's area", async () => {
      const user = userEvent.setup();
      renderDrawer();

      await selectOption(user, "Rider", "Sarah Jones");

      expect(await bikeOptionNames(user)).toEqual(["CF12 ABC"]);
    });

    it("lists bikes from every area a multi-area rider covers", async () => {
      const user = userEvent.setup();
      renderDrawer();

      await selectOption(user, "Rider", "Emma Williams");

      expect(await bikeOptionNames(user)).toEqual(["CF12 ABC", "CF34 DEF"]);
    });

    it("never offers a bike with no area", async () => {
      const user = userEvent.setup();
      renderDrawer();

      await selectOption(user, "Rider", "Emma Williams");

      expect(await bikeOptionNames(user)).not.toContain("CF78 JKL");
    });

    it("clears a chosen bike when the rider changes to one who does not cover its area", async () => {
      const user = userEvent.setup();
      renderDrawer();

      await selectOption(user, "Rider", "Sarah Jones");
      await selectOption(user, "Bike", "CF12 ABC");
      expect(screen.getByDisplayValue("CF12 ABC")).toBeInTheDocument();

      await user.click(screen.getAllByRole("button", { name: "Change" })[0]);
      await selectOption(user, "Rider", "Mark Evans");

      expect(screen.queryByDisplayValue("CF12 ABC")).not.toBeInTheDocument();
      expect(await bikeOptionNames(user)).toEqual(["CF56 GHI"]);
    });

    it("keeps a chosen bike when the new rider also covers its area", async () => {
      const user = userEvent.setup();
      renderDrawer();

      await selectOption(user, "Rider", "Sarah Jones");
      await selectOption(user, "Bike", "CF12 ABC");

      await user.click(screen.getAllByRole("button", { name: "Change" })[0]);
      await selectOption(user, "Rider", "Emma Williams");

      expect(screen.getByDisplayValue("CF12 ABC")).toBeInTheDocument();
    });

    it("offers no bikes and explains why when the rider has no area role", async () => {
      const user = userEvent.setup();
      renderDrawer();

      await selectOption(user, "Rider", "Priya Patel");

      expect(screen.getByRole("combobox", { name: "Bike" })).toBeDisabled();
      expect(
        screen.getByText(
          "This rider has no area role in Three Rings, so no bike can be assigned.",
        ),
      ).toBeInTheDocument();
    });

    it("says so when every bike in the rider's area is already on shift", async () => {
      const user = userEvent.setup();
      renderDrawer({ bikes: BIKES.filter((bike) => bike.area !== "E") });

      await selectOption(user, "Rider", "Sarah Jones");

      expect(
        screen.getByText("No bikes are available in this rider's area."),
      ).toBeInTheDocument();
    });
  });

  it("calls onOpenChange when cancelled", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDrawer();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("resets the form when closed and reopened", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <LogonShiftDrawer
        open
        onOpenChange={() => {}}
        riders={RIDERS}
        bikes={BIKES}
        onLogon={() => {}}
      />,
    );

    await selectOption(user, "Rider", "Sarah Jones");
    await user.type(screen.getByLabelText("Start mileage"), "15234");

    rerender(
      <LogonShiftDrawer
        open={false}
        onOpenChange={() => {}}
        riders={RIDERS}
        bikes={BIKES}
        onLogon={() => {}}
      />,
    );
    rerender(
      <LogonShiftDrawer
        open
        onOpenChange={() => {}}
        riders={RIDERS}
        bikes={BIKES}
        onLogon={() => {}}
      />,
    );

    expect(screen.getByLabelText("Start mileage")).toHaveValue(null);
    expect(screen.getByRole("button", { name: "Log on" })).toBeDisabled();
  });
});
