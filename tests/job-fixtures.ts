import { vi } from "vitest";

import type { AuthUser } from "~/lib/auth";
import type {
  DeliveryJob,
  JobLifecycleAction,
  PlaceLocation,
} from "~/lib/jobs";
import type { ActiveShift } from "~/lib/shifts";

const GLAMORGAN = {
  placeId: "ChIJ-glamorgan",
  address: "Royal Glamorgan Hospital",
  latitude: 51.568,
  longitude: -3.391,
};

const UHW = {
  placeId: "ChIJ-uhw",
  address: "University Hospital of Wales",
  latitude: 51.506,
  longitude: -3.191,
};

const PRINCE_CHARLES = {
  placeId: "ChIJ-prince-charles",
  address: "Prince Charles Hospital",
  latitude: 51.752,
  longitude: -3.373,
};

const GWENT = {
  placeId: "ChIJ-gwent",
  address: "Royal Gwent Hospital",
  latitude: 51.584,
  longitude: -2.996,
};

const NEVILL_HALL = {
  placeId: "ChIJ-nevill-hall",
  address: "Nevill Hall Hospital",
  latitude: 51.83,
  longitude: -3.027,
};

function job(
  overrides: Partial<DeliveryJob> & Pick<DeliveryJob, "id">,
): DeliveryJob {
  return {
    reference: "JB-0000",
    status: "New",
    sender: {
      name: "Dr. Patel",
      phone: "029 2074 7747",
      organisation: null,
    },
    collection: GLAMORGAN,
    delivery: UHW,
    contents: "Blood samples",
    serviceAreas: ["E"],
    createdAt: "2026-08-29T10:00:00.000Z",
    allowedActions: ["allocate", "cancel", "relay"],
    ...overrides,
  };
}

export const mockActiveJobs: DeliveryJob[] = [
  job({
    id: "11111111-1111-1111-1111-111111111111",
    reference: "JB-1042",
    status: "New",
    collection: GLAMORGAN,
    delivery: UHW,
    createdAt: "2026-08-29T10:02:00.000Z",
    allowedActions: ["allocate", "cancel", "relay"],
  }),
  job({
    id: "22222222-2222-2222-2222-222222222222",
    reference: "JB-1038",
    status: "Allocated",
    collection: PRINCE_CHARLES,
    delivery: GWENT,
    createdAt: "2026-08-29T09:50:00.000Z",
    allowedActions: ["allocate", "collect", "cancel"],
    allocatedRider: {
      id: "100001",
      name: "Alex Morgan",
      shiftId: "shift-1",
      allocatedAt: "2026-08-29T09:55:00.000Z",
    },
  }),
];

export const mockCompletedJobs: DeliveryJob[] = [
  job({
    id: "10110110-1111-1111-1111-111111111101",
    reference: "JB-1020",
    status: "Delivered",
    collection: GLAMORGAN,
    delivery: UHW,
    createdAt: "2026-08-29T09:42:00.000Z",
    allowedActions: [],
  }),
  job({
    id: "10310310-1111-1111-1111-111111111103",
    reference: "JB-1012",
    status: "Cancelled",
    collection: NEVILL_HALL,
    delivery: GLAMORGAN,
    createdAt: "2026-08-28T21:30:00.000Z",
    allowedActions: [],
  }),
];

