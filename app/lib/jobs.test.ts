import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "~/lib/api-client";
import { clearAuthToken, setAuthToken } from "~/lib/auth-token";
import {
  type CreateJobPayload,
  combineDayAndTime,
  createDeliveryJob,
  type DeliveryJob,
  displayJobReference,
  fetchJobs,
  formatEstimatedTime,
  formatJobCreatedAt,
  formatMilkLitres,
  getJobDate,
  isMilkJob,
  isRelayJob,
  jobErrorMessage,
} from "~/lib/jobs";

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
  serviceAreas: ["E"],
  createdAt: "2026-08-29T20:00:00.000000Z",
};

afterEach(() => {
  clearAuthToken();
  vi.unstubAllGlobals();
  vi.useRealTimers();
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

    const payload: CreateJobPayload = {
      jobType: "standard",
      sender: {
        name: "Dr. Smith",
        phone: "029 2074 7747",
        organisation: "Royal Glamorgan Hospital",
      },
      collection: COLLECTION,
      delivery: DELIVERY,
      contents: "Blood samples",
      serviceAreas: ["E"],
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

describe("fetchJobs", () => {
  it("loads jobs for the requested scope", async () => {
    setAuthToken("test-token");
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => {
        return new Response(JSON.stringify({ data: [CREATED_JOB] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchJobs("active")).resolves.toEqual([CREATED_JOB]);

    const call = fetchMock.mock.calls[0];
    expect(String(call?.[0])).toMatch(/\/jobs\/active$/);
  });
});

describe("displayJobReference", () => {
  it("prefers the API reference and falls back to the last six characters of the id", () => {
    expect(
      displayJobReference({ id: "abcdef123456", reference: "JB-1042" }),
    ).toBe("JB-1042");
    expect(displayJobReference({ id: "abcdef123456", reference: "  " })).toBe(
      "123456",
    );
  });
});

describe("formatJobCreatedAt", () => {
  it("labels a timestamp from today as Today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-29T12:00:00"));

    expect(formatJobCreatedAt("2026-08-29T09:42:00.000Z")).toMatch(
      /^Today, \d{2}:\d{2}$/,
    );
  });

  it("returns the original string when the timestamp is invalid", () => {
    expect(formatJobCreatedAt("not-a-date")).toBe("not-a-date");
  });
});

describe("formatEstimatedTime", () => {
  it("returns an empty string when there is no estimate", () => {
    expect(formatEstimatedTime(null)).toBe("");
    expect(formatEstimatedTime(undefined)).toBe("");
  });

  it("labels an estimate for today with just the time", () => {
    const nineThirty = new Date();
    nineThirty.setHours(9, 30, 0, 0);

    expect(formatEstimatedTime(nineThirty.toISOString())).toBe("Today, 09:30");
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

describe("isRelayJob", () => {
  it("treats a relay parent and a relay leg as relay, anything else as normal", () => {
    expect(isRelayJob({})).toBe(false);
    expect(isRelayJob({ isRelay: false, parentJobId: null, legs: [] })).toBe(
      false,
    );
    expect(isRelayJob({ isRelay: true })).toBe(true);
    expect(isRelayJob({ legs: [{} as DeliveryJob] })).toBe(true);
    expect(isRelayJob({ parentJobId: "parent-1" })).toBe(true);
    expect(isRelayJob({ legNumber: 1 })).toBe(true);
  });
});

describe("combineDayAndTime", () => {
  it("combines the local day of a timestamp with a HH:mm time", () => {
    const iso = combineDayAndTime("2026-03-10T09:00:00", "14:30");
    const date = new Date(iso ?? "");
    expect([
      date.getFullYear(),
      date.getMonth() + 1,
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
    ]).toEqual([2026, 3, 10, 14, 30]);
  });

  it("returns undefined for a missing day or an invalid time", () => {
    expect(combineDayAndTime(null, "14:30")).toBeUndefined();
    expect(combineDayAndTime("not-a-date", "14:30")).toBeUndefined();
    expect(combineDayAndTime("2026-03-10T09:00:00", "")).toBeUndefined();
    expect(combineDayAndTime("2026-03-10T09:00:00", "25:00")).toBeUndefined();
  });
});

describe("getJobDate", () => {
  it("uses the created date", () => {
    expect(getJobDate({ createdAt: "2026-03-10T09:00:00" })).toBe(
      "2026-03-10T09:00:00",
    );
    expect(getJobDate({ createdAt: null })).toBeNull();
  });
});

describe("formatMilkLitres", () => {
  it("formats litres without trailing zeros", () => {
    expect(formatMilkLitres(2.5)).toBe("2.5 L");
    expect(formatMilkLitres(2)).toBe("2 L");
    expect(formatMilkLitres(0.25)).toBe("0.25 L");
    expect(formatMilkLitres(100)).toBe("100 L");
  });

  it("returns an empty string when there is no quantity", () => {
    expect(formatMilkLitres(null)).toBe("");
    expect(formatMilkLitres(undefined)).toBe("");
    expect(formatMilkLitres(Number.NaN)).toBe("");
  });
});

describe("isMilkJob", () => {
  it("is true only for milk jobs", () => {
    expect(isMilkJob({ jobType: "milk" })).toBe(true);
    expect(isMilkJob({ jobType: "standard" })).toBe(false);
    expect(isMilkJob({})).toBe(false);
  });
});
