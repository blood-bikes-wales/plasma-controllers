export type Section172RiderMatch = {
  membershipNumber: string;
  riderName: string;
  registration: string;
  /** Wall-clock local time (YYYY-MM-DDTHH:mm), not a zoned instant. */
  shiftStartedAt: string;
  /** Wall-clock local time (YYYY-MM-DDTHH:mm), not a zoned instant. */
  shiftEndedAt: string;
};

export type Section172LookupResult =
  | { status: "none"; matches: [] }
  | { status: "match"; matches: [Section172RiderMatch] }
  | { status: "ambiguous"; matches: Section172RiderMatch[] };

type FixtureRide = Section172RiderMatch;

/**
 * Local demo fixtures only — no API. Known cases:
 * - CF14 ABC @ 2026-03-10T14:30 → single match (Ian Davis / 100001)
 * - LL57 XYZ @ 2026-03-12T09:15 → ambiguous (two Ian Davises)
 * - anything else → no match
 *
 * Shift windows use the same wall-clock format as `<input type="datetime-local">`
 * so lookup does not depend on the machine timezone.
 */
const FIXTURE_RIDES: readonly FixtureRide[] = [
  {
    membershipNumber: "100001",
    riderName: "Ian Davis",
    registration: "CF14 ABC",
    shiftStartedAt: "2026-03-10T08:00",
    shiftEndedAt: "2026-03-10T16:00",
  },
  {
    membershipNumber: "100001",
    riderName: "Ian Davis",
    registration: "LL57 XYZ",
    shiftStartedAt: "2026-03-12T07:00",
    shiftEndedAt: "2026-03-12T12:00",
  },
  {
    membershipNumber: "100842",
    riderName: "Ian Davis",
    registration: "LL57 XYZ",
    shiftStartedAt: "2026-03-12T08:00",
    shiftEndedAt: "2026-03-12T15:00",
  },
];

export function normalizeRegistration(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

/** Parse datetime-local (or ISO prefix) as comparable wall-clock minutes. */
export function wallClockMinutes(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  return Date.UTC(year, month - 1, day, hour, minute) / 60_000;
}

export function lookupSection172Rider(
  registration: string,
  incidentAtLocal: string,
): Section172LookupResult {
  const normalized = normalizeRegistration(registration);
  if (!normalized) {
    return { status: "none", matches: [] };
  }

  const incidentMinutes = wallClockMinutes(incidentAtLocal);
  if (incidentMinutes == null) {
    return { status: "none", matches: [] };
  }

  const matches = FIXTURE_RIDES.filter((ride) => {
    if (normalizeRegistration(ride.registration) !== normalized) {
      return false;
    }

    const start = wallClockMinutes(ride.shiftStartedAt);
    const end = wallClockMinutes(ride.shiftEndedAt);
    if (start == null || end == null) {
      return false;
    }

    return incidentMinutes >= start && incidentMinutes <= end;
  });

  if (matches.length === 0) {
    return { status: "none", matches: [] };
  }

  if (matches.length === 1) {
    return { status: "match", matches: [matches[0]] };
  }

  return { status: "ambiguous", matches };
}

export function formatShiftWindow(startedAt: string, endedAt: string): string {
  const startMatch = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(startedAt);
  const endMatch = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(endedAt);
  if (!startMatch || !endMatch) {
    return "Unknown shift window";
  }

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const day = Number(startMatch[3]);
  const month = months[Number(startMatch[2]) - 1];
  const year = startMatch[1];
  const startTime = `${startMatch[4]}:${startMatch[5]}`;
  const endTime = `${endMatch[4]}:${endMatch[5]}`;

  return `${day} ${month} ${year}, ${startTime} – ${endTime}`;
}
