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
      bikeKeptAt: "lockup",
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
      bikeKeptAt: "lockup",
    });
  });

  it("shows the bike location as Lockup by default", () => {
    render(
      <LogoffShiftDrawer
        open
        onOpenChange={() => {}}
        shift={SHIFT}
        onLogoff={() => {}}
      />,
    );

    const bikeLocation = screen.getByRole("switch", { name: "Bike location" });
    expect(bikeLocation).not.toBeChecked();
    expect(screen.getByText("Lockup")).toBeInTheDocument();
    expect(
      screen.queryByText("Kept at home overnight"),
    ).not.toBeInTheDocument();
  });

  it("sends bikeKeptAt home when the bike is kept at home overnight", async () => {
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
    await user.click(screen.getByRole("switch", { name: "Bike location" }));
    expect(screen.getByText("Kept at home overnight")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Log off" }));

    expect(onLogoff).toHaveBeenCalledWith("sh1", {
      endMileage: 9950,
      faults: undefined,
      bikeKeptAt: "home",
    });
  });

  it("shows no explanation box and submits for a change of 499", async () => {
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

    await user.type(screen.getByLabelText("End mileage"), "10319");

    expect(screen.queryByLabelText("Reason for the mileage")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Log off" }));

    expect(onLogoff).toHaveBeenCalledWith("sh1", {
      endMileage: 10319,
      faults: undefined,
      bikeKeptAt: "lockup",
    });
  });

  it("requires an explanation for a change of 500 and sends it", async () => {
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

    await user.type(screen.getByLabelText("End mileage"), "10320");

    expect(
      screen.getByText(
        "This is a change of 500 miles over one shift. A reason is required.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log off" })).toBeDisabled();

    await user.type(screen.getByLabelText("Reason for the mileage"), "   ");
    expect(screen.getByRole("button", { name: "Log off" })).toBeDisabled();

    await user.type(
      screen.getByLabelText("Reason for the mileage"),
      "Long distance transfer",
    );
    await user.click(screen.getByRole("button", { name: "Log off" }));

    expect(onLogoff).toHaveBeenCalledWith("sh1", {
      endMileage: 10320,
      faults: undefined,
      bikeKeptAt: "lockup",
      mileageExplanation: "Long distance transfer",
    });
  });

  it("hides the explanation box and drops its text when edited back under 500", async () => {
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

    const endMileage = screen.getByLabelText("End mileage");
    await user.type(endMileage, "10320");
    await user.type(
      screen.getByLabelText("Reason for the mileage"),
      "Long distance transfer",
    );

    await user.clear(endMileage);
    await user.type(endMileage, "10319");
    expect(screen.queryByLabelText("Reason for the mileage")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Log off" }));
    expect(onLogoff).toHaveBeenCalledWith("sh1", {
      endMileage: 10319,
      faults: undefined,
      bikeKeptAt: "lockup",
    });

    await user.clear(endMileage);
    await user.type(endMileage, "10320");
    expect(screen.getByLabelText("Reason for the mileage")).toHaveValue("");
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
    await user.click(screen.getByRole("switch", { name: "Bike location" }));
    expect(screen.getByRole("switch", { name: "Bike location" })).toBeChecked();

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
    expect(
      screen.getByRole("switch", { name: "Bike location" }),
    ).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Log off" })).toBeDisabled();
  });
});
