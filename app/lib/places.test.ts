import { afterEach, describe, expect, it, vi } from "vitest";

import {
  cachedPlaceDetails,
  clearPlaceDetailsCache,
  placeDetails,
  suggestPlaces,
} from "~/lib/places";

function mockPlacesLibrary({
  predictions,
  status = "OK",
  place,
  detailsStatus = "OK",
}: {
  predictions?: Array<{ place_id: string; description: string }> | null;
  status?: string;
  place?: {
    place_id: string;
    name?: string;
    formatted_address: string;
    address_components?: Array<{
      long_name: string;
      short_name?: string;
      types: string[];
    }>;
    geometry: { location: { lat: () => number; lng: () => number } };
  } | null;
  detailsStatus?: string;
}) {
  const getPlacePredictions = vi.fn((_request, callback) => {
    callback(predictions ?? null, status);
  });
  const getDetails = vi.fn((_request, callback) => {
    callback(place ?? null, detailsStatus);
  });

  class AutocompleteService {
    getPlacePredictions = getPlacePredictions;
  }

  class PlacesService {
    getDetails = getDetails;
  }

  window.google = {
    maps: {
      places: {
        AutocompleteService,
        PlacesService,
      },
    },
  };

  return { getPlacePredictions, getDetails };
}

afterEach(() => {
  window.google = undefined;
  clearPlaceDetailsCache();
});

describe("suggestPlaces", () => {
  it("returns mapped predictions for a GB search", async () => {
    const { getPlacePredictions } = mockPlacesLibrary({
      predictions: [
        {
          place_id: "ChIJ-glamorgan",
          description: "Royal Glamorgan Hospital, Llantrisant",
        },
      ],
    });

    await expect(suggestPlaces("Royal")).resolves.toEqual([
      {
        placeId: "ChIJ-glamorgan",
        description: "Royal Glamorgan Hospital, Llantrisant",
      },
    ]);
    expect(getPlacePredictions).toHaveBeenCalledWith(
      { input: "Royal", componentRestrictions: { country: "gb" } },
      expect.any(Function),
    );
  });

  it("returns an empty list when there are no results", async () => {
    mockPlacesLibrary({ predictions: [], status: "ZERO_RESULTS" });

    await expect(suggestPlaces("zzzz")).resolves.toEqual([]);
  });

  it("skips the lookup for a query shorter than two characters", async () => {
    const { getPlacePredictions } = mockPlacesLibrary({ predictions: [] });

    await expect(suggestPlaces("R")).resolves.toEqual([]);
    expect(getPlacePredictions).not.toHaveBeenCalled();
  });
});

describe("placeDetails", () => {
  it("returns address, coordinates and place ID", async () => {
    mockPlacesLibrary({
      place: {
        place_id: "ChIJ-glamorgan",
        formatted_address: "Royal Glamorgan Hospital, Llantrisant",
        geometry: {
          location: { lat: () => 51.568, lng: () => -3.391 },
        },
      },
    });

    await expect(placeDetails("ChIJ-glamorgan")).resolves.toEqual({
      placeId: "ChIJ-glamorgan",
      address: "Royal Glamorgan Hospital, Llantrisant",
      latitude: 51.568,
      longitude: -3.391,
    });
  });

  it("prefixes the place name when it is missing from the street address", async () => {
    mockPlacesLibrary({
      place: {
        place_id: "ChIJ-morriston",
        name: "Morriston Hospital",
        formatted_address: "Heol Maes Eglwys, Morriston, Swansea SA6 6NL, UK",
        geometry: {
          location: { lat: () => 51.684, lng: () => -3.938 },
        },
      },
    });

    await expect(placeDetails("ChIJ-morriston")).resolves.toEqual({
      placeId: "ChIJ-morriston",
      address:
        "Morriston Hospital, Heol Maes Eglwys, Morriston, Swansea SA6 6NL, UK",
      latitude: 51.684,
      longitude: -3.938,
    });
  });

  it("reads the postal_code component into postcode", async () => {
    mockPlacesLibrary({
      place: {
        place_id: "ChIJ-glamorgan",
        formatted_address: "Royal Glamorgan Hospital, Llantrisant",
        address_components: [
          { long_name: "Llantrisant", types: ["locality", "political"] },
          { long_name: "CF72 8XR", types: ["postal_code"] },
        ],
        geometry: {
          location: { lat: () => 51.568, lng: () => -3.391 },
        },
      },
    });

    await expect(placeDetails("ChIJ-glamorgan")).resolves.toEqual({
      placeId: "ChIJ-glamorgan",
      address: "Royal Glamorgan Hospital, Llantrisant",
      postcode: "CF72 8XR",
      latitude: 51.568,
      longitude: -3.391,
    });
  });

  it("leaves postcode out when the place has no postal_code component", async () => {
    mockPlacesLibrary({
      place: {
        place_id: "ChIJ-glamorgan",
        formatted_address: "Royal Glamorgan Hospital, Llantrisant",
        address_components: [
          { long_name: "Llantrisant", types: ["locality", "political"] },
        ],
        geometry: {
          location: { lat: () => 51.568, lng: () => -3.391 },
        },
      },
    });

    await expect(placeDetails("ChIJ-glamorgan")).resolves.not.toHaveProperty(
      "postcode",
    );
  });

  it("asks Google for address_components", async () => {
    const { getDetails } = mockPlacesLibrary({
      place: {
        place_id: "ChIJ-glamorgan",
        formatted_address: "Royal Glamorgan Hospital, Llantrisant",
        geometry: {
          location: { lat: () => 51.568, lng: () => -3.391 },
        },
      },
    });

    await placeDetails("ChIJ-glamorgan");

    expect(getDetails).toHaveBeenCalledWith(
      {
        placeId: "ChIJ-glamorgan",
        fields: expect.arrayContaining(["address_components"]),
      },
      expect.any(Function),
    );
  });
});

describe("cachedPlaceDetails", () => {
  const place = {
    place_id: "ChIJ-glamorgan",
    formatted_address: "Royal Glamorgan Hospital, Llantrisant",
    geometry: { location: { lat: () => 51.568, lng: () => -3.391 } },
  };

  it("fetches a place id once, even when asked twice at the same time", async () => {
    const { getDetails } = mockPlacesLibrary({ place });

    const [first, second] = await Promise.all([
      cachedPlaceDetails("ChIJ-glamorgan"),
      cachedPlaceDetails("ChIJ-glamorgan"),
    ]);
    await cachedPlaceDetails("ChIJ-glamorgan");

    expect(first).toBe(second);
    expect(getDetails).toHaveBeenCalledTimes(1);
  });

  it("fetches each place id separately", async () => {
    const { getDetails } = mockPlacesLibrary({ place });

    await cachedPlaceDetails("ChIJ-glamorgan");
    await cachedPlaceDetails("ChIJ-other");

    expect(getDetails).toHaveBeenCalledTimes(2);
  });

  it("forgets a failed lookup so it can be retried", async () => {
    const { getDetails } = mockPlacesLibrary({
      place: null,
      detailsStatus: "UNKNOWN_ERROR",
    });

    await expect(cachedPlaceDetails("ChIJ-glamorgan")).rejects.toThrow();
    await expect(cachedPlaceDetails("ChIJ-glamorgan")).rejects.toThrow();

    expect(getDetails).toHaveBeenCalledTimes(2);
  });
});
