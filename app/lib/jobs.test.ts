import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "~/lib/api-client";
import { clearAuthToken, setAuthToken } from "~/lib/auth-token";
import { createDeliveryJob, jobErrorMessage } from "~/lib/jobs";

const COLLECTION = {
  placeId: "ChIJ-collection",
  address: "Royal Glamorgan Hospital, Llantrisant",
  latitude: 51.568,
  longitude: -3.391,
};

const DELIVERY = {
  placeId: "ChIJ-delivery",
  address: "University Hospital of Wales, Cardiff",
  latitude: 51.506,
  longitude: -3.191,
};

const CREATED_JOB = {
  id: "job-1",
  reference: "JB-0001",
  status: "new",
  sender: {
    name: "Dr. Smith",
    phone: "029 2074 7747",
    organisation: "Royal Glamorgan Hospital",
  },
  collection: COLLECTION,
  delivery: DELIVERY,
  contents: "Blood samples",
  serviceAreas: ["South"],
  createdAt: "2026-08-29T20:00:00.000000Z",
};

afterEach(() => {
  clearAuthToken();
  vi.unstubAllGlobals();
});

describe("createDeliveryJob", () => {
  it("POSTs the payload to /jobs and returns the created job", async () => {
    setAuthToken("test-token");
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => {
        return new Response(JSON.stringify(CREATED_JOB), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const payload = {
      sender: {
        name: "Dr. Smith",
        phone: "029 2074 7747",
        organisation: "Royal Glamorgan Hospital",
      },
      collection: COLLECTION,
      delivery: DELIVERY,
      contents: "Blood samples",
      serviceAreas: ["South"],
    };

    await expect(createDeliveryJob(payload)).resolves.toEqual(CREATED_JOB);

    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    const [url, init] = call ?? [];
    expect(String(url)).toMatch(/\/jobs$/);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual(payload);
  });
});

describe("jobErrorMessage", () => {
  it("prefers an ApiError message", () => {
    expect(jobErrorMessage(new ApiError(403, "Forbidden"), "fallback")).toBe(
      "Forbidden",
    );
  });

  it("returns the fallback when no message is present", () => {
    expect(jobErrorMessage({}, "Could not create the job. Try again.")).toBe(
      "Could not create the job. Try again.",
    );
  });
});
