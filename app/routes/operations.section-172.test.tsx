import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import OperationsSection172Page, { meta } from "./operations.section-172";

describe("OperationsSection172Page", () => {
  it("exports page meta", () => {
    expect(meta({} as Parameters<typeof meta>[0])).toEqual([
      { title: "Section 172 — Plasma Controller" },
    ]);
  });

  it("renders the search form", () => {
    render(<OperationsSection172Page />);

    expect(
      screen.getByRole("heading", { name: "Section 172" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Registration")).toBeInTheDocument();
    expect(screen.getByLabelText("Date and time")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Find rider" }),
    ).toBeInTheDocument();
  });

  it("shows a matched rider from the fixture lookup", async () => {
    const user = userEvent.setup();
    render(<OperationsSection172Page />);

    await user.type(screen.getByLabelText("Registration"), "CF14 ABC");
    await user.type(screen.getByLabelText("Date and time"), "2026-03-10T14:30");
    await user.click(screen.getByRole("button", { name: "Find rider" }));

    expect(
      await screen.findByText(
        /Ian Davis \(membership 100001\) was riding during the time the Section 172 mentions/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Membership 100001")).toBeInTheDocument();
    expect(
      screen.getByText("On shift 10 Mar 2026, 08:00 – 16:00"),
    ).toBeInTheDocument();
  });

  it("shows a no-match message when nothing covers the time", async () => {
    const user = userEvent.setup();
    render(<OperationsSection172Page />);

    await user.type(screen.getByLabelText("Registration"), "CF14 ABC");
    await user.type(screen.getByLabelText("Date and time"), "2026-03-10T20:00");
    await user.click(screen.getByRole("button", { name: "Find rider" }));

    expect(
      await screen.findByText(
        "No rider was logged against that registration at the time given.",
      ),
    ).toBeInTheDocument();
  });

  it("shows ambiguous matches with distinct membership numbers", async () => {
    const user = userEvent.setup();
    render(<OperationsSection172Page />);

    await user.type(screen.getByLabelText("Registration"), "LL57 XYZ");
    await user.type(screen.getByLabelText("Date and time"), "2026-03-12T09:15");
    await user.click(screen.getByRole("button", { name: "Find rider" }));

    expect(
      await screen.findByText(
        /More than one rider matches this registration and time/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Membership 100001")).toBeInTheDocument();
    expect(screen.getByText("Membership 100842")).toBeInTheDocument();
  });
});
