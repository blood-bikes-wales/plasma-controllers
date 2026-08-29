import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Role } from "~/lib/roles";

import { mockAuthUser } from "../../tests/auth-fixtures";
import { renderWithRouter } from "../../tests/test-utils";
import SelectRolePage, { meta } from "./select-role";

describe("SelectRolePage", () => {
  it("exports page meta", () => {
    expect(meta({} as Parameters<typeof meta>[0])).toEqual([
      { title: "Choose role — Plasma Controller" },
    ]);
  });

  it("stores the chosen role and continues to jobs", async () => {
    const user = userEvent.setup();
    const { router } = renderWithRouter(
      [
        { path: "select-role", Component: SelectRolePage },
        { path: "jobs", element: <div>Jobs page</div> },
      ],
      "/select-role",
      {
        authenticated: true,
        user: {
          ...mockAuthUser,
          roles: [Role.Controller, Role.Trustee],
        },
      },
    );

    expect(
      await screen.findByRole("heading", { name: "Choose your role" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Trustee" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/jobs");
    });
    expect(screen.getByText("Jobs page")).toBeInTheDocument();
  });
});
