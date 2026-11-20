import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AssignBikeDrawer } from "./assign-bike-drawer";

const RIDER = { id: "r1", name: "Sarah Jones", areas: ["E"] };
const SHIFT = { id: "sh1", riderName: "Sarah Jones" };

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
    area: "E",
    lastRecordedMileage: 22110,
  },
];

function renderDrawer(
  overrides: Partial<Parameters<typeof AssignBikeDrawer>[0]> = {},
) {
  const onAssign = vi.fn();
  const onOpenChange = vi.fn();

  render(
    <AssignBikeDrawer
      open
      onOpenChange={onOpenChange}
      shift={SHIFT}
      rider={RIDER}
      bikes={BIKES}
      onAssign={onAssign}
      {...overrides}
    />,
  );

  return { onAssign, onOpenChange };
}

describe("AssignBikeDrawer", () => {
  it("renders the form with the rider's name and no mileage until a bike is chosen", () => {
    renderDrawer();

    expect(
      screen.getByRole("heading", { name: "Assign bike", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Sarah Jones/)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Bike" })).toBeEnabled();
    expect(screen.queryByLabelText("Start mileage")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Assign bike" })).toBeDisabled();
  });

  it("filters bikes by typed registration and only offers the rider's areas", async () => {
    const user = userEvent.setup();
    renderDrawer();

    const bike = screen.getByRole("combobox", { name: "Bike" });
    await user.click(bike);
    expect(
      (await screen.findAllByRole("option")).map(
        (option) => option.textContent,
      ),
    ).toEqual(["CF12 ABC", "CF56 GHI"]);

    await user.type(bike, "56");
    expect(
      (await screen.findAllByRole("option")).map(
        (option) => option.textContent,
      ),
    ).toEqual(["CF56 GHI"]);
  });

  it("prefills the bike's last recorded mileage and submits it", async () => {
    const user = userEvent.setup();
    const { onAssign } = renderDrawer();

    await user.click(screen.getByRole("combobox", { name: "Bike" }));
    await user.click(await screen.findByRole("option", { name: "CF12 ABC" }));

    expect(screen.getByLabelText("Start mileage")).toHaveValue(15234);

    await user.click(screen.getByRole("button", { name: "Assign bike" }));

    expect(onAssign).toHaveBeenCalledWith("sh1", {
      bikeId: "bk1",
      bikeRegistration: "CF12 ABC",
      startMileage: 15234,
      mileageVarianceReason: undefined,
    });
  });

  it("requires a reason when the start mileage differs from the bike's last recorded mileage", async () => {
    const user = userEvent.setup();
    const { onAssign } = renderDrawer();

    await user.click(screen.getByRole("combobox", { name: "Bike" }));
    await user.click(await screen.findByRole("option", { name: "CF12 ABC" }));

    const mileage = screen.getByLabelText("Start mileage");
    await user.clear(mileage);
    await user.type(mileage, "16000");

    const submit = screen.getByRole("button", { name: "Assign bike" });
    expect(submit).toBeDisabled();
    expect(
      screen.getByText(/does not match this bike's last recorded mileage/i),
    ).toBeInTheDocument();

    await user.type(
      screen.getByLabelText("Reason for the mileage difference"),
      "Odometer reset",
    );
    expect(submit).toBeEnabled();

    await user.click(submit);
    expect(onAssign).toHaveBeenCalledWith("sh1", {
      bikeId: "bk1",
      bikeRegistration: "CF12 ABC",
      startMileage: 16000,
      mileageVarianceReason: "Odometer reset",
    });
  });

  it("explains when the rider has no area role", () => {
    renderDrawer({ rider: { ...RIDER, areas: [] } });

    expect(screen.getByRole("combobox", { name: "Bike" })).toBeDisabled();
    expect(
      screen.getByText(
        "This rider has no area role in Three Rings, so no bike can be assigned.",
      ),
    ).toBeInTheDocument();
  });

  it("calls onOpenChange when cancelled", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDrawer();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("resets the form when closed and reopened", async () => {
    const user = userEvent.setup();
    const props = {
      onOpenChange: () => {},
      shift: SHIFT,
      rider: RIDER,
      bikes: BIKES,
      onAssign: () => {},
    };
    const { rerender } = render(<AssignBikeDrawer open {...props} />);

    await user.click(screen.getByRole("combobox", { name: "Bike" }));
    await user.click(await screen.findByRole("option", { name: "CF12 ABC" }));
    expect(screen.getByLabelText("Start mileage")).toHaveValue(15234);

    rerender(<AssignBikeDrawer open={false} {...props} />);
    rerender(<AssignBikeDrawer open {...props} />);

    expect(screen.queryByLabelText("Start mileage")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Assign bike" })).toBeDisabled();
  });
});
