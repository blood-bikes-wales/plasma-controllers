import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LogonShiftDrawer } from "./logon-shift-drawer";

const RIDERS = [
  { id: "r1", name: "Sarah Jones" },
  { id: "r3", name: "Emma Williams" },
];

const BIKES = [
  { id: "bk1", registration: "CF12 ABC", lastRecordedMileage: 15234 },
  { id: "bk3", registration: "CF56 GHI", lastRecordedMileage: 22110 },
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
    expect(submitButton).toBeDisabled();

    await selectOption(user, "Bike", "CF12 ABC");
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
