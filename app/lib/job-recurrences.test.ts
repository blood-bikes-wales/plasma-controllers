import { afterEach, describe, expect, it, vi } from "vitest";
import { clearAuthToken, setAuthToken } from "~/lib/auth-token";
import {
  createJobRecurrence,
  fetchJobRecurrences,
  formatRecurrenceSchedule,
  pauseJobRecurrence,
} from "~/lib/job-recurrences";

afterEach(() => {
  clearAuthToken();
  vi.unstubAllGlobals();
});

describe("fetchJobRecurrences", () => {
  it("GETs /job-recurrences and returns data", async () => {
    setAuthToken("test-token");
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          data: [
            {
              id: "series-1",
              jobType: "standard",
              sender: { name: "A", phone: "029 2074 7747" },
              collection: {
                placeId: "a",
                address: "A",
                latitude: 1,
                longitude: 2,
              },
              delivery: {
                placeId: "b",
                address: "B",
                latitude: 3,
                longitude: 4,
              },
              contents: "Blood samples",
              serviceAreas: ["E"],
              timezone: "Europe/London",
              timeOfDay: "09:00",
              frequency: "weekly",
              byWeekday: [1, 3],
              startsOn: "2026-12-07",
              isActive: true,
              horizonDays: 14,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const series = await fetchJobRecurrences();
    expect(series).toHaveLength(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/job-recurrences");
  });
});

describe("createJobRecurrence", () => {
  it("POSTs the payload", async () => {
    setAuthToken("test-token");
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ id: "series-1", isActive: true }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await createJobRecurrence({
      jobType: "standard",
      sender: { name: "A", phone: "029 2074 7747" },
      collection: {
        placeId: "a",
        address: "A",
        latitude: 1,
        longitude: 2,
      },
      delivery: {
        placeId: "b",
        address: "B",
        latitude: 3,
        longitude: 4,
      },
      contents: "Blood samples",
      serviceAreas: ["E"],
      timeOfDay: "09:00",
      frequency: "daily",
      startsOn: "2026-12-07",
    });

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
  });
});

describe("pauseJobRecurrence", () => {
  it("POSTs pause", async () => {
    setAuthToken("test-token");
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ id: "series-1", isActive: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await pauseJobRecurrence("series-1");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/job-recurrences/series-1/pause",
    );
  });
});

describe("formatRecurrenceSchedule", () => {
  it("formats daily and weekly schedules", () => {
    expect(
      formatRecurrenceSchedule({
        id: "1",
        jobType: "standard",
        sender: { name: "A", phone: "1" },
        collection: {
          placeId: "a",
          address: "A",
          latitude: 1,
          longitude: 2,
        },
        delivery: {
          placeId: "b",
          address: "B",
          latitude: 3,
          longitude: 4,
        },
        contents: "Blood",
        serviceAreas: ["E"],
        timezone: "Europe/London",
        timeOfDay: "09:30",
        frequency: "daily",
        startsOn: "2026-12-07",
        isActive: true,
        horizonDays: 14,
      }),
    ).toBe("Daily at 09:30");

    expect(
      formatRecurrenceSchedule({
        id: "1",
        jobType: "standard",
        sender: { name: "A", phone: "1" },
        collection: {
          placeId: "a",
          address: "A",
          latitude: 1,
          longitude: 2,
        },
        delivery: {
          placeId: "b",
          address: "B",
          latitude: 3,
          longitude: 4,
        },
        contents: "Blood",
        serviceAreas: ["E"],
        timezone: "Europe/London",
        timeOfDay: "10:00:00",
        frequency: "weekly",
        byWeekday: [1, 5],
        startsOn: "2026-12-07",
        isActive: true,
        horizonDays: 14,
      }),
    ).toBe("Weekly Mon, Fri at 10:00");
  });
});
