import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createGooglePlacesLookup,
  placeDetails,
  suggestPlaces,
} from "~/lib/places";

const AUTocomplete_URL = "https://places.googleapis.com/v1/places:autocomplete";

function mockFetch(handlers: {
  autocomplete?: (body: Record<string, unknown>) => Response;
  details?: (placeId: string, sessionToken: string | null) => Response;
}) {
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.startsWith(AUTocomplete_URL)) {
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<
          string,
          unknown
        >;
        return (
          handlers.autocomplete?.(body) ?? new Response("{}", { status: 500 })
        );
      }

      const detailsMatch = url.match(
        /^https:\/\/places\.googleapis\.com\/v1\/places\/([^?]+)\?(.+)$/,
      );
      if (detailsMatch) {
        const placeId = decodeURIComponent(detailsMatch[1]);
        const params = new URLSearchParams(detailsMatch[2]);
        return (
          handlers.details?.(placeId, params.get("sessionToken")) ??
          new Response("{}", { status: 500 })
        );
      }

      return new Response("Not found", { status: 404 });
    },
  );

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "test-maps-key");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("suggestPlaces", () => {
  it("calls Autocomplete (New) with GB and Wales bias", async () => {
    const fetchMock = mockFetch({
      autocomplete: (body) => {
        expect(body.input).toBe("Royal");
        expect(body.includedRegionCodes).toEqual(["gb"]);
        expect(body.regionCode).toBe("gb");
        expect(body.languageCode).toBe("en-GB");
        expect(body.locationBias).toEqual({
          rectangle: {
            low: { latitude: 51.35, longitude: -5.65 },
            high: { latitude: 53.45, longitude: -2.65 },
          },
        });
        expect(typeof body.sessionToken).toBe("string");

        return Response.json({
          suggestions: [
            {
              placePrediction: {
                placeId: "ChIJ-glamorgan",
                text: {
                  text: "Royal Glamorgan Hospital, Llantrisant",
                },
              },
            },
          ],
        });
      },
    });

    await expect(suggestPlaces("Royal")).resolves.toEqual([
      {
        placeId: "ChIJ-glamorgan",
        description: "Royal Glamorgan Hospital, Llantrisant",
      },
    ]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("returns an empty list when there are no suggestions", async () => {
    mockFetch({
      autocomplete: () => Response.json({ suggestions: [] }),
    });

    await expect(suggestPlaces("zzzz")).resolves.toEqual([]);
  });

  it("skips the lookup for a query shorter than two characters", async () => {
    const fetchMock = mockFetch({});

    await expect(suggestPlaces("R")).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("placeDetails", () => {
  it("returns address, coordinates and place ID from Place Details (New)", async () => {
    let autocompleteToken = "";

    mockFetch({
      autocomplete: (body) => {
        autocompleteToken = String(body.sessionToken);
        return Response.json({ suggestions: [] });
      },
      details: (placeId, sessionToken) => {
        expect(placeId).toBe("ChIJ-glamorgan");
        expect(sessionToken).toBe(autocompleteToken);

        return Response.json({
          id: "ChIJ-glamorgan",
          formattedAddress: "Royal Glamorgan Hospital, Llantrisant",
          location: { latitude: 51.568, longitude: -3.391 },
        });
      },
    });

    await suggestPlaces("Royal");
    await expect(placeDetails("ChIJ-glamorgan")).resolves.toEqual({
      placeId: "ChIJ-glamorgan",
      address: "Royal Glamorgan Hospital, Llantrisant",
      latitude: 51.568,
      longitude: -3.391,
    });
  });
});

describe("createGooglePlacesLookup", () => {
  it("starts a fresh session token after a place is selected", async () => {
    const tokens: string[] = [];

    mockFetch({
      autocomplete: (body) => {
        tokens.push(String(body.sessionToken));
        return Response.json({
          suggestions: [
            {
              placePrediction: {
                placeId: "ChIJ-one",
                text: { text: "First Hospital" },
              },
            },
          ],
        });
      },
      details: () =>
        Response.json({
          id: "ChIJ-one",
          formattedAddress: "First Hospital",
          location: { latitude: 51.5, longitude: -3.2 },
        }),
    });

    const lookup = createGooglePlacesLookup();
    await lookup.suggest("First");
    await lookup.details("ChIJ-one");
    await lookup.suggest("Second");

    expect(tokens).toHaveLength(2);
    expect(tokens[0]).not.toBe(tokens[1]);
  });
});
