import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BikeFormDrawer } from "~/components/bike-form-drawer";
import type { FleetBike } from "~/lib/bikes";

import { mockFleetBikes } from "../../tests/bike-fixtures";

describe("BikeFormDrawer", () => {
  it("shows validation errors without calling the API", async () => {
    const user = userEvent.setup();
    const createBikeFn = vi.fn();

    render(
      <BikeFormDrawer
        mode="create"
        open
        onOpenChange={() => undefined}
        createBikeFn={createBikeFn}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add bike" }));

    expect(
      await screen.findByText("Enter the registration"),
    ).toBeInTheDocument();
    expect(createBikeFn).not.toHaveBeenCalled();
  });

  it("creates a bike when the form is valid", async () => {
    const user = userEvent.setup();
    const saved: FleetBike = mockFleetBikes[0];
    const createBikeFn = vi.fn(async () => saved);
    const onSaved = vi.fn();

    render(
      <BikeFormDrawer
        mode="create"
        open
        onOpenChange={() => undefined}
        onSaved={onSaved}
        createBikeFn={createBikeFn}
      />,
    );

    await user.type(screen.getByLabelText("Registration"), "CF12 ABC");
    await user.type(screen.getByLabelText("Starting mileage"), "12000");
    await user.click(screen.getByRole("button", { name: "Add bike" }));

    await waitFor(() => {
      expect(createBikeFn).toHaveBeenCalledWith({
        registration: "CF12 ABC",
        area: "South",
        lastRecordedMileage: 12000,
        purchasedAt: undefined,
      });
    });
    expect(onSaved).toHaveBeenCalledWith(saved);
  });
});
