import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "~/lib/api-client";
import type { CreateJobPayload, DeliveryJob, PlaceLocation } from "~/lib/jobs";
import type { PlacesLookup } from "~/lib/places";
import { clearSavedLocations, recentLocations } from "~/lib/saved-locations";
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
  serviceAreas: ["South"],
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
  await user.click(screen.getByRole("checkbox", { name: "South Area" }));
}

afterEach(() => {
  clearSavedLocations();
});

describe("NewJobDrawer", () => {
  it("renders the intake form when open", () => {
    render(
      <NewJobDrawer open onOpenChange={() => {}} placesLookup={stubLookup()} />,
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
    expect(
      screen.getByRole("checkbox", { name: "South Area" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "North Area" }),
    ).toBeInTheDocument();
  });

  it("renders footer actions", () => {
    render(
      <NewJobDrawer open onOpenChange={() => {}} placesLookup={stubLookup()} />,
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
        open
        onOpenChange={onOpenChange}
        placesLookup={stubLookup()}
      />,
    );

    await user.type(screen.getByLabelText("Caller name"), "Dr. Smith");
    rerender(
      <NewJobDrawer
        open={false}
        onOpenChange={onOpenChange}
        placesLookup={stubLookup()}
      />,
    );
    rerender(
      <NewJobDrawer
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

  it("clears a field's error as soon as it is edited", async () => {
    const user = userEvent.setup();

    render(
      <NewJobDrawer open onOpenChange={() => {}} placesLookup={stubLookup()} />,
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
        serviceAreas: ["South"],
      });
    });
    expect(onCreated).toHaveBeenCalledWith(CREATED_JOB);
    expect(recentLocations()).toHaveLength(2);
    expect(recentLocations()).toEqual(
      expect.arrayContaining([COLLECTION, DELIVERY]),
    );
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
