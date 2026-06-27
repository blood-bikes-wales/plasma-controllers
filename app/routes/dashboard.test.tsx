import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DashboardPage, { meta } from "./dashboard";

describe("DashboardPage", () => {
  it("exports page meta", () => {
    expect(meta({} as Parameters<typeof meta>[0])).toEqual([
      { title: "Dashboard — Plasma Controller" },
    ]);
  });

  it("renders the dashboard heading", () => {
    render(<DashboardPage />);

    expect(
      screen.getByRole("heading", { name: "Dashboard", level: 1 }),
    ).toBeInTheDocument();
  });

  it("renders welcome copy", () => {
    render(<DashboardPage />);

    expect(
      screen.getByText(
        "Welcome to Plasma Controller. Authentication will gate this page in a future update.",
      ),
    ).toBeInTheDocument();
  });

  it("uses the dashboard content layout", () => {
    render(<DashboardPage />);

    const heading = screen.getByRole("heading", { name: "Dashboard" });
    expect(heading.closest(".max-w-2xl")).not.toBeNull();
  });
});