/** Riders on an active shift, as GET /shifts/active lists them. */
export const mockActiveShifts: ActiveShift[] = [
  {
    id: "shift-1",
    riderId: "100001",
    riderName: "Alex Morgan",
    bikeId: "bike-1",
    bikeRegistration: "CF12 ABC",
    startMileage: 12000,
    startedAt: "2026-08-29T08:00:00.000Z",
  },
  {
    id: "shift-2",
    riderId: "100002",
    riderName: "Sam Taylor",
    bikeId: "bike-2",
    bikeRegistration: "CF34 DEF",
    startMileage: 8000,
    startedAt: "2026-08-29T08:30:00.000Z",
  },
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function applyLifecycleAction(
  current: DeliveryJob,
  action: JobLifecycleAction,
  payload: Record<string, unknown>,
  shifts: ActiveShift[] = mockActiveShifts,
): DeliveryJob {
  if (action === "allocate") {
    // Like the API: Allocate also works on an Allocated job (it changes the rider).
    const shift =
      shifts.find((candidate) => candidate.id === payload.shiftId) ?? shifts[0];
    return {
      ...current,
      status: "Allocated",
      allowedActions: ["allocate", "collect", "cancel"],
      allocatedRider: {
        id: shift?.riderId ?? "100001",
        name: shift?.riderName ?? "Alex Morgan",
        shiftId: String(payload.shiftId ?? "shift-1"),
        allocatedAt: new Date().toISOString(),
      },
    };
  }

  if (action === "collect") {
    return {
      ...current,
      status: "Collected",
      allowedActions: ["deliver", "cancel"],
      collectionRecord: {
        contentsConfirmed: Boolean(payload.contentsConfirmed),
        receiptNumber: String(payload.receiptNumber ?? "RCP-1"),
        collectedAt: new Date().toISOString(),
      },
    };
  }

  if (action === "deliver") {
    return {
      ...current,
      status: "Delivered",
      allowedActions: [],
      deliveryRecord: {
        recipient:
          payload.noRecipient === true
            ? null
            : String(payload.recipient ?? "Recipient"),
        noRecipient: payload.noRecipient === true,
        deliveredAt: new Date().toISOString(),
      },
    };
  }

  return {
    ...current,
    status: "Cancelled",
    allowedActions: [],
    cancellation: {
      reason:
        typeof payload.reason === "string" && payload.reason.length > 0
          ? payload.reason
          : null,
      cancelledAt: new Date().toISOString(),
    },
  };
}

function buildRelayLegs(
  parent: DeliveryJob,
  rendezvousPoints: PlaceLocation[],
): DeliveryJob[] {
  const points = [parent.collection, ...rendezvousPoints, parent.delivery];

  return points.slice(0, -1).map((collection, index) => {
    const delivery = points[index + 1];
    return job({
      id: `${parent.id}-leg-${index + 1}`,
      reference: `${parent.reference}-L${index + 1}`,
      status: "New",
      parentJobId: parent.id,
      legNumber: index + 1,
      collection,
      delivery,
      allowedActions: ["allocate", "cancel"],
    });
  });
}

function applyRelayConversion(
  parent: DeliveryJob,
  rendezvousPoints: PlaceLocation[],
): DeliveryJob {
  const legs = buildRelayLegs(parent, rendezvousPoints);

  return {
    ...parent,
    isRelay: true,
    allowedActions: ["cancel"],
    legs,
  };
}

export function stubJobsFetch(
  user: AuthUser,
  {
    active = mockActiveJobs,
    completed = mockCompletedJobs,
    olderCompleted = [],
    failSettingsSave = false,
    activeShifts = mockActiveShifts,
    allocateError,
    allocateFailure,
  }: {
    active?: DeliveryJob[];
    completed?: DeliveryJob[];
    /**
     * Completed jobs the API only lists once the user's `showCompletedJobs`
     * setting is on (it hides them 24 hours after completion otherwise). They
     * still open by id either way.
     */
    olderCompleted?: DeliveryJob[];
    /** Make PATCH /me fail with a 500. */
    failSettingsSave?: boolean;
    /** What GET /shifts/active lists. Empty means nobody is on shift. */
    activeShifts?: ActiveShift[];
    /** Make POST .../actions/allocate fail with this 422 message. */
    allocateError?: string;
    /** Make POST .../actions/allocate fail with this exact response (status, message and field errors). */
    allocateFailure?: {
      status: number;
      message: string;
      errors?: Record<string, string[]>;
    };
  } = {},
) {
  const activeState = [...active];
  const completedState = [...completed];
  const legState: DeliveryJob[] = [];
  // The API keeps the setting per user, so it outlives any one render.
  let settings = { ...user.settings };

  function allKnownJobs(): DeliveryJob[] {
    return [...activeState, ...completedState, ...olderCompleted, ...legState];
  }

  function findJob(jobId: string): DeliveryJob | undefined {
    const known = allKnownJobs();
    const direct = known.find((candidate) => candidate.id === jobId);
    if (direct) {
      return direct;
    }

    // Like the API, open a relay leg by its own id.
    for (const parent of known) {
      const leg = parent.legs?.find((candidate) => candidate.id === jobId);
      if (leg) {
        return leg;
      }
    }

    return undefined;
  }

  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method?.toUpperCase() ?? "GET";

    if (method === "PATCH" && url.endsWith("/me")) {
      if (failSettingsSave) {
        return jsonResponse({ message: "Could not save your setting." }, 500);
      }

      const body = init?.body ? JSON.parse(String(init.body)) : {};
      settings = { showCompletedJobs: body.showCompletedJobs === true };
      return jsonResponse({ ...user, settings });
    }

    if (url.includes("/me")) {
      return jsonResponse({ ...user, settings });
    }

    if (url.includes("/shifts/active")) {
      return jsonResponse({ data: activeShifts });
    }

    const scheduleMatch = url.match(/\/jobs\/([^/]+)\/schedule$/);
    if (method === "POST" && scheduleMatch) {
      const jobId = decodeURIComponent(scheduleMatch[1]);
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      const current = findJob(jobId);
      if (!current) {
        return jsonResponse({ message: "Not found" }, 404);
      }

      // The API's rules: only a New or Allocated job, and a milk job needs a future time.
      if (current.status !== "New" && current.status !== "Allocated") {
        return jsonResponse(
          {
            message: "Only a New or Allocated job can be scheduled.",
            errors: { job: ["Only a New or Allocated job can be scheduled."] },
          },
          422,
        );
      }

      const at = new Date(String(body.scheduledCollectionAt ?? ""));
      if (
        Number.isNaN(at.getTime()) ||
        (current.jobType === "milk" && at.getTime() <= Date.now())
      ) {
        return jsonResponse(
          {
            message: "Choose a collection time in the future.",
            errors: {
              scheduledCollectionAt: [
                "Choose a collection time in the future.",
              ],
            },
          },
          422,
        );
      }

      const updated: DeliveryJob = {
        ...current,
        scheduledCollectionAt: at.toISOString(),
        ...("needsMotherContact" in current
          ? { needsMotherContact: false }
          : {}),
      };
      const activeIndex = activeState.findIndex(
        (candidate) => candidate.id === jobId,
      );
      if (activeIndex >= 0) {
        activeState[activeIndex] = updated;
      }

      return jsonResponse(updated);
    }

    if (method === "POST" && url.includes("/jobs/") && url.includes("/relay")) {
      const jobId = url.split("/jobs/")[1]?.split("/")[0] ?? "";
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      const current = findJob(jobId);
      if (!current) {
        return jsonResponse({ message: "Not found" }, 404);
      }

      const rendezvousPoints = Array.isArray(body.rendezvousPoints)
        ? body.rendezvousPoints
        : [];
      const updated = applyRelayConversion(current, rendezvousPoints);
      const activeIndex = activeState.findIndex(
        (candidate) => candidate.id === jobId,
      );
      if (activeIndex >= 0) {
        activeState[activeIndex] = updated;
      }

      legState.push(...(updated.legs ?? []));
      return jsonResponse(updated);
    }

    if (
      method === "POST" &&
      url.includes("/jobs/") &&
      url.includes("/cancel")
    ) {
      const jobId = url.split("/jobs/")[1]?.split("/")[0] ?? "";
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      const current = findJob(jobId);
      if (!current) {
        return jsonResponse({ message: "Not found" }, 404);
      }

      const updated = applyLifecycleAction(current, "cancel", body);
      if (updated.status !== "Cancelled") {
        return jsonResponse(updated);
      }

      const activeIndex = activeState.findIndex(
        (candidate) => candidate.id === jobId,
      );
      if (activeIndex >= 0) {
        activeState.splice(activeIndex, 1);
        completedState.unshift(updated);
        return jsonResponse(updated);
      }

      const legIndex = legState.findIndex(
        (candidate) => candidate.id === jobId,
      );
      if (legIndex >= 0) {
        legState[legIndex] = updated;
      }

      return jsonResponse(updated);
    }

    const actionMatch = url.match(/\/jobs\/([^/]+)\/actions\/([^/]+)$/);
    if (method === "POST" && actionMatch) {
      const [, jobId, action] = actionMatch;
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      const current = findJob(jobId);
      if (!current) {
        return jsonResponse({ message: "Not found" }, 404);
      }

      const lifecycleAction = action as JobLifecycleAction;
      if (lifecycleAction === "allocate" && allocateFailure) {
        return jsonResponse(
          {
            message: allocateFailure.message,
            ...(allocateFailure.errors
              ? { errors: allocateFailure.errors }
              : {}),
          },
          allocateFailure.status,
        );
      }

      if (lifecycleAction === "allocate" && allocateError) {
        return jsonResponse(
          { message: allocateError, errors: { shiftId: [allocateError] } },
          422,
        );
      }

      const updated = applyLifecycleAction(
        current,
        lifecycleAction,
        body,
        activeShifts,
      );
      const activeIndex = activeState.findIndex(
        (candidate) => candidate.id === jobId,
      );
      if (activeIndex >= 0) {
        if (updated.status === "Delivered") {
          activeState.splice(activeIndex, 1);
          completedState.unshift(updated);
          return jsonResponse(updated);
        }

        if (updated.status === "Cancelled") {
          activeState.splice(activeIndex, 1);
          completedState.unshift(updated);
          return jsonResponse(updated);
        }

        activeState[activeIndex] = updated;
        return jsonResponse(updated);
      }

      const legIndex = legState.findIndex(
        (candidate) => candidate.id === jobId,
      );
      if (legIndex < 0) {
        return jsonResponse(updated);
      }

      legState[legIndex] = updated;
      const parentId = updated.parentJobId;
      if (!parentId) {
        return jsonResponse(updated);
      }

      const parentIndex = activeState.findIndex(
        (candidate) => candidate.id === parentId,
      );
      if (parentIndex < 0) {
        return jsonResponse(updated);
      }

      const parent = activeState[parentIndex];
      const nextLegs = (parent.legs ?? []).map((leg) =>
        leg.id === updated.id ? updated : leg,
      );
      const statuses = nextLegs.map((leg) => leg.status);
      let parentStatus = parent.status;
      if (statuses.every((status) => status === "Delivered")) {
        parentStatus = "Delivered";
      }
      if (statuses.some((status) => status === "Allocated")) {
        parentStatus = "Allocated";
      }

      activeState[parentIndex] = {
        ...parent,
        status: parentStatus,
        legs: nextLegs,
      };

      return jsonResponse(updated);
    }

    if (url.includes("/jobs/completed")) {
      return jsonResponse({
        data: settings.showCompletedJobs
          ? [...completedState, ...olderCompleted]
          : completedState,
      });
    }
    if (url.includes("/jobs/active")) {
      return jsonResponse({ data: activeState });
    }

    const showMatch = url.match(/\/jobs\/([^/]+)$/);
    if (method === "GET" && showMatch) {
      const found = findJob(decodeURIComponent(showMatch[1]));
      return found
        ? jsonResponse(found)
        : jsonResponse({ message: "No query results for model." }, 404);
    }

    return jsonResponse({ message: "Not found" }, 404);
  });
}
