import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { UserMenu } from "~/components/user-menu";

async function openUserMenu(user: ReturnType<typeof userEvent.setup>) {
  const trigger = screen.getByRole("button", { name: "Open user menu" });
  await user.click(trigger);

  await waitFor(() => {
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });
}

describe("UserMenu", () => {
  it("renders the user menu trigger", () => {
    render(<UserMenu />);

    expect(
      screen.getByRole("button", { name: "Open user menu" }),
    ).toBeInTheDocument();
  });

  it("opens menu with user details and actions", async () => {
    const user = userEvent.setup();
    render(<UserMenu />);

    await openUserMenu(user);

    expect(screen.getByText("Steve Humphreys")).toBeInTheDocument();
    expect(screen.getByText("s.humphreys")).toBeInTheDocument();
    expect(screen.getByText("Trustee")).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Change Role" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Sign out" }),
    ).toBeInTheDocument();
  });

  it("logs when sign out is clicked", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const user = userEvent.setup();
    render(<UserMenu />);

    await openUserMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));

    expect(consoleSpy).toHaveBeenCalledWith("Sign out clicked");

    consoleSpy.mockRestore();
  });
});
