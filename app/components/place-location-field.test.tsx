import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlaceLocation } from "~/lib/jobs";
import type { PlacesLookup } from "~/lib/places";
import {
  clearSavedLocations,
  recordUsedLocations,
} from "~/lib/saved-locations";
import { PlaceLocationField } from "./place-location-field";

const GLAMORGAN: PlaceLocation = {
  placeId: "ChIJ-glamorgan",
  address: "Royal Glamorgan Hospital, Llantrisant",
  latitude: 51.568,
  longitude: -3.391,
};

const UHW: PlaceLocation = {
  placeId: "ChIJ-uhw",
  address: "University Hospital of Wales, Cardiff",
  latitude: 51.506,
  longitude: -3.191,
};

function stubLookup(overrides: Partial<PlacesLookup> = {}): PlacesLookup {
  return {
    suggest: vi.fn(async (query: string) => {
      const haystacks = [
        {
          placeId: GLAMORGAN.placeId,
          description: GLAMORGAN.address,
        },
        { placeId: UHW.placeId, description: UHW.address },
      ];
      return haystacks.filter((item) =>
        item.description.toLowerCase().includes(query.toLowerCase()),
      );
    }),
    details: vi.fn(async (placeId: string) => {
      if (placeId === GLAMORGAN.placeId) {
        return GLAMORGAN;
      }
      return UHW;
    }),
    ...overrides,
  };
}

afterEach(() => {
  clearSavedLocations();
});

describe("PlaceLocationField", () => {
  it("resolves a typed suggestion to a full place location", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const lookup = stubLookup();

    render(
      <PlaceLocationField
        id="collection-location"
        label="Collection location"
        value={null}
        onChange={onChange}
        lookup={lookup}
      />,
    );

    await user.type(
      screen.getByRole("combobox", { name: "Collection location" }),
      "Royal",
    );

    await user.click(
      await screen.findByRole("option", { name: GLAMORGAN.address }),
    );

    await waitFor(() => {
      expect(lookup.details).toHaveBeenCalledWith(GLAMORGAN.placeId);
    });
    expect(onChange).toHaveBeenCalledWith(GLAMORGAN);
  });

  it("lets the user pick a recently used location without searching", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    recordUsedLocations([GLAMORGAN]);

    render(
      <PlaceLocationField
        id="collection-location"
        label="Collection location"
        value={null}
        onChange={onChange}
        lookup={stubLookup()}
      />,
    );

    await user.click(
      screen.getByRole("combobox", { name: "Collection location" }),
    );

    expect(screen.getByText("Recent")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: GLAMORGAN.address }));

    expect(onChange).toHaveBeenCalledWith(GLAMORGAN);
  });

  it("shows a most-used location that is no longer in the recent list", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const extras: PlaceLocation[] = [0, 1, 2, 3, 4].map((index) => ({
      placeId: `ChIJ-extra-${index}`,
      address: `Hospital ${index}`,
      latitude: 51,
      longitude: -3,
    }));

    recordUsedLocations([GLAMORGAN]);
    recordUsedLocations([GLAMORGAN]);
    recordUsedLocations([GLAMORGAN]);
    for (const extra of extras) {
      recordUsedLocations([extra]);
    }

    render(
      <PlaceLocationField
        id="collection-location"
        label="Collection location"
        value={null}
        onChange={onChange}
        lookup={stubLookup()}
      />,
    );

    await user.click(
      screen.getByRole("combobox", { name: "Collection location" }),
    );

    expect(screen.getByText("Most used")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: GLAMORGAN.address }));
    expect(onChange).toHaveBeenCalledWith(GLAMORGAN);
  });

  it("shows the selected address and a Change action", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <PlaceLocationField
        id="collection-location"
        label="Collection location"
        value={GLAMORGAN}
        onChange={onChange}
        lookup={stubLookup()}
      />,
    );

    expect(screen.getByDisplayValue(GLAMORGAN.address)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Change" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("shows an inline error", () => {
    render(
      <PlaceLocationField
        id="collection-location"
        label="Collection location"
        value={null}
        onChange={() => {}}
        error="Choose a collection location from the place search"
        lookup={stubLookup()}
      />,
    );

    expect(
      screen.getByText("Choose a collection location from the place search"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Collection location" }),
    ).toHaveAttribute("aria-invalid", "true");
  });

  it("surfaces a lookup failure inline", async () => {
    const user = userEvent.setup();
    const lookup = stubLookup({
      suggest: vi.fn(async () => {
        throw new Error("Place search failed. Try again.");
      }),
    });

    render(
      <PlaceLocationField
        id="collection-location"
        label="Collection location"
        value={null}
        onChange={() => {}}
        lookup={lookup}
      />,
    );

    await user.type(
      screen.getByRole("combobox", { name: "Collection location" }),
      "Royal",
    );

    await waitFor(() => {
      expect(
        screen.getByText("Place search failed. Try again."),
      ).toBeInTheDocument();
    });
  });
});
