import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AssignRiderDrawer } from "./assign-rider-drawer";

describe("AssignRiderDrawer", () => {
  it("renders the assign form when open", () => {
    render(<AssignRiderDrawer open onOpenChange={() => {}} />);

    expect(
      screen.getByRole("heading", { name: "Assign rider", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText("JB-1043")).toBeInTheDocument();
    expect(screen.getByText("Available riders")).toBeInTheDocument();
    expect(
      screen.getByText("Showing riders in South Area"),
    ).toBeInTheDocument();
  });

  it("lists area riders with status and call actions", () => {
    render(<AssignRiderDrawer open onOpenChange={() => {}} />);

    expect(
      screen.getByRole("button", { name: "Select Sarah Jones" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Select Mike Davies" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("James Price")).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Call" }).length,
    ).toBeGreaterThan(0);
  });

  it("disables confirm until a rider is selected", async () => {
    const user = userEvent.setup();
    render(<AssignRiderDrawer open onOpenChange={() => {}} />);

    const confirmButton = screen.getByRole("button", {
      name: "Confirm assignment",
    });
    expect(confirmButton).toBeDisabled();

    await user.click(
      screen.getByRole("button", { name: "Select Sarah Jones" }),
    );

    expect(confirmButton).toBeEnabled();
    expect(screen.queryByText("No rider selected")).not.toBeInTheDocument();
  });

  it("shows success state after confirming assignment", async () => {
    const user = userEvent.setup();
    render(<AssignRiderDrawer open onOpenChange={() => {}} />);

    await user.click(
      screen.getByRole("button", { name: "Select Sarah Jones" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Confirm assignment" }),
    );

    expect(
      screen.getByRole("heading", { name: "Rider assigned" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Assigned")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open job" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Back to jobs" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create another job" }),
    ).toBeInTheDocument();
  });

  it("calls onBack when back is clicked", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();

    render(<AssignRiderDrawer open onOpenChange={() => {}} onBack={onBack} />);

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(onBack).toHaveBeenCalled();
  });

  it("resets selection when closed and reopened", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <AssignRiderDrawer open onOpenChange={() => {}} />,
    );

    await user.click(
      screen.getByRole("button", { name: "Select Sarah Jones" }),
    );
    rerender(<AssignRiderDrawer open={false} onOpenChange={() => {}} />);
    rerender(<AssignRiderDrawer open onOpenChange={() => {}} />);

    expect(screen.getByText("No rider selected")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirm assignment" }),
    ).toBeDisabled();
  });
});
