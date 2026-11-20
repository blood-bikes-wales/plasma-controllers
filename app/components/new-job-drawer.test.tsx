import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "~/lib/api-client";
import type { CreateJobPayload, DeliveryJob, PlaceLocation } from "~/lib/jobs";
import type { PlacesLookup } from "~/lib/places";
import {
  clearSavedLocations,
  recentLocations,
  SAVED_LOCATIONS_KEY,
} from "~/lib/saved-locations";
import { mockServiceAreas } from "../../tests/service-area-fixtures";
import { NewJobDrawer } from "./new-job-drawer";

const COLLECTION: PlaceLocation = {
  placeId: "ChIJ-collection",
  address: "Royal Glamorgan Hospital, Llantrisant",
  latitude: 51.568,
  longitude: -3.391,
};

const DELIVERY: PlaceLocation = {
  placeId: "ChIJ-delivery",
  address: "University Hospital of Wales, Cardiff",
  latitude: 51.506,
  longitude: -3.191,
};

const CREATED_JOB: DeliveryJob = {
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

function stubLookup(): PlacesLookup {
  return {
    suggest: async (query: string) => {
      const haystacks = [
        { placeId: COLLECTION.placeId, description: COLLECTION.address },
        { placeId: DELIVERY.placeId, description: DELIVERY.address },
      ];
      return haystacks.filter((item) =>
        item.description.toLowerCase().includes(query.toLowerCase()),
      );
    },
    details: async (placeId: string) => {
      if (placeId === COLLECTION.placeId) {
        return COLLECTION;
      }
      return DELIVERY;
    },
  };
}

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Caller name"), "Dr. Smith");
  await user.type(screen.getByLabelText("Contact number"), "029 2074 7747");
  await user.type(
    screen.getByLabelText(/organisation/i),
    "Royal Glamorgan Hospital",
  );

  await user.type(screen.getByLabelText("Collection location"), "Royal");
  await user.click(
    await screen.findByRole("option", { name: COLLECTION.address }),
  );
  await screen.findByDisplayValue(COLLECTION.address);

  await user.type(screen.getByLabelText("Delivery location"), "University");
  await user.click(
    await screen.findByRole("option", { name: DELIVERY.address }),
  );
  await screen.findByDisplayValue(DELIVERY.address);

  await user.type(
    screen.getByLabelText("Item or contents description"),
    "Blood samples",
  );
  await user.click(screen.getByRole("checkbox", { name: "East" }));
}

afterEach(() => {
  clearSavedLocations();
});

