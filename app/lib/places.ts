import { getGoogleMapsApiKey } from "~/lib/env";
import type { PlaceLocation } from "~/lib/jobs";

export type PlaceSuggestion = {
  placeId: string;
  description: string;
};

export type PlacesLookup = {
  suggest: (query: string) => Promise<PlaceSuggestion[]>;
  details: (placeId: string) => Promise<PlaceLocation>;
};

type AutocompletePrediction = {
  place_id: string;
  description: string;
};

type AutocompleteService = {
  getPlacePredictions: (
    request: { input: string; componentRestrictions?: { country: string } },
    callback: (
      predictions: AutocompletePrediction[] | null,
      status: string,
    ) => void,
  ) => void;
};

type AddressComponent = {
  long_name: string;
  short_name?: string;
  types: string[];
};

type PlaceResult = {
  place_id?: string;
  formatted_address?: string;
  address_components?: AddressComponent[];
  name?: string;
  geometry?: {
    location?: {
      lat: number | (() => number);
      lng: number | (() => number);
    };
  };
};

type PlacesService = {
  getDetails: (
    request: { placeId: string; fields: string[] },
    callback: (place: PlaceResult | null, status: string) => void,
  ) => void;
};

type GooglePlacesLibrary = {
  AutocompleteService: new () => AutocompleteService;
  PlacesService: new (attrContainer: HTMLElement) => PlacesService;
};

declare global {
  interface GoogleNamespace {
    maps?: {
      places?: GooglePlacesLibrary;
    };
  }
}

const MAPS_SCRIPT_BASE = "https://maps.googleapis.com/maps/api/js";

let scriptLoadPromise: Promise<void> | null = null;

function placesLibrary(): GooglePlacesLibrary | null {
  const places = window.google?.maps?.places;
  if (!places?.AutocompleteService || !places.PlacesService) {
    return null;
  }

  return places;
}

function mapsScriptSrc(apiKey: string): string {
  const params = new URLSearchParams({
    key: apiKey,
    libraries: "places",
  });
  return `${MAPS_SCRIPT_BASE}?${params.toString()}`;
}

function loadMapsScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("Place search is only available in the browser"),
    );
  }

  if (placesLibrary()) {
    return Promise.resolve();
  }

  if (scriptLoadPromise) {
    return scriptLoadPromise;
  }

  const apiKey = getGoogleMapsApiKey();
  const src = mapsScriptSrc(apiKey);

  scriptLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Google Maps")),
      );
      if (placesLibrary()) {
        resolve();
      }
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoadPromise = null;
      reject(new Error("Failed to load Google Maps"));
    };
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

async function loadPlacesLibrary(): Promise<GooglePlacesLibrary> {
  await loadMapsScript();
  const places = placesLibrary();
  if (!places) {
    throw new Error("Google Places is unavailable");
  }

  return places;
}

function predictionsFromResponse(
  predictions: AutocompletePrediction[] | null,
  status: string,
): PlaceSuggestion[] {
  if (status === "ZERO_RESULTS") {
    return [];
  }

  if (status !== "OK") {
    throw new Error("Place search failed. Try again.");
  }

  return (predictions ?? []).map((prediction) => ({
    placeId: prediction.place_id,
    description: prediction.description,
  }));
}

function readCoordinate(value: number | (() => number)): number {
  if (typeof value === "function") {
    return value();
  }

  return value;
}

function displayAddress(place: PlaceResult): string | undefined {
  const name = place.name?.trim();
  const formatted = place.formatted_address?.trim();
  if (!name) {
    return formatted;
  }

  if (!formatted) {
    return name;
  }

  if (formatted.toLowerCase().includes(name.toLowerCase())) {
    return formatted;
  }

  return `${name}, ${formatted}`;
}

function locationFromPlace(place: PlaceResult | null): PlaceLocation {
  const geometry = place?.geometry?.location;
  const address = place ? displayAddress(place) : undefined;
  if (!place?.place_id || !address || !geometry) {
    throw new Error("That place is missing map details. Choose another.");
  }

  const postcode = postcodeFromPlace(place);

  return {
    placeId: place.place_id,
    address,
    ...(postcode ? { postcode } : {}),
    latitude: readCoordinate(geometry.lat),
    longitude: readCoordinate(geometry.lng),
  };
}

function postcodeFromPlace(place: PlaceResult): string | undefined {
  const component = place.address_components?.find((item) =>
    item.types.includes("postal_code"),
  );
  return component?.long_name.trim() || undefined;
}

function placesAttributionNode(): HTMLElement {
  const existing = document.getElementById("google-places-attribution");
  if (existing) {
    return existing;
  }

  const node = document.createElement("div");
  node.id = "google-places-attribution";
  node.setAttribute("aria-hidden", "true");
  node.style.display = "none";
  document.body.appendChild(node);
  return node;
}

export async function suggestPlaces(query: string): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const places = await loadPlacesLibrary();
  const service = new places.AutocompleteService();

  return new Promise((resolve, reject) => {
    service.getPlacePredictions(
      { input: trimmed, componentRestrictions: { country: "gb" } },
      (predictions, status) => {
        try {
          resolve(predictionsFromResponse(predictions, status));
        } catch (error) {
          reject(error);
        }
      },
    );
  });
}

export async function placeDetails(placeId: string): Promise<PlaceLocation> {
  const places = await loadPlacesLibrary();
  const service = new places.PlacesService(placesAttributionNode());

  return new Promise((resolve, reject) => {
    service.getDetails(
      {
        placeId,
        fields: [
          "place_id",
          "formatted_address",
          "address_components",
          "name",
          "geometry",
        ],
      },
      (place, status) => {
        if (status !== "OK") {
          reject(new Error("Could not load that place. Try another."));
          return;
        }

        try {
          resolve(locationFromPlace(place));
        } catch (error) {
          reject(error);
        }
      },
    );
  });
}

const detailsCache = new Map<string, Promise<PlaceLocation>>();

/**
 * `placeDetails` remembered per place id for the life of the page, so a
 * suggestion whose postcode was fetched for the list is not fetched again when
 * it is chosen. A failed lookup is forgotten so it can be retried.
 */
export function cachedPlaceDetails(placeId: string): Promise<PlaceLocation> {
  const cached = detailsCache.get(placeId);
  if (cached) {
    return cached;
  }

  const pending = placeDetails(placeId);
  detailsCache.set(placeId, pending);
  pending.catch(() => {
    if (detailsCache.get(placeId) === pending) {
      detailsCache.delete(placeId);
    }
  });
  return pending;
}

export function clearPlaceDetailsCache(): void {
  detailsCache.clear();
}

export const googlePlacesLookup: PlacesLookup = {
  suggest: suggestPlaces,
  details: cachedPlaceDetails,
};
