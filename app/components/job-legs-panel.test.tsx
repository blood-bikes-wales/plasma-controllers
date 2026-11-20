import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import type { DeliveryJob } from "~/lib/jobs";
import { mockActiveJobs } from "../../tests/job-fixtures";
import { JobLegsPanel } from "./job-legs-panel";

const [base] = mockActiveJobs;

function atToday(hours: number, minutes: number) {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

function leg(
  legNumber: number,
  collection: string,
  delivery: string,
  plannedArrivalAt: string | null,
): DeliveryJob {
  return {
    ...base,
    id: `leg-${legNumber}`,
    reference: `JB-2000-L${legNumber}`,
    legNumber,
    parentJobId: "parent",
    collection: { ...base.collection, address: collection },
    delivery: { ...base.delivery, address: delivery },
    plannedArrivalAt,
  };
}

describe("JobLegsPanel planned arrival", () => {
  it("shows the arrival time on each handoff and not on the final hospital", () => {
    render(
      <MemoryRouter>
        <JobLegsPanel
          defaultExpanded
          legs={[
            leg(1, "Collection Hospital", "Handoff One", atToday(10, 15)),
            leg(2, "Handoff One", "Handoff Two", atToday(13, 40)),
            leg(3, "Handoff Two", "Final Hospital", null),
          ]}
        />
      </MemoryRouter>,
    );

    const first = screen.getByText("Arrives: Today, 10:15");
    const second = screen.getByText("Arrives: Today, 13:40");
    expect(screen.getAllByText(/^Arrives:/)).toHaveLength(2);

    // Each time sits directly under the handoff address it belongs to.
    expect(first.previousElementSibling).toHaveTextContent("Handoff One");
    expect(second.previousElementSibling).toHaveTextContent("Handoff Two");

    const finalAddress = screen.getByText("Final Hospital");
    expect(finalAddress.nextElementSibling).toBeNull();
    // The first collection address has no time either.
    expect(screen.getByText("Collection Hospital").nextElementSibling).toBe(
      screen.getAllByText("Handoff One")[0],
    );
  });
});