describe("NewJobDrawer", () => {
  it("renders the intake form when open", () => {
    render(
      <NewJobDrawer
        serviceAreas={mockServiceAreas}
        open
        onOpenChange={() => {}}
        placesLookup={stubLookup()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "New Job", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Caller name")).toBeInTheDocument();
    expect(screen.getByLabelText("Contact number")).toBeInTheDocument();
    expect(screen.getByLabelText(/organisation/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Collection location")).toBeInTheDocument();
    expect(screen.getByLabelText("Delivery location")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Item or contents description"),
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "East" })).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "North West" }),
    ).toBeInTheDocument();
  });

  it("renders footer actions", () => {
    render(
      <NewJobDrawer
        serviceAreas={mockServiceAreas}
        open
        onOpenChange={() => {}}
        placesLookup={stubLookup()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Create job" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("calls onOpenChange when cancel is clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <NewJobDrawer
        serviceAreas={mockServiceAreas}
        open
        onOpenChange={onOpenChange}
        placesLookup={stubLookup()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("resets form fields when closed and reopened", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    const { rerender } = render(
      <NewJobDrawer
        serviceAreas={mockServiceAreas}
        open
        onOpenChange={onOpenChange}
        placesLookup={stubLookup()}
      />,
    );

    await user.type(screen.getByLabelText("Caller name"), "Dr. Smith");
    rerender(
      <NewJobDrawer
        serviceAreas={mockServiceAreas}
        open={false}
        onOpenChange={onOpenChange}
        placesLookup={stubLookup()}
      />,
    );
    rerender(
      <NewJobDrawer
        serviceAreas={mockServiceAreas}
        open
        onOpenChange={onOpenChange}
        placesLookup={stubLookup()}
      />,
    );

    expect(screen.getByLabelText("Caller name")).toHaveValue("");
  });

  it("does not render content when closed", () => {
    render(
      <NewJobDrawer
        serviceAreas={mockServiceAreas}
        open={false}
        onOpenChange={() => {}}
        placesLookup={stubLookup()}
      />,
    );

    expect(
      screen.queryByRole("heading", { name: "New Job" }),
    ).not.toBeInTheDocument();
  });

  it("blocks creating and shows inline errors when required fields are empty", async () => {
    const user = userEvent.setup();
    const createJob = vi.fn();

    render(
      <NewJobDrawer
        serviceAreas={mockServiceAreas}
        open
        onOpenChange={() => {}}
        placesLookup={stubLookup()}
        createJob={createJob}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Create job" }));

    expect(createJob).not.toHaveBeenCalled();
    expect(screen.getByText("Enter the caller's name")).toBeInTheDocument();
    expect(screen.getByText("Enter a contact number")).toBeInTheDocument();
    expect(
      screen.getByText("Choose a collection location from the place search"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Choose a delivery location from the place search"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Describe the item or contents"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Choose at least one service area"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Caller name")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("shows the UK phone message and blocks submit on an invalid number", async () => {
    const user = userEvent.setup();
    const createJob = vi.fn();

    render(
      <NewJobDrawer
        serviceAreas={mockServiceAreas}
        open
        onOpenChange={() => {}}
        placesLookup={stubLookup()}
        createJob={createJob}
      />,
    );

    await fillRequiredFields(user);
    const phone = screen.getByLabelText("Contact number");
    await user.clear(phone);
    await user.type(phone, "abc");
    await user.click(screen.getByRole("button", { name: "Create job" }));

    expect(createJob).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        "Enter a valid UK phone number, for example 029 2074 7747",
      ),
    ).toBeInTheDocument();
    expect(phone).toHaveAttribute("aria-invalid", "true");
  });

  it("clears a field's error as soon as it is edited", async () => {
    const user = userEvent.setup();

    render(
      <NewJobDrawer
        serviceAreas={mockServiceAreas}
        open
        onOpenChange={() => {}}
        placesLookup={stubLookup()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Create job" }));
    expect(screen.getByText("Enter the caller's name")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Caller name"), "Dr. Smith");

    expect(
      screen.queryByText("Enter the caller's name"),
    ).not.toBeInTheDocument();
  });

  it("creates a job and records the chosen locations", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    const createJob = vi.fn(async (_payload: CreateJobPayload) => CREATED_JOB);

    render(
      <NewJobDrawer
        serviceAreas={mockServiceAreas}
        open
        onOpenChange={() => {}}
        onCreated={onCreated}
        placesLookup={stubLookup()}
        createJob={createJob}
      />,
    );

    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "Create job" }));

    await waitFor(() => {
      expect(createJob).toHaveBeenCalledWith({
        sender: {
          name: "Dr. Smith",
          phone: "029 2074 7747",
          organisation: "Royal Glamorgan Hospital",
        },
        collection: COLLECTION,
        delivery: DELIVERY,
        contents: "Blood samples",
        serviceAreas: ["E"],
      });
    });
    expect(onCreated).toHaveBeenCalledWith(CREATED_JOB);
    expect(recentLocations()).toHaveLength(2);
    expect(recentLocations()).toEqual(
      expect.arrayContaining([COLLECTION, DELIVERY]),
    );
  });

  it("submits collection and delivery notes when entered", async () => {
    const user = userEvent.setup();
    const createJob = vi.fn(async (_payload: CreateJobPayload) => CREATED_JOB);

    render(
      <NewJobDrawer
        serviceAreas={mockServiceAreas}
        open
        onOpenChange={() => {}}
        placesLookup={stubLookup()}
        createJob={createJob}
      />,
    );

    await fillRequiredFields(user);
    await user.type(screen.getByPlaceholderText("e.g. Path lab"), "path lab ");
    await user.type(
      screen.getByPlaceholderText("e.g. Reception outside"),
      "reception outside",
    );
    await user.click(screen.getByRole("button", { name: "Create job" }));

    await waitFor(() => {
      expect(createJob).toHaveBeenCalledTimes(1);
    });
    const [payload] = createJob.mock.calls[0];
    expect(payload.collection).toEqual({ ...COLLECTION, notes: "path lab" });
    expect(payload.delivery).toEqual({
      ...DELIVERY,
      notes: "reception outside",
    });
  });

  it("labels both notes inputs as optional", () => {
    render(
      <NewJobDrawer
        serviceAreas={mockServiceAreas}
        open
        onOpenChange={() => {}}
        placesLookup={stubLookup()}
      />,
    );

    expect(screen.getAllByLabelText("Notes (optional)")).toHaveLength(2);
  });

  it("omits notes from the payload when left blank", async () => {
    const user = userEvent.setup();
    const createJob = vi.fn(async (_payload: CreateJobPayload) => CREATED_JOB);

    render(
      <NewJobDrawer
        serviceAreas={mockServiceAreas}
        open
        onOpenChange={() => {}}
        placesLookup={stubLookup()}
        createJob={createJob}
      />,
    );

    await fillRequiredFields(user);
    await user.type(screen.getByPlaceholderText("e.g. Path lab"), "   ");
    await user.click(screen.getByRole("button", { name: "Create job" }));

    await waitFor(() => {
      expect(createJob).toHaveBeenCalledTimes(1);
    });
    const [payload] = createJob.mock.calls[0];
    expect(payload.collection).not.toHaveProperty("notes");
    expect(payload.delivery).not.toHaveProperty("notes");
  });

  it("has optional estimated collection and delivery time inputs", () => {
    render(
      <NewJobDrawer
        serviceAreas={mockServiceAreas}
        open
        onOpenChange={() => {}}
        placesLookup={stubLookup()}
      />,
    );

    expect(screen.getByLabelText("Estimated collection")).toHaveAttribute(
      "type",
      "time",
    );
    expect(screen.getByLabelText("Estimated delivery")).toHaveAttribute(
      "type",
      "time",
    );
    expect(screen.getAllByText("(optional)").length).toBeGreaterThanOrEqual(2);
  });

  it("can be submitted with both estimated times empty", async () => {
    const user = userEvent.setup();
    const createJob = vi.fn(async (_payload: CreateJobPayload) => CREATED_JOB);

    render(
      <NewJobDrawer
        serviceAreas={mockServiceAreas}
        open
        onOpenChange={() => {}}
        placesLookup={stubLookup()}
        createJob={createJob}
      />,
    );

    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "Create job" }));

    await waitFor(() => {
      expect(createJob).toHaveBeenCalledTimes(1);
    });
    const [payload] = createJob.mock.calls[0];
    expect(payload).not.toHaveProperty("estimatedCollectionAt");
    expect(payload).not.toHaveProperty("estimatedDeliveryAt");
  });

  it("combines a filled estimate with today and sends it as an ISO timestamp", async () => {
    const user = userEvent.setup();
    const createJob = vi.fn(async (_payload: CreateJobPayload) => CREATED_JOB);

    render(
      <NewJobDrawer
        serviceAreas={mockServiceAreas}
        open
        onOpenChange={() => {}}
        placesLookup={stubLookup()}
        createJob={createJob}
      />,
    );

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText("Estimated collection"), "09:30");
    await user.click(screen.getByRole("button", { name: "Create job" }));

    await waitFor(() => {
      expect(createJob).toHaveBeenCalledTimes(1);
    });
    const [payload] = createJob.mock.calls[0];
    const expected = new Date();
    expected.setHours(9, 30, 0, 0);
    expect(payload.estimatedCollectionAt).toBe(expected.toISOString());
    expect(payload).not.toHaveProperty("estimatedDeliveryAt");
  });

  it("sends both estimates when both are filled", async () => {
    const user = userEvent.setup();
    const createJob = vi.fn(async (_payload: CreateJobPayload) => CREATED_JOB);

    render(
      <NewJobDrawer
        serviceAreas={mockServiceAreas}
        open
        onOpenChange={() => {}}
        placesLookup={stubLookup()}
        createJob={createJob}
      />,
    );

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText("Estimated collection"), "09:30");
    await user.type(screen.getByLabelText("Estimated delivery"), "11:15");
    await user.click(screen.getByRole("button", { name: "Create job" }));

    await waitFor(() => {
      expect(createJob).toHaveBeenCalledTimes(1);
    });
    const [payload] = createJob.mock.calls[0];
    const collection = new Date();
    collection.setHours(9, 30, 0, 0);
    const delivery = new Date();
    delivery.setHours(11, 15, 0, 0);
    expect(payload.estimatedCollectionAt).toBe(collection.toISOString());
    expect(payload.estimatedDeliveryAt).toBe(delivery.toISOString());
  });

  it("shows an API error for an estimated time next to its input", async () => {
    const user = userEvent.setup();
    const createJob = vi.fn(async (_payload: CreateJobPayload) => {
      throw new ApiError(422, "Validation failed", {
        body: {
          errors: {
            estimatedDeliveryAt: ["The estimated delivery at is invalid."],
          },
        },
      });
    });

    render(
      <NewJobDrawer
        serviceAreas={mockServiceAreas}
        open
        onOpenChange={() => {}}
        placesLookup={stubLookup()}
        createJob={createJob}
      />,
    );

    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "Create job" }));

    expect(
      await screen.findByText("The estimated delivery at is invalid."),
    ).toBeInTheDocument();
  });

  it("does not remember notes in recent or most-used places", async () => {
    const user = userEvent.setup();
    const createJob = vi.fn(
      async (_payload: CreateJobPayload): Promise<DeliveryJob> => ({
        ...CREATED_JOB,
        collection: { ...COLLECTION, notes: "path lab" },
        delivery: { ...DELIVERY, notes: "reception outside" },
      }),
    );

    render(
      <NewJobDrawer
        serviceAreas={mockServiceAreas}
        open
        onOpenChange={() => {}}
        placesLookup={stubLookup()}
        createJob={createJob}
      />,
    );

    await fillRequiredFields(user);
    await user.type(screen.getByPlaceholderText("e.g. Path lab"), "path lab");
    await user.click(screen.getByRole("button", { name: "Create job" }));

    await waitFor(() => {
      expect(recentLocations()).toHaveLength(2);
    });
    expect(localStorage.getItem(SAVED_LOCATIONS_KEY)).not.toContain("notes");
    expect(localStorage.getItem(SAVED_LOCATIONS_KEY)).not.toContain("path lab");
  });

  it("shows a notes length error inline and does not submit", async () => {
    const user = userEvent.setup();
    const createJob = vi.fn(async (_payload: CreateJobPayload) => CREATED_JOB);

    render(
      <NewJobDrawer
        serviceAreas={mockServiceAreas}
        open
        onOpenChange={() => {}}
        placesLookup={stubLookup()}
        createJob={createJob}
      />,
    );

    await fillRequiredFields(user);
    await user.click(screen.getByPlaceholderText("e.g. Reception outside"));
    await user.paste("x".repeat(501));
    await user.click(screen.getByRole("button", { name: "Create job" }));

    expect(
      await screen.findByText("Notes must be 500 characters or fewer"),
    ).toBeInTheDocument();
    expect(createJob).not.toHaveBeenCalled();
  });

  it("shows a 422 validation error inline", async () => {
    const user = userEvent.setup();
    const createJob = vi.fn(async () => {
      throw new ApiError(422, "The given data was invalid.", {
        body: {
          errors: {
            "collection.placeId": [
              "Collection location must include a Google Place ID.",
            ],
          },
        },
      });
    });

    render(
      <NewJobDrawer
        serviceAreas={mockServiceAreas}
        open
        onOpenChange={() => {}}
        placesLookup={stubLookup()}
        createJob={createJob}
      />,
    );

    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "Create job" }));

    await waitFor(() => {
      expect(
        screen.getByText("Collection location must include a Google Place ID."),
      ).toBeInTheDocument();
    });
  });
});
