import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";

import JobsPage, { meta } from "./jobs";
import JobsNewRoute from "./jobs-new";
import JobsNewAssignRoute from "./jobs-new-assign";

function renderJobsPage(initialPath = "/jobs") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/jobs" element={<JobsPage />}>
          <Route path="new" element={<JobsNewRoute />}>
            <Route path="assign" element={<JobsNewAssignRoute />} />
          </Route>
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("JobsPage", () => {
  it("exports page meta", () => {
    expect(meta({} as Parameters<typeof meta>[0])).toEqual([
      { title: "Jobs — Plasma Controller" },
    ]);
  });

  it("renders the page heading and area badge", () => {
    renderJobsPage();

    expect(
      screen.getByRole("heading", { name: "Jobs", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText("South Area")).toBeInTheDocument();
  });

  it("renders the new job link", () => {
    renderJobsPage();

    const newJobLink = screen.getByRole("button", { name: "New Job" });
    expect(newJobLink).toHaveAttribute("href", "/jobs/new");
  });

  it("renders active job cards by default", () => {
    renderJobsPage();

    expect(screen.getByText("JB-1042")).toBeInTheDocument();
    expect(screen.getByText("JB-1038")).toBeInTheDocument();
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
    expect(screen.getAllByText("Open").length).toBeGreaterThan(0);
  });

  it("filters jobs when searching", async () => {
    const user = userEvent.setup();
    renderJobsPage();

    await user.type(
      screen.getByRole("searchbox", {
        name: /search jobs by reference or hospital/i,
      }),
      "Glamorgan",
    );

    expect(screen.getByText("JB-1042")).toBeInTheDocument();
    expect(screen.queryByText("JB-1038")).not.toBeInTheDocument();
  });

  it("switches to completed jobs when the Completed tab is active", async () => {
    const user = userEvent.setup();
    renderJobsPage();

    await user.click(screen.getByRole("tab", { name: "Completed" }));

    expect(screen.getByText("JB-1020")).toBeInTheDocument();
    expect(screen.getAllByText("View").length).toBeGreaterThan(0);
    expect(screen.queryByText("JB-1042")).not.toBeInTheDocument();
  });

  it("filters active jobs by status tab", async () => {
    const user = userEvent.setup();
    renderJobsPage();

    await user.click(screen.getByRole("tab", { name: "New" }));

    expect(screen.getByText("JB-1042")).toBeInTheDocument();
    expect(screen.queryByText("JB-1038")).not.toBeInTheDocument();
  });

  it("opens the new job drawer when the route is /jobs/new", () => {
    renderJobsPage("/jobs/new");

    expect(
      screen.getByRole("heading", { name: "New Job", level: 2 }),
    ).toBeInTheDocument();
  });

  it("opens the assign rider drawer at /jobs/new/assign", () => {
    renderJobsPage("/jobs/new/assign");

    expect(
      screen.getByRole("heading", { name: "Assign rider", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Available riders")).toBeInTheDocument();
  });

  it("links job cards to their detail pages", () => {
    renderJobsPage();

    const jobLink = screen.getByRole("link", { name: /JB-1042/i });
    expect(jobLink).toHaveAttribute("href", "/jobs/1");
  });
});
