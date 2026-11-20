import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "~/lib/api-client";
import { clearAuthToken, setAuthToken } from "~/lib/auth-token";
import {
  type CreateJobPayload,
  combineDayAndTime,
  createDeliveryJob,
  type DeliveryJob,
  displayJobReference,
  fetchJobById,
  fetchJobs,
  formatEstimatedTime,
  formatJobCreatedAt,
  formatMilkLitres,
  formatScheduledCollection,
  getJobDate,
  isMilkJob,
  isRelayJob,
  jobErrorMessage,
  needsMotherContact,
  scheduleJobCollection,
  upcomingCollectionAt,
  waitingForLegMessage,
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

describe("fetchJobById", () => {
  function stubFetch(status: number, body: unknown) {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    setAuthToken("test-token");
    return fetchMock;
  }

  it("loads one job from GET /jobs/{id} instead of searching the lists", async () => {
    const fetchMock = stubFetch(200, CREATED_JOB);

    await expect(fetchJobById("job-1")).resolves.toEqual(CREATED_JOB);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/\/jobs\/job-1$/);
  });

  it("is null when the API has no such job", async () => {
    stubFetch(404, { message: "No query results for model." });

    await expect(fetchJobById("missing")).resolves.toBeNull();
  });

  it("still throws on other failures", async () => {
    stubFetch(500, { message: "Server error" });

    await expect(fetchJobById("job-1")).rejects.toBeInstanceOf(ApiError);
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
  it("uses the created date when nothing is scheduled", () => {
    expect(getJobDate({ createdAt: "2026-03-10T09:00:00" })).toBe(
      "2026-03-10T09:00:00",
    );
    expect(
      getJobDate({
        createdAt: "2026-03-10T09:00:00",
        scheduledCollectionAt: null,
      }),
    ).toBe("2026-03-10T09:00:00");
    expect(getJobDate({ createdAt: null })).toBeNull();
  });

  it("prefers the scheduled collection time over the created date", () => {
    expect(
      getJobDate({
        createdAt: "2026-03-10T09:00:00",
        scheduledCollectionAt: "2026-03-17T10:00:00",
      }),
    ).toBe("2026-03-17T10:00:00");
  });
});

describe("formatScheduledCollection", () => {
  it("formats the day and the time", () => {
    // Local time (no "Z") so the label is the same in any timezone.
    expect(formatScheduledCollection("2026-08-29T14:30:00")).toBe(
      "Sat 29 Aug, 14:30",
    );
  });

  it("is empty when there is no usable time", () => {
    expect(formatScheduledCollection(null)).toBe("");
    expect(formatScheduledCollection(undefined)).toBe("");
    expect(formatScheduledCollection("not a date")).toBe("");
  });
});

describe("upcomingCollectionAt", () => {
  const at = "2026-12-01T10:00:00Z";

  it("returns the time for a New or Allocated job", () => {
    expect(
      upcomingCollectionAt({ status: "New", scheduledCollectionAt: at }),
    ).toBe(at);
    expect(
      upcomingCollectionAt({ status: "Allocated", scheduledCollectionAt: at }),
    ).toBe(at);
  });

  it("is null when unscheduled or once collected, delivered or cancelled", () => {
    expect(
      upcomingCollectionAt({ status: "New", scheduledCollectionAt: null }),
    ).toBeNull();
    expect(upcomingCollectionAt({ status: "New" })).toBeNull();
    for (const status of ["Collected", "Delivered", "Cancelled"]) {
      expect(
        upcomingCollectionAt({ status, scheduledCollectionAt: at }),
      ).toBeNull();
    }
  });
});

describe("needsMotherContact", () => {
  const unscheduledMilk = {
    jobType: "milk",
    status: "New",
    needsMotherContact: true,
    scheduledCollectionAt: null,
  };

  it("is true for an unscheduled new milk job the API flags", () => {
    expect(needsMotherContact(unscheduledMilk)).toBe(true);
  });

  it("is false for a standard job even when flagged", () => {
    expect(
      needsMotherContact({ ...unscheduledMilk, jobType: "standard" }),
    ).toBe(false);
    expect(needsMotherContact({ ...unscheduledMilk, jobType: undefined })).toBe(
      false,
    );
  });

  it("is false when the flag is false or absent (other roles, older API)", () => {
    expect(
      needsMotherContact({ ...unscheduledMilk, needsMotherContact: false }),
    ).toBe(false);
    expect(
      needsMotherContact({ ...unscheduledMilk, needsMotherContact: undefined }),
    ).toBe(false);
  });

  it("is false once a time is set or the job has moved on", () => {
    expect(
      needsMotherContact({
        ...unscheduledMilk,
        scheduledCollectionAt: "2026-12-01T10:00:00Z",
      }),
    ).toBe(false);
    expect(
      needsMotherContact({ ...unscheduledMilk, status: "Allocated" }),
    ).toBe(false);
  });
});

describe("scheduleJobCollection", () => {
  it("POSTs the time to /jobs/{id}/schedule and returns the job", async () => {
    const scheduled = {
      ...CREATED_JOB,
      scheduledCollectionAt: "2026-12-01T10:00:00.000Z",
    };
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify(scheduled), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    setAuthToken("test-token");

    await expect(
      scheduleJobCollection("job-1", "2026-12-01T10:00:00.000Z"),
    ).resolves.toEqual(scheduled);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toMatch(/\/jobs\/job-1\/schedule$/);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      scheduledCollectionAt: "2026-12-01T10:00:00.000Z",
    });
  });

  it("throws an ApiError when the API refuses the time", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ message: "Nope", errors: {} }), {
            status: 422,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
    setAuthToken("test-token");

    await expect(
      scheduleJobCollection("job-1", "2020-01-01T00:00:00.000Z"),
    ).rejects.toBeInstanceOf(ApiError);
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

describe("waitingForLegMessage", () => {
  it("names the leg that must be delivered first", () => {
    expect(waitingForLegMessage({ waitingForLeg: 2 })).toBe(
      "Waiting for leg 2 to be delivered",
    );
  });

  it("is null when nothing is holding the leg back or the API does not say", () => {
    expect(waitingForLegMessage({ waitingForLeg: null })).toBeNull();
    expect(waitingForLegMessage({})).toBeNull();
  });
});
