import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "~/lib/api-client";
import type { CreateJobPayload, DeliveryJob, PlaceLocation } from "~/lib/jobs";
import type { PlacesLookup } from "~/lib/places";
import type { PostcodeAreaMatch } from "~/lib/postcode-areas";
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

  it("sends the postcode of each chosen place and remembers it", async () => {
    const user = userEvent.setup();
    const createJob = vi.fn(
      async (payload: CreateJobPayload): Promise<DeliveryJob> => ({
        ...CREATED_JOB,
        collection: { ...payload.collection, notes: null },
        delivery: { ...payload.delivery, notes: null },
      }),
    );
    const collection = { ...COLLECTION, postcode: "CF72 8XR" };
    const delivery = { ...DELIVERY, postcode: "CF14 4XW" };
    const lookup: PlacesLookup = {
      ...stubLookup(),
      details: async (placeId: string) =>
        placeId === COLLECTION.placeId ? collection : delivery,
    };

    render(
      <NewJobDrawer
        serviceAreas={mockServiceAreas}
        open
        onOpenChange={() => {}}
        placesLookup={lookup}
        createJob={createJob}
        lookupPostcodeArea={async () => null}
      />,
    );

    await user.type(screen.getByLabelText("Caller name"), "Dr. Smith");
    await user.type(screen.getByLabelText("Contact number"), "029 2074 7747");
    await user.type(screen.getByLabelText("Collection location"), "Royal");
    await user.click(
      await screen.findByRole("option", { name: /Royal Glamorgan/ }),
    );
    await user.type(screen.getByLabelText("Delivery location"), "University");
    await user.click(
      await screen.findByRole("option", { name: /University Hospital/ }),
    );
    await screen.findByDisplayValue(`${DELIVERY.address}, CF14 4XW`);
    await user.type(
      screen.getByLabelText("Item or contents description"),
      "Blood samples",
    );
    await user.click(screen.getByRole("checkbox", { name: "East" }));
    await user.click(screen.getByRole("button", { name: "Create job" }));

    await waitFor(() => {
      expect(createJob).toHaveBeenCalledTimes(1);
    });
    const [payload] = createJob.mock.calls[0];
    expect(payload.collection).toEqual(collection);
    expect(payload.delivery).toEqual(delivery);

    await waitFor(() => {
      expect(recentLocations()).toHaveLength(2);
    });
    expect(
      recentLocations()
        .map((place) => place.postcode)
        .sort(),
    ).toEqual(["CF14 4XW", "CF72 8XR"]);
    expect(localStorage.getItem(SAVED_LOCATIONS_KEY)).not.toContain("notes");
  });
});

