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
    const lookup = stubLookup({
      suggest: vi.fn(async () => [
        {
          placeId: GLAMORGAN.placeId,
          description: "Royal Glamorgan Hospital, Ynysmaerdy, Llantrisant",
        },
      ]),
      details: vi.fn(async () => ({
        ...GLAMORGAN,
        address: "Ynysmaerdy, Llantrisant CF72 8XR, UK",
      })),
    });

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
      await screen.findByRole("option", {
        name: "Royal Glamorgan Hospital, Ynysmaerdy, Llantrisant",
      }),
    );

    await waitFor(() => {
      expect(lookup.details).toHaveBeenCalledWith(GLAMORGAN.placeId);
    });
    expect(onChange).toHaveBeenCalledWith({
      ...GLAMORGAN,
      address: "Royal Glamorgan Hospital, Ynysmaerdy, Llantrisant",
    });
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

  describe("postcodes", () => {
    const WITH_POSTCODE = { ...GLAMORGAN, postcode: "CF72 8XR" };

    it("shows a postcode on a suggestion whose description has none", async () => {
      const user = userEvent.setup();
      const lookup = stubLookup({
        details: vi.fn(async () => WITH_POSTCODE),
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

      expect(await screen.findByText("CF72 8XR")).toBeInTheDocument();
      expect(lookup.details).toHaveBeenCalledWith(GLAMORGAN.placeId);
      expect(
        screen.getByRole("option", { name: /Royal Glamorgan Hospital/ }),
      ).toHaveTextContent("Royal Glamorgan Hospital, LlantrisantCF72 8XR");
    });

    it("does not fetch details for a suggestion that already has a postcode", async () => {
      const user = userEvent.setup();
      const lookup = stubLookup({
        suggest: vi.fn(async () => [
          {
            placeId: GLAMORGAN.placeId,
            description: "Royal Glamorgan Hospital, Llantrisant CF72 8XR, UK",
          },
        ]),
        details: vi.fn(async () => WITH_POSTCODE),
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

      expect(
        await screen.findByRole("option", {
          name: "Royal Glamorgan Hospital, Llantrisant CF72 8XR, UK",
        }),
      ).toBeInTheDocument();
      expect(lookup.details).not.toHaveBeenCalled();
    });

    it("fetches details for at most five visible suggestions", async () => {
      const user = userEvent.setup();
      const lookup = stubLookup({
        suggest: vi.fn(async () =>
          [0, 1, 2, 3, 4, 5, 6].map((index) => ({
            placeId: `ChIJ-many-${index}`,
            description: `Hospital ${index}`,
          })),
        ),
        details: vi.fn(async (placeId: string) => ({
          ...GLAMORGAN,
          placeId,
          postcode: "CF72 8XR",
        })),
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
        "Hosp",
      );

      await waitFor(() => {
        expect(screen.getAllByText("CF72 8XR")).toHaveLength(5);
      });
      expect(lookup.details).toHaveBeenCalledTimes(5);
    });

    it("shows no postcode, and no error, when a suggestion's details fail", async () => {
      const user = userEvent.setup();
      const lookup = stubLookup({
        details: vi.fn(async () => {
          throw new Error("Could not load that place. Try another.");
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

      await screen.findByRole("option", { name: GLAMORGAN.address });
      await waitFor(() => expect(lookup.details).toHaveBeenCalled());
      expect(screen.queryByText(/Could not load/)).not.toBeInTheDocument();
    });

    it("passes the postcode on when a suggestion is chosen", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const lookup = stubLookup({
        details: vi.fn(async () => WITH_POSTCODE),
      });

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
        await screen.findByRole("option", { name: /Royal Glamorgan/ }),
      );

      expect(onChange).toHaveBeenCalledWith(WITH_POSTCODE);
    });

    it("takes the postcode from the description when Google has none for the place", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const description = "Royal Glamorgan Hospital, Llantrisant CF72 8XR, UK";
      const lookup = stubLookup({
        suggest: vi.fn(async () => [
          { placeId: GLAMORGAN.placeId, description },
        ]),
      });

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
        await screen.findByRole("option", { name: description }),
      );

      expect(onChange).toHaveBeenCalledWith({
        ...GLAMORGAN,
        address: description,
        postcode: "CF72 8XR",
      });
    });

    it("shows the postcode on the chosen value", () => {
      render(
        <PlaceLocationField
          id="collection-location"
          label="Collection location"
          value={WITH_POSTCODE}
          onChange={() => {}}
          lookup={stubLookup()}
        />,
      );

      expect(
        screen.getByDisplayValue(
          "Royal Glamorgan Hospital, Llantrisant, CF72 8XR",
        ),
      ).toBeInTheDocument();
    });

    it("does not print the postcode twice on the chosen value", () => {
      render(
        <PlaceLocationField
          id="collection-location"
          label="Collection location"
          value={{
            ...WITH_POSTCODE,
            address: "Royal Glamorgan Hospital, Llantrisant CF72 8XR, UK",
          }}
          onChange={() => {}}
          lookup={stubLookup()}
        />,
      );

      expect(
        screen.getByDisplayValue(
          "Royal Glamorgan Hospital, Llantrisant CF72 8XR, UK",
        ),
      ).toBeInTheDocument();
    });

    it("shows the postcode on Recent and Most used places", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const extras: PlaceLocation[] = [0, 1, 2, 3, 4].map((index) => ({
        placeId: `ChIJ-extra-${index}`,
        address: `Hospital ${index}`,
        latitude: 51,
        longitude: -3,
      }));
      recordUsedLocations([WITH_POSTCODE]);
      recordUsedLocations([WITH_POSTCODE]);
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

      // Most used: the place pushed out of the five most recent.
      expect(screen.getByText("Most used")).toBeInTheDocument();
      expect(screen.getByText("CF72 8XR")).toBeInTheDocument();

      await user.click(
        screen.getByRole("button", { name: /Royal Glamorgan Hospital/ }),
      );
      expect(onChange).toHaveBeenCalledWith(WITH_POSTCODE);
    });
  });
});
