import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NewJobDrawer } from "./new-job-drawer";

describe("NewJobDrawer", () => {
  it("renders the intake form when open", () => {
    render(<NewJobDrawer open onOpenChange={() => {}} />);

    expect(
      screen.getByRole("heading", { name: "New Job", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Caller name")).toBeInTheDocument();
    expect(screen.getByLabelText("Contact number")).toBeInTheDocument();
    expect(screen.getByLabelText("Pickup location")).toBeInTheDocument();
    expect(screen.getByLabelText("Delivery location")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Item or contents description"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Extra instructions")).toBeInTheDocument();
  });

  it("renders the is urgent toggle", () => {
    render(<NewJobDrawer open onOpenChange={() => {}} />);

    expect(
      screen.getByRole("switch", { name: "Is urgent" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Standard delivery window")).toBeInTheDocument();
  });

  it("updates helper text when is urgent is toggled on", async () => {
    const user = userEvent.setup();
    render(<NewJobDrawer open onOpenChange={() => {}} />);

    await user.click(screen.getByRole("switch", { name: "Is urgent" }));

    expect(screen.getByText("Priority dispatch required")).toBeInTheDocument();
  });

  it("renders footer actions", () => {
    render(<NewJobDrawer open onOpenChange={() => {}} />);

    expect(
      screen.getByRole("button", { name: "Continue to assign" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("calls onOpenChange when cancel is clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(<NewJobDrawer open onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("resets form fields when closed and reopened", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    const { rerender } = render(
      <NewJobDrawer open onOpenChange={onOpenChange} />,
    );

    await user.type(screen.getByLabelText("Caller name"), "Dr. Smith");
    rerender(<NewJobDrawer open={false} onOpenChange={onOpenChange} />);
    rerender(<NewJobDrawer open onOpenChange={onOpenChange} />);

    expect(screen.getByLabelText("Caller name")).toHaveValue("");
  });

  it("does not render content when closed", () => {
    render(<NewJobDrawer open={false} onOpenChange={() => {}} />);

    expect(
      screen.queryByRole("heading", { name: "New Job" }),
    ).not.toBeInTheDocument();
  });

  it("blocks continuing and shows inline errors when required fields are empty", async () => {
    const user = userEvent.setup();
    const onContinueToAssign = vi.fn();

    render(
      <NewJobDrawer
        open
        onOpenChange={() => {}}
        onContinueToAssign={onContinueToAssign}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Continue to assign" }),
    );

    expect(onContinueToAssign).not.toHaveBeenCalled();
    expect(screen.getByText("Enter the caller's name")).toBeInTheDocument();
    expect(screen.getByText("Enter a contact number")).toBeInTheDocument();
    expect(screen.getByText("Choose a pickup location")).toBeInTheDocument();
    expect(screen.getByText("Choose a delivery location")).toBeInTheDocument();
    expect(
      screen.getByText("Describe the item or contents"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Caller name")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("clears a field's error as soon as it is edited", async () => {
    const user = userEvent.setup();

    render(<NewJobDrawer open onOpenChange={() => {}} />);

    await user.click(
      screen.getByRole("button", { name: "Continue to assign" }),
    );
    expect(screen.getByText("Enter the caller's name")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Caller name"), "Dr. Smith");

    expect(
      screen.queryByText("Enter the caller's name"),
    ).not.toBeInTheDocument();
  });

  it("calls onContinueToAssign with the parsed form once every required field is valid", async () => {
    const user = userEvent.setup();
    const onContinueToAssign = vi.fn();

    render(
      <NewJobDrawer
        open
        onOpenChange={() => {}}
        onContinueToAssign={onContinueToAssign}
      />,
    );

    await user.type(screen.getByLabelText("Caller name"), "Dr. Smith");
    await user.type(screen.getByLabelText("Contact number"), "029 2074 7747");

    await user.click(screen.getByRole("combobox", { name: "Pickup location" }));
    await user.click(
      await screen.findByRole("option", { name: "Royal Glamorgan Hospital" }),
    );

    await user.click(
      screen.getByRole("combobox", { name: "Delivery location" }),
    );
    await user.click(
      await screen.findByRole("option", {
        name: "University Hospital of Wales",
      }),
    );

    await user.type(
      screen.getByLabelText("Item or contents description"),
      "Blood samples",
    );

    await user.click(
      screen.getByRole("button", { name: "Continue to assign" }),
    );

    expect(onContinueToAssign).toHaveBeenCalledWith({
      callerName: "Dr. Smith",
      contactNumber: "029 2074 7747",
      pickupLocation: "Royal Glamorgan Hospital",
      pickupWard: "",
      deliveryLocation: "University Hospital of Wales",
      deliveryWard: "",
      isUrgent: false,
      contents: "Blood samples",
      controllerNotes: "",
    });
  });
});
