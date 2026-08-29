import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { mockAuthUser } from "../../tests/auth-fixtures";
import { renderWithRouter } from "../../tests/test-utils";
import NoAccessPage, { meta } from "./no-access";

describe("NoAccessPage", () => {
  it("exports page meta", () => {
    expect(meta({} as Parameters<typeof meta>[0])).toEqual([
      { title: "No access — Plasma Controller" },
    ]);
  });

  it("explains the missing role and signs the user out", async () => {
    const user = userEvent.setup();
    const { router } = renderWithRouter(
      [
        { path: "no-access", Component: NoAccessPage },
        { path: "login", element: <div>Login page</div> },
      ],
      "/no-access",
      {
        authenticated: true,
        user: { ...mockAuthUser, roles: [] },
      },
    );

    expect(
      await screen.findByRole("heading", {
        name: "You don’t have access to Plasma",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/does not have a Plasma role/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/login");
    });
  });
});
