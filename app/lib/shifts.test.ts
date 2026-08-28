import { afterEach, describe, expect, it, vi } from "vitest";

import { formatShiftStartedAt } from "~/lib/shifts";

afterEach(() => {
  vi.useRealTimers();
});

describe("formatShiftStartedAt", () => {
  it("labels a timestamp from today as Today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-28T12:00:00"));

    expect(formatShiftStartedAt("2026-08-28T08:15:00.000Z")).toMatch(
      /^Today, \d{2}:\d{2}$/,
    );
  });

  it("returns the original string when the timestamp is invalid", () => {
    expect(formatShiftStartedAt("not-a-date")).toBe("not-a-date");
  });
});
