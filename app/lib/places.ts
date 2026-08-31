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

const PLACES_AUTOCOMPLETE_URL =
  "https://places.googleapis.com/v1/places:autocomplete";

const AUTocomplete_FIELD_MASK =
  "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text";

const PLACE_DETAILS_FIELD_MASK = "id,formattedAddress,location";

const WALES_LOCATION_BIAS = {
  rectangle: {
    low: {
      latitude: 51.35,
      longitude: -5.65,
    },
    high: {
      latitude: 53.45,
      longitude: -2.65,
    },
  },
};

type PlacePredictionText = {
  text?: string;
};

type AutocompleteSuggestion = {
  placePrediction?: {
    placeId?: string;
    text?: PlacePredictionText;
  };
};

type AutocompleteResponse = {
  suggestions?: AutocompleteSuggestion[];
};

type PlaceDetailsResponse = {
  id?: string;
  formattedAddress?: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
};

function createSessionToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function suggestionsFromBody(body: AutocompleteResponse): PlaceSuggestion[] {
  const suggestions = body.suggestions ?? [];

  return suggestions.flatMap((suggestion) => {
    const prediction = suggestion.placePrediction;
    const placeId = prediction?.placeId;
    const description = prediction?.text?.text;
    if (!placeId || !description) {
      return [];
    }

    return [{ placeId, description }];
  });
}

function locationFromDetails(body: PlaceDetailsResponse): PlaceLocation {
  const latitude = body.location?.latitude;
  const longitude = body.location?.longitude;
  const address = body.formattedAddress;
  const placeId = body.id;

  if (
    !placeId ||
    !address ||
    latitude === undefined ||
    longitude === undefined
  ) {
    throw new Error("That place is missing map details. Choose another.");
  }

  return {
    placeId,
    address,
    latitude,
    longitude,
  };
}

async function readPlacesError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    if (body.error?.message) {
      return body.error.message;
    }
  } catch {
    // Fall through to generic message.
  }

  return "Place search failed. Try again.";
}

function placeDetailsUrl(placeId: string, sessionToken: string): string {
  const params = new URLSearchParams({ sessionToken });
  return `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?${params.toString()}`;
}

export function createGooglePlacesLookup(): PlacesLookup {
  let sessionToken: string | null = null;

  function ensureSessionToken(): string {
    if (sessionToken) {
      return sessionToken;
    }

    sessionToken = createSessionToken();
    return sessionToken;
  }

  function clearSessionToken(): void {
    sessionToken = null;
  }

  async function suggestPlaces(query: string): Promise<PlaceSuggestion[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return [];
    }

    const apiKey = getGoogleMapsApiKey();
    const response = await fetch(PLACES_AUTOCOMPLETE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": AUTocomplete_FIELD_MASK,
      },
      body: JSON.stringify({
        input: trimmed,
        sessionToken: ensureSessionToken(),
        includedRegionCodes: ["gb"],
        regionCode: "gb",
        languageCode: "en-GB",
        locationBias: WALES_LOCATION_BIAS,
      }),
    });

    if (!response.ok) {
      throw new Error(await readPlacesError(response));
    }

    const body = (await response.json()) as AutocompleteResponse;
    return suggestionsFromBody(body);
  }

  async function placeDetails(placeId: string): Promise<PlaceLocation> {
    const token = ensureSessionToken();
    const apiKey = getGoogleMapsApiKey();
    const response = await fetch(placeDetailsUrl(placeId, token), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": PLACE_DETAILS_FIELD_MASK,
      },
    });

    clearSessionToken();

    if (!response.ok) {
      throw new Error("Could not load that place. Try another.");
    }

    const body = (await response.json()) as PlaceDetailsResponse;

    return locationFromDetails(body);
  }

  return {
    suggest: suggestPlaces,
    details: placeDetails,
  };
}

export const googlePlacesLookup = createGooglePlacesLookup();

export async function suggestPlaces(query: string): Promise<PlaceSuggestion[]> {
  return googlePlacesLookup.suggest(query);
}

export async function placeDetails(placeId: string): Promise<PlaceLocation> {
  return googlePlacesLookup.details(placeId);
}
