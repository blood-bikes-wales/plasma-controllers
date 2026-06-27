import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import LoginPage, { meta } from "./login";

function renderLoginPage() {
  const router = createMemoryRouter(
    [
      { path: "/", Component: LoginPage },
      { path: "/jobs", Component: () => <div>Jobs</div> },
    ],
    { initialEntries: ["/"] },
  );

  return {
    router,
    user: userEvent.setup(),
    ...render(<RouterProvider router={router} />),
  };
}

describe("LoginPage", () => {
  it("exports page meta", () => {
    expect(meta({} as Parameters<typeof meta>[0])).toEqual([
      { title: "Sign in — Plasma Controller" },
    ]);
  });

  it("renders a centered login form", () => {
    renderLoginPage();

    const heading = screen.getByRole("heading", {
      name: "Sign in to Plasma Controller",
    });
    expect(heading).toBeInTheDocument();
    expect(heading.closest(".max-w-xs")).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Login with Google" }),
    ).toBeInTheDocument();
  });

  it("allows signing in through the embedded login form", async () => {
    const { router, user } = renderLoginPage();

    await user.click(screen.getByRole("button", { name: "Login with Google" }));

    expect(router.state.location.pathname).toBe("/jobs");
    expect(screen.getByText("Jobs")).toBeInTheDocument();
  });
});
