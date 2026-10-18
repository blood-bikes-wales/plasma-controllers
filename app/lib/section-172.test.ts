import { describe, expect, it } from "vitest";

import {
  formatShiftWindow,
  lookupSection172Rider,
  normalizeRegistration,
  wallClockMinutes,
} from "./section-172";

describe("normalizeRegistration", () => {
  it("strips spaces and uppercases", () => {
    expect(normalizeRegistration(" cf14 abc ")).toBe("CF14ABC");
  });
});

describe("wallClockMinutes", () => {
  it("parses datetime-local values", () => {
    expect(wallClockMinutes("2026-03-10T14:30")).toBe(
      Date.UTC(2026, 2, 10, 14, 30) / 60_000,
    );
  });

  it("returns null for invalid values", () => {
    expect(wallClockMinutes("not-a-date")).toBeNull();
  });
});

describe("lookupSection172Rider", () => {
  it("returns a single match for the demo registration and time", () => {
    const result = lookupSection172Rider("CF14 ABC", "2026-03-10T14:30");

    expect(result.status).toBe("match");
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({
      membershipNumber: "100001",
      riderName: "Ian Davis",
      registration: "CF14 ABC",
    });
  });

  it("returns no match when nothing covers the time", () => {
    const result = lookupSection172Rider("CF14 ABC", "2026-03-10T20:00");

    expect(result).toEqual({ status: "none", matches: [] });
  });

  it("returns ambiguous when two riders overlap", () => {
    const result = lookupSection172Rider("LL57 XYZ", "2026-03-12T09:15");

    expect(result.status).toBe("ambiguous");
    expect(result.matches.map((match) => match.membershipNumber)).toEqual([
      "100001",
      "100842",
    ]);
  });
});

describe("formatShiftWindow", () => {
  it("formats a wall-clock window for display", () => {
    expect(formatShiftWindow("2026-03-10T08:00", "2026-03-10T16:00")).toBe(
      "10 Mar 2026, 08:00 – 16:00",
    );
  });
});
