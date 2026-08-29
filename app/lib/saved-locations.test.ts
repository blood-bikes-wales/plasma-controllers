import { afterEach, describe, expect, it, vi } from "vitest";

import type { PlaceLocation } from "~/lib/jobs";
import {
  clearSavedLocations,
  mostUsedLocations,
  recentLocations,
  recordUsedLocations,
  SAVED_LOCATIONS_KEY,
} from "~/lib/saved-locations";

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

const MORRISTON: PlaceLocation = {
  placeId: "ChIJ-morriston",
  address: "Morriston Hospital, Swansea",
  latitude: 51.684,
  longitude: -3.934,
};

afterEach(() => {
  clearSavedLocations();
  vi.useRealTimers();
});

describe("recordUsedLocations", () => {
  it("stores unique places and increments use count on repeat", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    recordUsedLocations([GLAMORGAN, UHW]);

    vi.setSystemTime(2_000);
    recordUsedLocations([GLAMORGAN]);

    expect(recentLocations()).toEqual([GLAMORGAN, UHW]);
    expect(mostUsedLocations()).toEqual([GLAMORGAN, UHW]);
  });

  it("orders recent by last used and most used by count", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    recordUsedLocations([GLAMORGAN]);
    recordUsedLocations([GLAMORGAN]);
    recordUsedLocations([GLAMORGAN]);

    vi.setSystemTime(2_000);
    recordUsedLocations([UHW]);

    vi.setSystemTime(3_000);
    recordUsedLocations([MORRISTON]);

    expect(recentLocations()).toEqual([MORRISTON, UHW, GLAMORGAN]);
    expect(mostUsedLocations()).toEqual([GLAMORGAN, MORRISTON, UHW]);
  });

  it("ignores corrupt storage", () => {
    localStorage.setItem(SAVED_LOCATIONS_KEY, "{not-json");
    expect(recentLocations()).toEqual([]);
  });
});
