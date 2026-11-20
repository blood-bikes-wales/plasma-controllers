import type { PlaceLocation } from "~/lib/jobs";

export const SAVED_LOCATIONS_KEY = "plasma.saved_locations";

const MAX_STORED = 20;
const QUICK_PICK_LIMIT = 5;

export type SavedLocation = PlaceLocation & {
  useCount: number;
  lastUsedAt: number;
};

function isPlaceLocation(value: unknown): value is PlaceLocation {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as PlaceLocation;
  return (
    typeof candidate.placeId === "string" &&
    candidate.placeId.length > 0 &&
    typeof candidate.address === "string" &&
    candidate.address.length > 0 &&
    (candidate.postcode === undefined ||
      candidate.postcode === null ||
      typeof candidate.postcode === "string") &&
    typeof candidate.latitude === "number" &&
    typeof candidate.longitude === "number"
  );
}

function isSavedLocation(value: unknown): value is SavedLocation {
  if (!isPlaceLocation(value)) {
    return false;
  }

  const candidate = value as SavedLocation;
  return (
    typeof candidate.useCount === "number" &&
    candidate.useCount > 0 &&
    typeof candidate.lastUsedAt === "number"
  );
}

export function loadSavedLocations(): SavedLocation[] {
  if (typeof localStorage === "undefined") {
    return [];
  }

  const raw = localStorage.getItem(SAVED_LOCATIONS_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isSavedLocation);
  } catch {
    return [];
  }
}

function saveLocations(locations: SavedLocation[]): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(locations));
}

function uniqueByPlaceId(locations: PlaceLocation[]): PlaceLocation[] {
  const seen = new Set<string>();
  return locations.filter((location) => {
    if (seen.has(location.placeId)) {
      return false;
    }

    seen.add(location.placeId);
    return true;
  });
}

/**
 * Only the place fields are remembered; anything else on a job stop (e.g. its
 * notes) is dropped. The postcode belongs to the place, so it is kept.
 */
function placeFields(
  location: PlaceLocation,
  fallbackPostcode?: string | null,
): PlaceLocation {
  const postcode = location.postcode?.trim() || fallbackPostcode?.trim();
  return {
    placeId: location.placeId,
    address: location.address,
    ...(postcode ? { postcode } : {}),
    latitude: location.latitude,
    longitude: location.longitude,
  };
}

function upsertLocation(
  stored: SavedLocation[],
  location: PlaceLocation,
  now: number,
): SavedLocation[] {
  const existing = stored.find((item) => item.placeId === location.placeId);
  if (!existing) {
    return [
      { ...placeFields(location), useCount: 1, lastUsedAt: now },
      ...stored,
    ];
  }

  return stored.map((item) => {
    if (item.placeId !== location.placeId) {
      return item;
    }

    return {
      // A place saved before it had a postcode keeps one once any use supplies it, and a use without one does not erase it.
      ...placeFields(location, item.postcode),
      useCount: item.useCount + 1,
      lastUsedAt: now,
    };
  });
}

function trimToMax(locations: SavedLocation[]): SavedLocation[] {
  return [...locations]
    .sort((left, right) => right.lastUsedAt - left.lastUsedAt)
    .slice(0, MAX_STORED);
}

export function recordUsedLocations(locations: PlaceLocation[]): void {
  const now = Date.now();
  let stored = loadSavedLocations();
  for (const location of uniqueByPlaceId(locations)) {
    stored = upsertLocation(stored, location, now);
  }

  saveLocations(trimToMax(stored));
}

function toPlaceLocation(saved: SavedLocation): PlaceLocation {
  return {
    placeId: saved.placeId,
    address: saved.address,
    ...(saved.postcode ? { postcode: saved.postcode } : {}),
    latitude: saved.latitude,
    longitude: saved.longitude,
  };
}

export function recentLocations(limit = QUICK_PICK_LIMIT): PlaceLocation[] {
  return [...loadSavedLocations()]
    .sort((left, right) => right.lastUsedAt - left.lastUsedAt)
    .slice(0, limit)
    .map(toPlaceLocation);
}

export function mostUsedLocations(limit = QUICK_PICK_LIMIT): PlaceLocation[] {
  return [...loadSavedLocations()]
    .sort((left, right) => {
      if (right.useCount !== left.useCount) {
        return right.useCount - left.useCount;
      }

      return right.lastUsedAt - left.lastUsedAt;
    })
    .slice(0, limit)
    .map(toPlaceLocation);
}

export function clearSavedLocations(): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.removeItem(SAVED_LOCATIONS_KEY);
}