describe("NewJobDrawer service areas from the places", () => {
  const AREAS = [...mockServiceAreas, { code: "S", name: "Swansea" }];
  const AREA_BY_OUTWARD: Record<string, PostcodeAreaMatch> = {
    SA1: { areaCode: "S", areaFullName: "Swansea" },
    SA2: { areaCode: "S", areaFullName: "Swansea" },
    CF14: { areaCode: "E", areaFullName: "East" },
    LL57: { areaCode: "NW", areaFullName: "North West" },
  };

  const SINGLETON: PlaceLocation = {
    placeId: "ChIJ-singleton",
    address: "Singleton Hospital, Swansea",
    postcode: "SA2 8QA",
    latitude: 51.62,
    longitude: -3.98,
  };
  const SWANSEA_CENTRE: PlaceLocation = {
    placeId: "ChIJ-swansea-centre",
    address: "Swansea Civic Centre",
    postcode: "SA1 3SN",
    latitude: 51.61,
    longitude: -3.94,
  };
  const UHW: PlaceLocation = {
    placeId: "ChIJ-uhw",
    address: "University Hospital of Wales, Cardiff",
    postcode: "CF14 4XW",
    latitude: 51.506,
    longitude: -3.191,
  };
  const BANGOR: PlaceLocation = {
    placeId: "ChIJ-bangor",
    address: "Ysbyty Gwynedd, Bangor",
    postcode: "LL57 2PW",
    latitude: 53.2,
    longitude: -4.12,
  };
  const UNMAPPED: PlaceLocation = {
    placeId: "ChIJ-unmapped",
    address: "Somewhere Unmapped",
    postcode: "ZZ9 9ZZ",
    latitude: 52,
    longitude: -3,
  };
  const NO_POSTCODE: PlaceLocation = {
    placeId: "ChIJ-no-postcode",
    address: "A Place Without Postcode",
    latitude: 52,
    longitude: -3,
  };
  const PLACES = [
    SINGLETON,
    SWANSEA_CENTRE,
    UHW,
    BANGOR,
    UNMAPPED,
    NO_POSTCODE,
  ];

  function placesLookup(): PlacesLookup {
    return {
      suggest: async (query: string) =>
        PLACES.filter((place) =>
          place.address.toLowerCase().includes(query.toLowerCase()),
        ).map((place) => ({
          placeId: place.placeId,
          description: place.address,
        })),
      details: async (placeId: string) => {
        const place = PLACES.find((item) => item.placeId === placeId);
        if (!place) {
          throw new Error("Unknown place");
        }
        return place;
      },
    };
  }

  /** A postcode-area lookup whose results the test releases by hand. */
  function manualAreaLookup() {
    const pending: {
      postcode: string;
      resolve: (match: PostcodeAreaMatch | null) => void;
      reject: (error: Error) => void;
    }[] = [];
    const lookup = vi.fn(
      (postcode: string) =>
        new Promise<PostcodeAreaMatch | null>((resolve, reject) => {
          pending.push({ postcode, resolve, reject });
        }),
    );
    return { lookup, pending };
  }

  function instantAreaLookup() {
    return vi.fn(async (postcode: string) => AREA_BY_OUTWARD[postcode] ?? null);
  }

  function renderDrawer(
    lookupPostcodeArea: (postcode: string) => Promise<PostcodeAreaMatch | null>,
  ) {
    const props = {
      serviceAreas: AREAS,
      onOpenChange: () => {},
      placesLookup: placesLookup(),
      lookupPostcodeArea,
    };
    const view = render(<NewJobDrawer open {...props} />);
    return {
      ...view,
      setOpen: (open: boolean) =>
        view.rerender(<NewJobDrawer open={open} {...props} />),
    };
  }

  async function choosePlace(
    user: ReturnType<typeof userEvent.setup>,
    label: "Collection location" | "Delivery location",
    place: PlaceLocation,
  ) {
    await user.type(screen.getByLabelText(label), place.address.slice(0, 8));
    await user.click(
      await screen.findByRole("option", {
        name: new RegExp(place.address.slice(0, 8)),
      }),
    );
    await screen.findByDisplayValue(new RegExp(place.address.slice(0, 8)));
  }

  async function changePlace(
    user: ReturnType<typeof userEvent.setup>,
    label: "Collection location" | "Delivery location",
  ) {
    const button = screen
      .getByLabelText(label)
      .parentElement?.querySelector("button");
    if (!button) {
      throw new Error(`No change button for ${label}`);
    }
    await user.click(button);
  }

  function box(name: string) {
    return screen.getByRole("checkbox", { name });
  }

  function ticked() {
    return screen
      .getAllByRole("checkbox")
      .filter((checkbox) => (checkbox as HTMLInputElement).checked)
      .map((checkbox) => checkbox.closest("label")?.textContent);
  }

  it("ticks the area of the collection and of a delivery in another area", async () => {
    const user = userEvent.setup();
    const lookup = instantAreaLookup();
    renderDrawer(lookup);

    await choosePlace(user, "Collection location", SINGLETON);
    await waitFor(() => expect(box("Swansea")).toBeChecked());
    expect(lookup).toHaveBeenCalledWith("SA2");
    expect(
      screen.getByText("Swansea selected from the collection location"),
    ).toBeInTheDocument();
    expect(ticked()).toEqual(["Swansea"]);

    await choosePlace(user, "Delivery location", UHW);
    await waitFor(() => expect(box("East")).toBeChecked());
    expect(lookup).toHaveBeenCalledWith("CF14");
    expect(box("Swansea")).toBeChecked();
    expect(
      screen.getByText("East selected from the delivery location"),
    ).toBeInTheDocument();
  });

  it("ticks one area once when both places are in it", async () => {
    const user = userEvent.setup();
    renderDrawer(instantAreaLookup());

    await choosePlace(user, "Collection location", SINGLETON);
    await choosePlace(user, "Delivery location", SWANSEA_CENTRE);

    await waitFor(() =>
      expect(
        screen.getByText(
          "Swansea selected from the collection and delivery locations",
        ),
      ).toBeInTheDocument(),
    );
    expect(ticked()).toEqual(["Swansea"]);
  });

  it("keeps a shared area while the other place still needs it", async () => {
    const user = userEvent.setup();
    renderDrawer(instantAreaLookup());

    await choosePlace(user, "Collection location", SINGLETON);
    await choosePlace(user, "Delivery location", SWANSEA_CENTRE);
    await screen.findByText(/collection and delivery locations/);

    await changePlace(user, "Collection location");
    expect(box("Swansea")).toBeChecked();
    expect(
      screen.getByText("Swansea selected from the delivery location"),
    ).toBeInTheDocument();

    await changePlace(user, "Delivery location");
    expect(ticked()).toEqual([]);
    expect(screen.queryByText(/selected from/)).not.toBeInTheDocument();
  });

  it("swaps the automatic tick when the place changes", async () => {
    const user = userEvent.setup();
    renderDrawer(instantAreaLookup());

    await choosePlace(user, "Delivery location", UHW);
    await waitFor(() => expect(box("East")).toBeChecked());

    await changePlace(user, "Delivery location");
    expect(box("East")).not.toBeChecked();
    expect(screen.queryByText(/selected from/)).not.toBeInTheDocument();

    await choosePlace(user, "Delivery location", BANGOR);
    await waitFor(() => expect(box("North West")).toBeChecked());
    expect(ticked()).toEqual(["North West"]);
  });

  it("leaves a manual tick alone when a place changes or is cleared", async () => {
    const user = userEvent.setup();
    renderDrawer(instantAreaLookup());

    await user.click(box("North West"));
    await choosePlace(user, "Delivery location", UHW);
    await waitFor(() => expect(box("East")).toBeChecked());

    await changePlace(user, "Delivery location");
    expect(ticked()).toEqual(["North West"]);

    // The place that maps to a hand-ticked area adds nothing and removes nothing.
    await choosePlace(user, "Delivery location", BANGOR);
    await waitFor(() => expect(box("North West")).toBeChecked());
    expect(screen.queryByText(/selected from/)).not.toBeInTheDocument();
    await changePlace(user, "Delivery location");
    expect(ticked()).toEqual(["North West"]);
  });

  it("keeps an area the controller unticked when a place maps to it again", async () => {
    const user = userEvent.setup();
    renderDrawer(instantAreaLookup());

    await choosePlace(user, "Delivery location", UHW);
    await waitFor(() => expect(box("East")).toBeChecked());
    await user.click(box("East"));
    expect(ticked()).toEqual([]);
    expect(screen.queryByText(/selected from/)).not.toBeInTheDocument();

    await changePlace(user, "Delivery location");
    await choosePlace(user, "Delivery location", UHW);
    await waitFor(() => expect(box("East")).not.toBeChecked());
    expect(ticked()).toEqual([]);
  });

  it("keeps an automatic area the controller ticked by hand when the place changes", async () => {
    const user = userEvent.setup();
    renderDrawer(instantAreaLookup());

    await choosePlace(user, "Delivery location", UHW);
    await waitFor(() => expect(box("East")).toBeChecked());
    // Unticking then ticking again makes it the controller's own choice.
    await user.click(box("East"));
    await user.click(box("East"));

    await changePlace(user, "Delivery location");
    expect(box("East")).toBeChecked();
  });

  it("changes nothing when the postcode is missing or unmapped", async () => {
    const user = userEvent.setup();
    const lookup = instantAreaLookup();
    renderDrawer(lookup);

    await user.click(box("North West"));
    await choosePlace(user, "Collection location", NO_POSTCODE);
    await choosePlace(user, "Delivery location", UNMAPPED);

    await waitFor(() => expect(lookup).toHaveBeenCalledWith("ZZ9"));
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(ticked()).toEqual(["North West"]);
    expect(screen.queryByText(/selected from/)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("changes nothing and shows no error when the lookup fails", async () => {
    const user = userEvent.setup();
    const lookup = vi.fn(async () => {
      throw new Error("Network down");
    });
    renderDrawer(lookup);

    await choosePlace(user, "Collection location", SINGLETON);
    await waitFor(() => expect(lookup).toHaveBeenCalled());

    expect(ticked()).toEqual([]);
    expect(screen.queryByText(/Network down/)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(box("Swansea"));
    expect(ticked()).toEqual(["Swansea"]);
  });

  it("still asks for a service area when none could be picked", async () => {
    const user = userEvent.setup();
    renderDrawer(instantAreaLookup());

    await choosePlace(user, "Collection location", UNMAPPED);
    await user.click(screen.getByRole("button", { name: "Create job" }));

    expect(
      await screen.findByText("Choose at least one service area"),
    ).toBeInTheDocument();
  });

  it("ignores a stale lookup that resolves after a newer one", async () => {
    const user = userEvent.setup();
    const { lookup, pending } = manualAreaLookup();
    renderDrawer(lookup);

    await choosePlace(user, "Collection location", SINGLETON);
    await waitFor(() => expect(pending).toHaveLength(1));
    await changePlace(user, "Collection location");
    await choosePlace(user, "Collection location", BANGOR);
    await waitFor(() => expect(pending).toHaveLength(2));

    // The newer lookup (Bangor) answers first, the older one (Singleton) late.
    pending[1].resolve(AREA_BY_OUTWARD.LL57);
    await waitFor(() => expect(box("North West")).toBeChecked());
    pending[0].resolve(AREA_BY_OUTWARD.SA2);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(ticked()).toEqual(["North West"]);
    expect(
      screen.getByText("North West selected from the collection location"),
    ).toBeInTheDocument();
  });

  it("ignores a lookup that resolves after the place was cleared", async () => {
    const user = userEvent.setup();
    const { lookup, pending } = manualAreaLookup();
    renderDrawer(lookup);

    await choosePlace(user, "Collection location", SINGLETON);
    await waitFor(() => expect(pending).toHaveLength(1));
    await changePlace(user, "Collection location");

    pending[0].resolve(AREA_BY_OUTWARD.SA2);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(ticked()).toEqual([]);
    expect(screen.queryByText(/selected from/)).not.toBeInTheDocument();
  });

  it("ignores a lookup that resolves after the drawer was closed and reopened", async () => {
    const user = userEvent.setup();
    const { lookup, pending } = manualAreaLookup();
    const view = renderDrawer(lookup);

    await choosePlace(user, "Collection location", SINGLETON);
    await waitFor(() => expect(pending).toHaveLength(1));
    view.setOpen(false);
    view.setOpen(true);

    pending[0].resolve(AREA_BY_OUTWARD.SA2);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(ticked()).toEqual([]);
    expect(screen.queryByText(/selected from/)).not.toBeInTheDocument();
  });

  it("forgets manual choices and automatic ticks when the drawer is reopened", async () => {
    const user = userEvent.setup();
    const view = renderDrawer(instantAreaLookup());

    await choosePlace(user, "Collection location", SINGLETON);
    await waitFor(() => expect(box("Swansea")).toBeChecked());
    await user.click(box("Swansea"));
    view.setOpen(false);
    view.setOpen(true);

    await choosePlace(user, "Collection location", SINGLETON);
    await waitFor(() => expect(box("Swansea")).toBeChecked());
  });

  it("does not undo a tick the controller made while a lookup was in flight", async () => {
    const user = userEvent.setup();
    const { lookup, pending } = manualAreaLookup();
    renderDrawer(lookup);

    await choosePlace(user, "Collection location", SINGLETON);
    await waitFor(() => expect(pending).toHaveLength(1));
    await user.click(box("Swansea"));
    expect(box("Swansea")).toBeChecked();

    pending[0].resolve(AREA_BY_OUTWARD.SA2);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(box("Swansea")).toBeChecked();
    expect(screen.queryByText(/selected from/)).not.toBeInTheDocument();

    await changePlace(user, "Collection location");
    expect(box("Swansea")).toBeChecked();
  });
});
