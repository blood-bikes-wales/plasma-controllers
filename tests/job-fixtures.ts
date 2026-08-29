import { vi } from "vitest";

import type { AuthUser } from "~/lib/auth";
import type {
  DeliveryJob,
  JobLifecycleAction,
  PlaceLocation,
} from "~/lib/jobs";

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
    serviceAreas: ["South"],
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
    allowedActions: ["collect", "cancel"],
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
): DeliveryJob {
  if (action === "allocate") {
    return {
      ...current,
      status: "Allocated",
      allowedActions: ["collect", "cancel"],
      allocatedRider: {
        id: "100001",
        name: "Alex Morgan",
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
        suitablySealed: Boolean(payload.suitablySealed),
        sealNumber:
          typeof payload.sealNumber === "string" ? payload.sealNumber : null,
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
        recipient: String(payload.recipient ?? "Recipient"),
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
  }: { active?: DeliveryJob[]; completed?: DeliveryJob[] } = {},
) {
  const activeState = [...active];
  const completedState = [...completed];
  const legState: DeliveryJob[] = [];

  function allKnownJobs(): DeliveryJob[] {
    return [...activeState, ...completedState, ...legState];
  }

  function findJob(jobId: string): DeliveryJob | undefined {
    return allKnownJobs().find((candidate) => candidate.id === jobId);
  }

  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method?.toUpperCase() ?? "GET";

    if (url.includes("/me")) {
      return jsonResponse(user);
    }

    if (url.includes("/shifts/active")) {
      return jsonResponse({
        data: [
          {
            id: "shift-1",
            riderId: "100001",
            riderName: "Alex Morgan",
            bikeId: "bike-1",
            bikeRegistration: "CF12 ABC",
            startMileage: 12000,
            startedAt: "2026-08-29T08:00:00.000Z",
          },
        ],
      });
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
      const updated = applyLifecycleAction(current, lifecycleAction, body);
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
      return jsonResponse({ data: completedState });
    }
    if (url.includes("/jobs/active")) {
      return jsonResponse({ data: activeState });
    }

    return jsonResponse({ message: "Not found" }, 404);
  });
}
