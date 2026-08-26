import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LogoffShiftDrawer } from "./logoff-shift-drawer";

const SHIFT = {
  id: "sh1",
  riderName: "Mike Davies",
  bikeRegistration: "CF34 DEF",
  startMileage: 9820,
  startedAt: "Today, 08:15",
};

describe("LogoffShiftDrawer", () => {
  it("renders the shift summary when open", () => {
    render(
      <LogoffShiftDrawer
        open
        onOpenChange={() => {}}
        shift={SHIFT}
        onLogoff={() => {}}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Log off rider", level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Mike Davies", { exact: false }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("End mileage")).toBeInTheDocument();
  });

  it("disables Log off until a valid end mileage is entered", async () => {
    const user = userEvent.setup();
    render(
      <LogoffShiftDrawer
        open
        onOpenChange={() => {}}
        shift={SHIFT}
        onLogoff={() => {}}
      />,
    );

    const submitButton = screen.getByRole("button", { name: "Log off" });
    expect(submitButton).toBeDisabled();

    await user.type(screen.getByLabelText("End mileage"), "9950");
    expect(submitButton).toBeEnabled();
  });

  it("rejects an end mileage lower than the start mileage", async () => {
    const user = userEvent.setup();
    render(
      <LogoffShiftDrawer
        open
        onOpenChange={() => {}}
        shift={SHIFT}
        onLogoff={() => {}}
      />,
    );

    await user.type(screen.getByLabelText("End mileage"), "100");

    expect(
      screen.getByText(/cannot be lower than the start mileage/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log off" })).toBeDisabled();
  });

  it("submits the end mileage and optional faults", async () => {
    const user = userEvent.setup();
    const onLogoff = vi.fn();
    render(
      <LogoffShiftDrawer
        open
        onOpenChange={() => {}}
        shift={SHIFT}
        onLogoff={onLogoff}
      />,
    );

    await user.type(screen.getByLabelText("End mileage"), "9950");
    await user.type(screen.getByLabelText(/Faults/), "Rear brake feels soft");
    await user.click(screen.getByRole("button", { name: "Log off" }));

    expect(onLogoff).toHaveBeenCalledWith("sh1", {
      endMileage: 9950,
      faults: "Rear brake feels soft",
    });
  });

  it("submits without faults when left blank", async () => {
    const user = userEvent.setup();
    const onLogoff = vi.fn();
    render(
      <LogoffShiftDrawer
        open
        onOpenChange={() => {}}
        shift={SHIFT}
        onLogoff={onLogoff}
      />,
    );

    await user.type(screen.getByLabelText("End mileage"), "9950");
    await user.click(screen.getByRole("button", { name: "Log off" }));

    expect(onLogoff).toHaveBeenCalledWith("sh1", {
      endMileage: 9950,
      faults: undefined,
    });
  });

  it("calls onOpenChange when cancelled", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <LogoffShiftDrawer
        open
        onOpenChange={onOpenChange}
        shift={SHIFT}
        onLogoff={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("resets the form when closed and reopened", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <LogoffShiftDrawer
        open
        onOpenChange={() => {}}
        shift={SHIFT}
        onLogoff={() => {}}
      />,
    );

    await user.type(screen.getByLabelText("End mileage"), "9950");

    rerender(
      <LogoffShiftDrawer
        open={false}
        onOpenChange={() => {}}
        shift={SHIFT}
        onLogoff={() => {}}
      />,
    );
    rerender(
      <LogoffShiftDrawer
        open
        onOpenChange={() => {}}
        shift={SHIFT}
        onLogoff={() => {}}
      />,
    );

    expect(screen.getByLabelText("End mileage")).toHaveValue(null);
    expect(screen.getByRole("button", { name: "Log off" })).toBeDisabled();
  });
});
