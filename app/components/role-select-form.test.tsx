import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RoleSelectForm } from "~/components/role-select-form";
import { Role } from "~/lib/roles";

describe("RoleSelectForm", () => {
  it("lists the offered roles and continues with the selection", async () => {
    const user = userEvent.setup();
    const onSelectedChange = vi.fn();
    const onContinue = vi.fn();

    render(
      <RoleSelectForm
        roles={[Role.Controller, Role.Trustee]}
        selected={Role.Controller}
        onSelectedChange={onSelectedChange}
        onContinue={onContinue}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Choose your role" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Controller" })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: "Trustee" }));
    expect(onSelectedChange).toHaveBeenCalledWith(Role.Trustee);

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(onContinue).toHaveBeenCalled();
  });

  it("disables continue until a role is selected", () => {
    render(
      <RoleSelectForm
        roles={[Role.Controller, Role.Trustee]}
        selected={null}
        onSelectedChange={vi.fn()}
        onContinue={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });
});
