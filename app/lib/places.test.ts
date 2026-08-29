import { afterEach, describe, expect, it, vi } from "vitest";

import { placeDetails, suggestPlaces } from "~/lib/places";

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
    formatted_address: string;
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
});
