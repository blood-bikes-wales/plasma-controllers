import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PlaceLocation, RelayJobPayload } from "~/lib/jobs";
import type { PlacesLookup } from "~/lib/places";
import { RelayJobForm } from "./relay-job-form";

const FIRST: PlaceLocation = {
  placeId: "ChIJ-first",
  address: "Services, M4 Junction 32",
  latitude: 51.54,
  longitude: -3.12,
};

const SECOND: PlaceLocation = {
  placeId: "ChIJ-second",
  address: "Pontypridd Park and Ride",
  latitude: 51.6,
  longitude: -3.34,
};

// Local time (no "Z") so the job's calendar day is the same in any timezone.
const JOB_DATE = "2026-03-10T09:00:00";

function stubLookup(): PlacesLookup {
  const places = [FIRST, SECOND];
  return {
    suggest: async (query: string) =>
      places
        .filter((place) =>
          place.address.toLowerCase().includes(query.toLowerCase()),
        )
        .map((place) => ({
          placeId: place.placeId,
          description: place.address,
        })),
    details: async (placeId: string) =>
      places.find((place) => place.placeId === placeId) ?? FIRST,
  };
}

function renderForm(onSubmit = vi.fn(async (_payload: RelayJobPayload) => {})) {
  render(
    <RelayJobForm
      jobDate={JOB_DATE}
      isSubmitting={false}
      onSubmit={onSubmit}
      placesLookup={stubLookup()}
    />,
  );
  return { onSubmit };
}

async function choosePlace(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  query: string,
  place: PlaceLocation,
) {
  await user.type(screen.getByLabelText(label), query);
  await user.click(await screen.findByRole("option", { name: place.address }));
  await screen.findByDisplayValue(place.address);
}

describe("RelayJobForm arrival times", () => {
  it("asks for an arrival time on each rendezvous row only", async () => {
    const user = userEvent.setup();
    renderForm();

    const input = screen.getByLabelText("Arrival time at rendezvous 1");
    expect(input).toHaveAttribute("type", "time");
    expect(document.querySelectorAll('input[type="time"]')).toHaveLength(1);

    await user.click(
      screen.getByRole("button", { name: "Add rendezvous point" }),
    );

    expect(
      screen.getByLabelText("Arrival time at rendezvous 2"),
    ).toHaveAttribute("type", "time");
    expect(document.querySelectorAll('input[type="time"]')).toHaveLength(2);
    expect(screen.queryByLabelText(/collection/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/delivery/i)).not.toBeInTheDocument();
  });

  it("requires a time on every rendezvous row", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.click(
      screen.getByRole("button", { name: "Add rendezvous point" }),
    );
    await choosePlace(user, "Rendezvous point 1", "Services", FIRST);
    await choosePlace(user, "Rendezvous point 2", "Pontypridd", SECOND);
    fireEvent.change(screen.getByLabelText("Arrival time at rendezvous 1"), {
      target: { value: "10:15" },
    });

    await user.click(screen.getByRole("button", { name: "Convert to relay" }));

    expect(await screen.findByText("Enter an arrival time")).toBeVisible();
    expect(screen.getAllByText("Enter an arrival time")).toHaveLength(1);
    expect(
      screen.getByLabelText("Arrival time at rendezvous 2"),
    ).toHaveAttribute("aria-invalid", "true");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits arrivesAt for each rendezvous on the job's day", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.click(
      screen.getByRole("button", { name: "Add rendezvous point" }),
    );
    await choosePlace(user, "Rendezvous point 1", "Services", FIRST);
    await choosePlace(user, "Rendezvous point 2", "Pontypridd", SECOND);
    fireEvent.change(screen.getByLabelText("Arrival time at rendezvous 1"), {
      target: { value: "10:15" },
    });
    fireEvent.change(screen.getByLabelText("Arrival time at rendezvous 2"), {
      target: { value: "13:40" },
    });

    await user.click(screen.getByRole("button", { name: "Convert to relay" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const [payload] = onSubmit.mock.calls[0];
    expect(payload.rendezvousPoints).toHaveLength(2);

    const [first, second] = payload.rendezvousPoints;
    expect(first).toMatchObject(FIRST);
    expect(second).toMatchObject(SECOND);

    const parts = (iso: string) => {
      const date = new Date(iso);
      return [
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
      ];
    };
    expect(parts(first.arrivesAt)).toEqual([2026, 3, 10, 10, 15]);
    expect(parts(second.arrivesAt)).toEqual([2026, 3, 10, 13, 40]);
    expect(first.arrivesAt).toBe(new Date(first.arrivesAt).toISOString());
  });

  it("sends the postcode of each rendezvous point", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async (_payload: RelayJobPayload) => {});
    const withPostcode = { ...FIRST, postcode: "CF83 1AA" };
    render(
      <RelayJobForm
        jobDate={JOB_DATE}
        isSubmitting={false}
        onSubmit={onSubmit}
        placesLookup={{
          ...stubLookup(),
          details: async () => withPostcode,
        }}
      />,
    );

    await user.type(screen.getByLabelText("Rendezvous point 1"), "Services");
    await user.click(
      await screen.findByRole("option", { name: /Services, M4 Junction 32/ }),
    );
    await screen.findByDisplayValue("Services, M4 Junction 32, CF83 1AA");
    fireEvent.change(screen.getByLabelText("Arrival time at rendezvous 1"), {
      target: { value: "10:15" },
    });
    await user.click(screen.getByRole("button", { name: "Convert to relay" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].rendezvousPoints[0]).toMatchObject(
      withPostcode,
    );
  });
});
