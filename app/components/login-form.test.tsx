import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { LoginForm } from "~/components/login-form";

function renderLoginForm(initialEntry = "/") {
  const router = createMemoryRouter(
    [
      { path: "/", element: <LoginForm /> },
      { path: "/jobs", element: <div>Jobs page</div> },
    ],
    { initialEntries: [initialEntry] },
  );

  return {
    router,
    user: userEvent.setup(),
    ...render(<RouterProvider router={router} />),
  };
}

describe("LoginForm", () => {
  it("renders sign-in heading and Google button", () => {
    renderLoginForm();

    expect(
      screen.getByRole("heading", { name: "Sign in to Plasma Controller" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Login with Google" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Controllers sign in with their Google account"),
    ).toBeInTheDocument();
  });

  it("logs and navigates to jobs when Google login is clicked", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { router, user } = renderLoginForm();

    await user.click(screen.getByRole("button", { name: "Login with Google" }));

    expect(consoleSpy).toHaveBeenCalledWith("Login with Google clicked");
    expect(router.state.location.pathname).toBe("/jobs");
    expect(screen.getByText("Jobs page")).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});
