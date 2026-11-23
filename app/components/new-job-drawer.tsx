import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import { FieldError } from "~/components/field-error";
import { PlaceLocationField } from "~/components/place-location-field";
import { SearchableSelectField } from "~/components/searchable-select-field";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Switch } from "~/components/ui/switch";
import { ApiError } from "~/lib/api-client";
import {
  fetchJobContents,
  type JobContentOption,
  NO_JOB_CONTENTS_MESSAGE,
  selectableJobContents,
} from "~/lib/job-contents";
import {
  type CreateJobPayload,
  combineDayAndTime,
  createDeliveryJob,
  type DeliveryJob,
  jobErrorMessage,
  MAX_MILK_LITRES,
  type PlaceLocation,
} from "~/lib/jobs";
import type { PlacesLookup } from "~/lib/places";
import { outwardPostcode } from "~/lib/postcode";
import {
  lookupPostcodeArea as defaultLookupPostcodeArea,
  type PostcodeAreaMatch,
} from "~/lib/postcode-areas";
import { recordUsedLocations } from "~/lib/saved-locations";
import {
  fetchServiceAreas,
  type ServiceAreaOption,
  serviceAreaLabel,
} from "~/lib/service-areas";
import {
  apiFieldErrors,
  fieldErrors,
  isUkPhoneNumber,
  UK_PHONE_MESSAGE,
  ukPhoneSchema,
} from "~/lib/validation";

const placeLocationSchema: z.ZodType<PlaceLocation> = z.object({
  placeId: z.string().min(1),
  address: z.string().min(1),
  postcode: z.string().nullish(),
  latitude: z.number(),
  longitude: z.number(),
});

const NOTES_MAX = 500;
const NOTES_TOO_LONG = `Notes must be ${NOTES_MAX} characters or fewer`;

/** A blank time is valid; a filled one must be an HH:mm time-input value. */
const estimatedTimeSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(value), {
    message: "Enter a valid time",
  });

const JOB_TYPE_OPTIONS = [
  { value: "standard", label: "Standard" },
  { value: "milk", label: "Milk" },
] as const;

/**
 * Fields that only apply to one job type live in their own schema and are
 * checked by `validateTypeFields`, so a new Milk-only field is added here and
 * to `MilkSection`, not threaded through the whole form.
 */
const milkFieldsSchema = z.object({
  milkLitres: z.string(),
  isBereavement: z.boolean(),
  motherName: z.string(),
  motherPhone: z.string(),
  motherSecondaryPhone: z.string(),
});

type MilkFieldKey = keyof typeof milkFieldsSchema.shape;

/** Every Milk-only form field, so leaving Milk can forget them together. */
const MILK_FIELD_KEYS = Object.keys(milkFieldsSchema.shape) as MilkFieldKey[];

const MOTHER_NAME_REQUIRED = "Enter the mother's name";
const MOTHER_PHONE_REQUIRED = "Enter the mother's phone number";

const MILK_LITRES_REQUIRED = "Enter how many litres of milk";
const MILK_LITRES_INVALID = "Litres must be a number greater than 0";
const MILK_LITRES_TOO_MANY = `Litres must be ${MAX_MILK_LITRES} or fewer`;
const MILK_LITRES_DECIMALS = "Litres can have at most 2 decimal places";

/** Parses the Litres input; returns the number or the message to show. */
function parseMilkLitres(raw: string): { litres: number } | { error: string } {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { error: MILK_LITRES_REQUIRED };
  }

  const litres = Number(trimmed);
  if (!Number.isFinite(litres) || litres <= 0) {
    return { error: MILK_LITRES_INVALID };
  }

  if (litres > MAX_MILK_LITRES) {
    return { error: MILK_LITRES_TOO_MANY };
  }

  if (Math.round(litres * 100) / 100 !== litres) {
    return { error: MILK_LITRES_DECIMALS };
  }

  return { litres };
}

const newJobBaseSchema = z.object({
  jobType: z.enum(["standard", "milk"]),
  senderName: z.string().trim().min(1, "Enter the caller's name"),
  senderPhone: z
    .string()
    .trim()
    .min(1, "Enter a contact number")
    .pipe(ukPhoneSchema),
  senderOrganisation: z.string(),
  collection: placeLocationSchema
    .nullable()
    .refine((value): value is PlaceLocation => value !== null, {
      message: "Choose a collection location from the place search",
    }),
  delivery: placeLocationSchema
    .nullable()
    .refine((value): value is PlaceLocation => value !== null, {
      message: "Choose a delivery location from the place search",
    }),
  collectionNotes: z.string().trim().max(NOTES_MAX, NOTES_TOO_LONG),
  deliveryNotes: z.string().trim().max(NOTES_MAX, NOTES_TOO_LONG),
  estimatedCollection: estimatedTimeSchema,
  estimatedDelivery: estimatedTimeSchema,
  scheduledCollectionDate: z.string().trim(),
  scheduledCollectionTime: estimatedTimeSchema,
  contents: z.string().trim().min(1, "Choose the contents"),
  serviceAreas: z.array(z.string()).min(1, "Choose at least one service area"),
  ...milkFieldsSchema.shape,
});

function validateTypeFields(
  form: z.infer<typeof newJobBaseSchema>,
  ctx: z.RefinementCtx,
) {
  const hasScheduleDate = form.scheduledCollectionDate.trim() !== "";
  const hasScheduleTime = form.scheduledCollectionTime.trim() !== "";
  if (hasScheduleDate !== hasScheduleTime) {
    ctx.addIssue({
      code: "custom",
      path: hasScheduleDate
        ? ["scheduledCollectionTime"]
        : ["scheduledCollectionDate"],
      message: "Enter both a collection date and time, or leave both blank",
    });
  }

  if (form.jobType !== "milk") {
    return;
  }

  if (hasScheduleDate && hasScheduleTime) {
    const iso = combineDayAndTime(
      `${form.scheduledCollectionDate}T00:00:00`,
      form.scheduledCollectionTime,
    );
    if (iso && new Date(iso).getTime() <= Date.now()) {
      ctx.addIssue({
        code: "custom",
        path: ["scheduledCollectionTime"],
        message: "Choose a collection time in the future",
      });
    }
  }

  const parsed = parseMilkLitres(form.milkLitres);
  if ("error" in parsed) {
    ctx.addIssue({
      code: "custom",
      path: ["milkLitres"],
      message: parsed.error,
    });
  }

  if (form.motherName.trim() === "") {
    ctx.addIssue({
      code: "custom",
      path: ["motherName"],
      message: MOTHER_NAME_REQUIRED,
    });
  }

  const motherPhone = form.motherPhone.trim();
  if (motherPhone === "") {
    ctx.addIssue({
      code: "custom",
      path: ["motherPhone"],
      message: MOTHER_PHONE_REQUIRED,
    });
  } else if (!isUkPhoneNumber(motherPhone)) {
    ctx.addIssue({
      code: "custom",
      path: ["motherPhone"],
      message: UK_PHONE_MESSAGE,
    });
  }

  // The second phone is optional, so it is only checked once something is typed.
  const secondaryPhone = form.motherSecondaryPhone.trim();
  if (secondaryPhone !== "" && !isUkPhoneNumber(secondaryPhone)) {
    ctx.addIssue({
      code: "custom",
      path: ["motherSecondaryPhone"],
      message: UK_PHONE_MESSAGE,
    });
  }
}

const newJobFormSchema = newJobBaseSchema.superRefine(validateTypeFields);

type NewJobFormState = z.input<typeof newJobFormSchema>;

const EMPTY_FORM: NewJobFormState = {
  jobType: "standard",
  milkLitres: "",
  isBereavement: false,
  motherName: "",
  motherPhone: "",
  motherSecondaryPhone: "",
  senderName: "",
  senderPhone: "",
  senderOrganisation: "",
  collection: null,
  delivery: null,
  collectionNotes: "",
  deliveryNotes: "",
  estimatedCollection: "",
  estimatedDelivery: "",
  scheduledCollectionDate: "",
  scheduledCollectionTime: "",
  contents: "",
  serviceAreas: [],
};

type NewJobDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (job: DeliveryJob) => void;
  placesLookup?: PlacesLookup;
  createJob?: (payload: CreateJobPayload) => Promise<DeliveryJob>;
  serviceAreas?: ServiceAreaOption[];
  /** The contents a controller can choose from. Fetched from the API when omitted. */
  jobContents?: JobContentOption[];
  lookupPostcodeArea?: (postcode: string) => Promise<PostcodeAreaMatch | null>;
};

type PlaceSlot = "collection" | "delivery";

const PLACE_SLOTS: readonly PlaceSlot[] = ["collection", "delivery"];

/** A service area ticked automatically because of a place. */
type AutoPick = { code: string; name: string };

type AutoPicks = Record<PlaceSlot, AutoPick | null>;

const NO_AUTO_PICKS: AutoPicks = { collection: null, delivery: null };

function otherSlot(slot: PlaceSlot): PlaceSlot {
  return slot === "collection" ? "delivery" : "collection";
}

/** Short sentences saying which ticked areas came from the chosen places. */
function autoPickHints(
  picks: AutoPicks,
  ticked: readonly string[],
  areas: readonly ServiceAreaOption[],
): string[] {
  const active = PLACE_SLOTS.flatMap((slot) => {
    const pick = picks[slot];
    return pick && ticked.includes(pick.code) ? [{ slot, pick }] : [];
  });

  const hints: string[] = [];
  for (const { slot, pick } of active) {
    const name = serviceAreaLabel(pick.code, areas);
    const label = name === pick.code ? pick.name : name;
    const sharing = active.filter((item) => item.pick.code === pick.code);
    if (sharing.length > 1) {
      if (slot === "collection") {
        hints.push(
          `${label} selected from the collection and delivery locations`,
        );
      }
      continue;
    }
    hints.push(`${label} selected from the ${slot} location`);
  }

  return hints;
}

/** The Milk-only fields back at their empty values. */
function emptyMilkFields(): Pick<NewJobFormState, MilkFieldKey> {
  return Object.fromEntries(
    MILK_FIELD_KEYS.map((key) => [key, EMPTY_FORM[key]]),
  ) as Pick<NewJobFormState, MilkFieldKey>;
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-visible rounded-bb-card border-0 bg-bb-white py-0 shadow-none ring-1 ring-bb-gray-200 dark:bg-card dark:ring-bb-gray-700">
      <CardContent className="space-y-4 px-5 py-5">
        <h2 className="text-base font-bold text-bb-gray-900 dark:text-bb-gray-100">
          {title}
        </h2>
        {children}
      </CardContent>
    </Card>
  );
}

function NotesField({
  id,
  value,
  onChange,
  error,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-bb-gray-700 dark:text-bb-gray-300">
        Notes <span className="font-normal text-bb-gray-500">(optional)</span>
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={!!error}
        className="h-11 text-base dark:bg-input/30"
        placeholder={placeholder}
      />
      <FieldError message={error} />
    </div>
  );
}

function EstimatedTimeField({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-1">
        <Label htmlFor={id} className="text-bb-gray-700 dark:text-bb-gray-300">
          {label}
        </Label>
        <span className="text-sm text-bb-gray-500">(optional)</span>
      </div>
      <Input
        id={id}
        type="time"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={!!error}
        className="h-11 text-base dark:bg-input/30"
      />
      <FieldError message={error} />
    </div>
  );
}

function MilkSection({
  litres,
  onLitresChange,
  isBereavement,
  onBereavementChange,
  error,
  bereavementError,
}: {
  litres: string;
  onLitresChange: (value: string) => void;
  isBereavement: boolean;
  onBereavementChange: (value: boolean) => void;
  error?: string;
  bereavementError?: string;
}) {
  return (
    <FormSection title="Milk">
      <div className="space-y-2">
        <Label
          htmlFor="milk-litres"
          className="text-bb-gray-700 dark:text-bb-gray-300"
        >
          Litres
        </Label>
        <Input
          id="milk-litres"
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          value={litres}
          onChange={(event) => onLitresChange(event.target.value)}
          aria-invalid={!!error}
          className="h-11 text-base dark:bg-input/30"
          placeholder="e.g. 2.5"
        />
        <FieldError message={error} />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label
              htmlFor="milk-bereavement"
              className="text-bb-gray-700 dark:text-bb-gray-300"
            >
              Bereavement
            </Label>
            <p className="text-sm text-bb-gray-500 dark:text-bb-gray-400">
              Shown as a badge on the job so riders and drivers can be
              sensitive.
            </p>
          </div>
          <Switch
            id="milk-bereavement"
            checked={isBereavement}
            onCheckedChange={onBereavementChange}
            aria-invalid={!!bereavementError}
          />
        </div>
        <FieldError message={bereavementError} />
      </div>
    </FormSection>
  );
}

function MotherContactSection({
  name,
  phone,
  secondaryPhone,
  onChange,
  errors,
}: {
  name: string;
  phone: string;
  secondaryPhone: string;
  onChange: (
    field: "motherName" | "motherPhone" | "motherSecondaryPhone",
    value: string,
  ) => void;
  errors: Record<string, string>;
}) {
  return (
    <FormSection title="Mother's contact">
      <div className="space-y-2">
        <Label
          htmlFor="mother-name"
          className="text-bb-gray-700 dark:text-bb-gray-300"
        >
          Name
        </Label>
        <Input
          id="mother-name"
          autoComplete="off"
          value={name}
          onChange={(event) => onChange("motherName", event.target.value)}
          aria-invalid={!!errors.motherName}
          className="h-11 text-base dark:bg-input/30"
        />
        <FieldError message={errors.motherName} />
      </div>
      <div className="space-y-2">
        <Label
          htmlFor="mother-phone"
          className="text-bb-gray-700 dark:text-bb-gray-300"
        >
          Phone
        </Label>
        <Input
          id="mother-phone"
          type="tel"
          autoComplete="off"
          value={phone}
          onChange={(event) => onChange("motherPhone", event.target.value)}
          aria-invalid={!!errors.motherPhone}
          className="h-11 text-base dark:bg-input/30"
          placeholder="e.g. 07700 900101"
        />
        <FieldError message={errors.motherPhone} />
      </div>
      <div className="space-y-2">
        <Label
          htmlFor="mother-phone-secondary"
          className="text-bb-gray-700 dark:text-bb-gray-300"
        >
          Second phone{" "}
          <span className="font-normal text-bb-gray-500">(optional)</span>
        </Label>
        <Input
          id="mother-phone-secondary"
          type="tel"
          autoComplete="off"
          value={secondaryPhone}
          onChange={(event) =>
            onChange("motherSecondaryPhone", event.target.value)
          }
          aria-invalid={!!errors.motherSecondaryPhone}
          className="h-11 text-base dark:bg-input/30"
          placeholder="e.g. 029 2074 7747"
        />
        <FieldError message={errors.motherSecondaryPhone} />
      </div>
    </FormSection>
  );
}

function withNotes(
  location: PlaceLocation,
  notes: string,
): CreateJobPayload["collection"] {
  const trimmed = notes.trim();
  return trimmed ? { ...location, notes: trimmed } : location;
}

function payloadFromForm(
  form: z.output<typeof newJobFormSchema>,
): CreateJobPayload {
  const organisation = form.senderOrganisation.trim();
  const sender = {
    name: form.senderName,
    phone: form.senderPhone,
    organisation: organisation || undefined,
  };

  // Estimates are still for today; arranged collection may be any day.
  const today = new Date().toISOString();
  const estimatedCollectionAt = combineDayAndTime(
    today,
    form.estimatedCollection,
  );
  const estimatedDeliveryAt = combineDayAndTime(today, form.estimatedDelivery);
  const scheduledCollectionAt =
    form.scheduledCollectionDate.trim() === ""
      ? undefined
      : combineDayAndTime(
          `${form.scheduledCollectionDate}T00:00:00`,
          form.scheduledCollectionTime,
        );

  const milk =
    form.jobType === "milk" ? parseMilkLitres(form.milkLitres) : null;
  const secondaryPhone = form.motherSecondaryPhone.trim();
  const mother =
    form.jobType === "milk"
      ? {
          name: form.motherName.trim(),
          phone: form.motherPhone.trim(),
          ...(secondaryPhone ? { secondaryPhone } : {}),
        }
      : null;

  return {
    jobType: form.jobType,
    ...(milk && "litres" in milk ? { milkLitres: milk.litres } : {}),
    ...(mother ? { mother } : {}),
    // Sent on milk jobs only: the API rejects it on any other type.
    ...(form.jobType === "milk" ? { isBereavement: form.isBereavement } : {}),
    sender,
    collection: withNotes(form.collection, form.collectionNotes),
    delivery: withNotes(form.delivery, form.deliveryNotes),
    contents: form.contents,
    serviceAreas: form.serviceAreas,
    ...(estimatedCollectionAt ? { estimatedCollectionAt } : {}),
    ...(estimatedDeliveryAt ? { estimatedDeliveryAt } : {}),
    ...(scheduledCollectionAt ? { scheduledCollectionAt } : {}),
  };
}

function applyCreateError(error: unknown): {
  fieldErrors: Record<string, string>;
  formError?: string;
} {
  if (error instanceof ApiError && error.status === 422) {
    const mapped = apiFieldErrors(error.body);
    if (Object.keys(mapped).length > 0) {
      return { fieldErrors: mapped };
    }
  }

  return {
    fieldErrors: {},
    formError: jobErrorMessage(error, "Could not create the job. Try again."),
  };
}

function createJobLabel(submitting: boolean): string {
  if (submitting) {
    return "Creating…";
  }

  return "Create job";
}

export function NewJobDrawer({
  open,
  onOpenChange,
  onCreated,
  placesLookup,
  createJob = createDeliveryJob,
  serviceAreas: serviceAreasProp,
  jobContents: jobContentsProp,
  lookupPostcodeArea = defaultLookupPostcodeArea,
}: NewJobDrawerProps) {
  const [form, setForm] = useState<NewJobFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [serviceAreas, setServiceAreas] = useState<ServiceAreaOption[]>(
    serviceAreasProp ?? [],
  );
  const [areasError, setAreasError] = useState<string | undefined>();
  // null until the list has loaded, so "No contents have been set up" never flashes.
  const [jobContents, setJobContents] = useState<JobContentOption[] | null>(
    jobContentsProp ? selectableJobContents(jobContentsProp) : null,
  );
  const [contentsError, setContentsError] = useState<string | undefined>();
  // Bumped by "Try again" to re-run the fetch without touching the rest of the form.
  const [contentsReload, setContentsReload] = useState(0);
  const [autoPicks, setAutoPicks] = useState<AutoPicks>(NO_AUTO_PICKS);

  // Automatic service-area ticks. These live in refs so a lookup that resolves
  // late reads the current state, not the state it was started with.
  // - autoRef: the area each place ticked (or shares with the other place).
  // - manualRef: areas the controller ticked or unticked by hand; these are
  //   never changed automatically for the rest of this form.
  // - lookupIds: bumped whenever a place changes or the form resets, so only
  //   the latest lookup for a place may apply its result.
  const autoRef = useRef<AutoPicks>(NO_AUTO_PICKS);
  const manualRef = useRef<Set<string>>(new Set());
  const lookupIds = useRef<Record<PlaceSlot, number>>({
    collection: 0,
    delivery: 0,
  });
  const serviceAreasRef = useRef(serviceAreas);
  serviceAreasRef.current = serviceAreas;
  const lookupRef = useRef(lookupPostcodeArea);
  lookupRef.current = lookupPostcodeArea;

  useEffect(() => {
    if (!open) {
      // Closing invalidates any lookup still in flight and forgets every pick.
      lookupIds.current = {
        collection: lookupIds.current.collection + 1,
        delivery: lookupIds.current.delivery + 1,
      };
      autoRef.current = NO_AUTO_PICKS;
      manualRef.current = new Set();
      setAutoPicks(NO_AUTO_PICKS);
      setForm(EMPTY_FORM);
      setErrors({});
      setFormError(undefined);
      setSubmitting(false);
      setAreasError(undefined);
      setContentsError(undefined);
    }
  }, [open]);

  useEffect(() => {
    if (serviceAreasProp) {
      setServiceAreas(serviceAreasProp);
      return;
    }

    if (!open) {
      return;
    }

    let cancelled = false;
    void fetchServiceAreas()
      .then((areas) => {
        if (!cancelled) {
          setServiceAreas(areas);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAreasError("Unable to load service areas.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, serviceAreasProp]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: contentsReload only exists to re-run this fetch ("Try again").
  useEffect(() => {
    if (jobContentsProp) {
      setJobContents(selectableJobContents(jobContentsProp));
      return;
    }

    if (!open) {
      return;
    }

    // Reloaded each time the drawer opens so a trustee's changes show up.
    let cancelled = false;
    setContentsError(undefined);
    void fetchJobContents()
      .then((entries) => {
        if (!cancelled) {
          setJobContents(selectableJobContents(entries));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setContentsError("Unable to load the contents list.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, jobContentsProp, contentsReload]);

  function updateField<K extends keyof NewJobFormState>(
    field: K,
    value: NewJobFormState[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!(field in current)) {
        return current;
      }
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleJobTypeChange(jobType: NewJobFormState["jobType"]) {
    setForm((current) => ({
      ...current,
      jobType,
      // Every Milk-only field (litres, bereavement, the mother's contact)
      // belongs to milk jobs only, so leaving Milk forgets them.
      ...(jobType === "milk" ? {} : emptyMilkFields()),
    }));
    setErrors((current) => {
      const next = { ...current };
      delete next.jobType;
      if (jobType !== "milk") {
        for (const key of MILK_FIELD_KEYS) {
          delete next[key];
        }
      }
      return Object.keys(next).length === Object.keys(current).length
        ? current
        : next;
    });
  }

  function removeServiceAreas(codes: string[]) {
    if (codes.length === 0) {
      return;
    }
    setForm((current) => ({
      ...current,
      serviceAreas: current.serviceAreas.filter(
        (value) => !codes.includes(value),
      ),
    }));
  }

  function addAutoServiceArea(code: string) {
    setForm((current) =>
      current.serviceAreas.includes(code)
        ? current
        : { ...current, serviceAreas: [...current.serviceAreas, code] },
    );
    setErrors((current) => {
      if (!("serviceAreas" in current)) {
        return current;
      }
      const next = { ...current };
      delete next.serviceAreas;
      return next;
    });
  }

  function applyAreaMatch(slot: PlaceSlot, match: PostcodeAreaMatch) {
    const known = serviceAreasRef.current;
    // Never tick an area the controller can't see or untick.
    const unknown =
      known.length > 0 && !known.some((area) => area.code === match.areaCode);
    if (unknown || manualRef.current.has(match.areaCode)) {
      return;
    }

    autoRef.current = {
      ...autoRef.current,
      [slot]: { code: match.areaCode, name: match.areaFullName },
    };
    setAutoPicks(autoRef.current);
    addAutoServiceArea(match.areaCode);
  }

  function startAreaLookup(slot: PlaceSlot, place: PlaceLocation) {
    const outward = outwardPostcode(place.postcode);
    if (!outward) {
      return;
    }

    lookupIds.current[slot] += 1;
    const lookupId = lookupIds.current[slot];
    void lookupRef
      .current(outward)
      .then((match) => {
        // Ignore a result for a place that was changed, cleared or reset since.
        if (match && lookupIds.current[slot] === lookupId) {
          applyAreaMatch(slot, match);
        }
      })
      .catch(() => {
        // A failed lookup changes nothing; areas can still be ticked by hand.
      });
  }

  function handlePlaceChange(slot: PlaceSlot, next: PlaceLocation | null) {
    updateField(slot, next);

    // Invalidate any lookup still in flight for the previous place.
    lookupIds.current[slot] += 1;

    // Drop what the previous place ticked, unless the controller has touched
    // that area or the other place still needs it.
    const previous = autoRef.current[slot];
    if (previous) {
      autoRef.current = { ...autoRef.current, [slot]: null };
      setAutoPicks(autoRef.current);
      const stillNeeded =
        autoRef.current[otherSlot(slot)]?.code === previous.code;
      if (!stillNeeded && !manualRef.current.has(previous.code)) {
        removeServiceAreas([previous.code]);
      }
    }

    if (next) {
      startAreaLookup(slot, next);
    }
  }

  function toggleServiceArea(area: string) {
    // A hand toggle always wins: the area is no longer the places' to change.
    manualRef.current.add(area);
    if (PLACE_SLOTS.some((slot) => autoRef.current[slot]?.code === area)) {
      autoRef.current = {
        collection:
          autoRef.current.collection?.code === area
            ? null
            : autoRef.current.collection,
        delivery:
          autoRef.current.delivery?.code === area
            ? null
            : autoRef.current.delivery,
      };
      setAutoPicks(autoRef.current);
    }

    setForm((current) => {
      if (current.serviceAreas.includes(area)) {
        return {
          ...current,
          serviceAreas: current.serviceAreas.filter((value) => value !== area),
        };
      }

      return {
        ...current,
        serviceAreas: [...current.serviceAreas, area],
      };
    });
    setErrors((current) => {
      if (!("serviceAreas" in current)) {
        return current;
      }
      const next = { ...current };
      delete next.serviceAreas;
      return next;
    });
  }

  function handleClose() {
    onOpenChange(false);
  }

  async function handleCreate() {
    const result = newJobFormSchema.safeParse(form);
    if (!result.success) {
      setErrors(fieldErrors(result));
      setFormError(undefined);
      return;
    }

    setErrors({});
    setFormError(undefined);
    setSubmitting(true);
    try {
      const job = await createJob(payloadFromForm(result.data));
      recordUsedLocations([job.collection, job.delivery]);
      onCreated?.(job);
    } catch (error) {
      const applied = applyCreateError(error);
      setErrors(applied.fieldErrors);
      setFormError(applied.formError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full max-w-full flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:max-w-full sm:max-w-xl data-[side=right]:sm:max-w-xl"
      >
        <SheetHeader className="shrink-0 border-b border-bb-gray-100 px-5 py-4 pr-12 text-left dark:border-bb-gray-700">
          <SheetTitle className="text-xl font-extrabold text-bb-gray-900 dark:text-bb-gray-100">
            New Job
          </SheetTitle>
          <SheetDescription>
            Capture the sender and locations while speaking with the hospital.
            The job is saved when you create it.
          </SheetDescription>
        </SheetHeader>

        {/* noValidate: Zod owns validation, so Litres (step 0.1) shows our inline errors, not the browser's step popover. */}
        <form
          noValidate
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            void handleCreate();
          }}
        >
          <div className="flex-1 space-y-4 overflow-y-auto scroll-pb-10 px-5 py-5 pb-10">
            <FormSection title="Job type">
              <p
                id="job-type-legend"
                className="text-sm font-medium text-bb-gray-700 dark:text-bb-gray-300"
              >
                What is being collected?
              </p>
              <RadioGroup
                aria-labelledby="job-type-legend"
                value={form.jobType}
                onValueChange={(value) => {
                  const option = JOB_TYPE_OPTIONS.find(
                    (candidate) => candidate.value === value,
                  );
                  if (option) {
                    handleJobTypeChange(option.value);
                  }
                }}
                className="gap-1"
              >
                {JOB_TYPE_OPTIONS.map((option) => {
                  const inputId = `job-type-${option.value}`;
                  return (
                    <div
                      key={option.value}
                      className="flex min-h-11 items-center gap-3 px-1"
                    >
                      <RadioGroupItem value={option.value} id={inputId} />
                      <Label
                        htmlFor={inputId}
                        className="text-base font-medium text-bb-gray-900 dark:text-bb-gray-100"
                      >
                        {option.label}
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>
              <FieldError message={errors.jobType} />
            </FormSection>

            {form.jobType === "milk" ? (
              <MilkSection
                litres={form.milkLitres}
                onLitresChange={(value) => updateField("milkLitres", value)}
                isBereavement={form.isBereavement}
                onBereavementChange={(value) =>
                  updateField("isBereavement", value)
                }
                error={errors.milkLitres}
                bereavementError={errors.isBereavement}
              />
            ) : null}

            {form.jobType === "milk" ? (
              <MotherContactSection
                name={form.motherName}
                phone={form.motherPhone}
                secondaryPhone={form.motherSecondaryPhone}
                onChange={updateField}
                errors={errors}
              />
            ) : null}

            <FormSection title="Sender">
              <div className="space-y-2">
                <Label
                  htmlFor="caller-name"
                  className="text-bb-gray-700 dark:text-bb-gray-300"
                >
                  Caller name
                </Label>
                <Input
                  id="caller-name"
                  autoComplete="name"
                  value={form.senderName}
                  onChange={(event) =>
                    updateField("senderName", event.target.value)
                  }
                  aria-invalid={!!errors.senderName}
                  className="h-11 text-base dark:bg-input/30"
                  placeholder="e.g. Dr. Patel"
                />
                <FieldError message={errors.senderName} />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="contact-number"
                  className="text-bb-gray-700 dark:text-bb-gray-300"
                >
                  Contact number
                </Label>
                <Input
                  id="contact-number"
                  type="tel"
                  autoComplete="tel"
                  value={form.senderPhone}
                  onChange={(event) =>
                    updateField("senderPhone", event.target.value)
                  }
                  aria-invalid={!!errors.senderPhone}
                  className="h-11 text-base dark:bg-input/30"
                  placeholder="e.g. 029 2074 7747"
                />
                <FieldError message={errors.senderPhone} />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="organisation"
                  className="text-bb-gray-700 dark:text-bb-gray-300"
                >
                  Organisation{" "}
                  <span className="font-normal text-bb-gray-500">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="organisation"
                  value={form.senderOrganisation}
                  onChange={(event) =>
                    updateField("senderOrganisation", event.target.value)
                  }
                  aria-invalid={!!errors.senderOrganisation}
                  className="h-11 text-base dark:bg-input/30"
                  placeholder="e.g. Royal Glamorgan Hospital"
                />
                <FieldError message={errors.senderOrganisation} />
              </div>
            </FormSection>

            <FormSection title="Collection">
              <PlaceLocationField
                id="collection-location"
                label="Collection location"
                value={form.collection}
                onChange={(next) => handlePlaceChange("collection", next)}
                error={errors.collection}
                lookup={placesLookup}
              />
              <NotesField
                id="collection-notes"
                value={form.collectionNotes}
                onChange={(value) => updateField("collectionNotes", value)}
                error={errors.collectionNotes}
                placeholder="e.g. Path lab"
              />
              <EstimatedTimeField
                id="estimated-collection"
                label="Estimated collection"
                value={form.estimatedCollection}
                onChange={(value) => updateField("estimatedCollection", value)}
                error={errors.estimatedCollection}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-baseline gap-1">
                    <Label
                      htmlFor="scheduled-collection-date"
                      className="text-bb-gray-700 dark:text-bb-gray-300"
                    >
                      Arranged collection date
                    </Label>
                    <span className="text-sm text-bb-gray-500">(optional)</span>
                  </div>
                  <Input
                    id="scheduled-collection-date"
                    type="date"
                    value={form.scheduledCollectionDate}
                    onChange={(event) =>
                      updateField("scheduledCollectionDate", event.target.value)
                    }
                    aria-invalid={!!errors.scheduledCollectionDate}
                    className="h-11 text-base dark:bg-input/30"
                  />
                  <FieldError message={errors.scheduledCollectionDate} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-baseline gap-1">
                    <Label
                      htmlFor="scheduled-collection-time"
                      className="text-bb-gray-700 dark:text-bb-gray-300"
                    >
                      Arranged collection time
                    </Label>
                    <span className="text-sm text-bb-gray-500">(optional)</span>
                  </div>
                  <Input
                    id="scheduled-collection-time"
                    type="time"
                    value={form.scheduledCollectionTime}
                    onChange={(event) =>
                      updateField("scheduledCollectionTime", event.target.value)
                    }
                    aria-invalid={!!errors.scheduledCollectionTime}
                    className="h-11 text-base dark:bg-input/30"
                  />
                  <FieldError message={errors.scheduledCollectionTime} />
                </div>
              </div>
            </FormSection>

            <FormSection title="Delivery">
              <PlaceLocationField
                id="delivery-location"
                label="Delivery location"
                value={form.delivery}
                onChange={(next) => handlePlaceChange("delivery", next)}
                error={errors.delivery}
                lookup={placesLookup}
              />
              <NotesField
                id="delivery-notes"
                value={form.deliveryNotes}
                onChange={(value) => updateField("deliveryNotes", value)}
                error={errors.deliveryNotes}
                placeholder="e.g. Reception outside"
              />
              <EstimatedTimeField
                id="estimated-delivery"
                label="Estimated delivery"
                value={form.estimatedDelivery}
                onChange={(value) => updateField("estimatedDelivery", value)}
                error={errors.estimatedDelivery}
              />
            </FormSection>

            <FormSection title="Contents">
              <SearchableSelectField
                id="contents"
                label="Contents"
                value={form.contents || null}
                onChange={(value) => updateField("contents", value ?? "")}
                options={(jobContents ?? []).map((entry) => ({
                  value: entry.name,
                  label: entry.name,
                }))}
                placeholder={
                  jobContents === null && !contentsError
                    ? "Loading…"
                    : "Search or select the contents…"
                }
                error={errors.contents}
                emptyMessage={
                  jobContents !== null && !contentsError
                    ? NO_JOB_CONTENTS_MESSAGE
                    : undefined
                }
              />
              {contentsError ? (
                <div className="flex flex-wrap items-center gap-3">
                  <p role="alert" className="text-sm font-medium text-bb-error">
                    {contentsError}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-bb-button px-4"
                    onClick={() => setContentsReload((count) => count + 1)}
                  >
                    Try again
                  </Button>
                </div>
              ) : null}
            </FormSection>

            <FormSection title="Service areas">
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-bb-gray-700 dark:text-bb-gray-300">
                  Areas this job covers
                </legend>
                {serviceAreas.map((area) => (
                  <label
                    key={area.code}
                    className="flex min-h-11 items-center gap-3 rounded-xl px-1 text-base font-medium text-bb-gray-900 dark:text-bb-gray-100"
                  >
                    <input
                      type="checkbox"
                      className="size-5 shrink-0 rounded border-bb-gray-300 accent-bb-cta"
                      checked={form.serviceAreas.includes(area.code)}
                      onChange={() => toggleServiceArea(area.code)}
                    />
                    {area.name}
                  </label>
                ))}
              </fieldset>
              {autoPickHints(autoPicks, form.serviceAreas, serviceAreas).map(
                (hint) => (
                  <p
                    key={hint}
                    role="status"
                    className="text-sm text-bb-gray-500 dark:text-bb-gray-400"
                  >
                    {hint}
                  </p>
                ),
              )}
              <FieldError message={errors.serviceAreas ?? areasError} />
            </FormSection>

            {formError ? (
              <p role="alert" className="text-sm font-medium text-bb-error">
                {formError}
              </p>
            ) : null}
          </div>

          <SheetFooter className="shrink-0 gap-3 border-t border-bb-gray-100 bg-bb-white px-5 py-4 dark:border-bb-gray-700 dark:bg-card">
            <Button
              type="submit"
              disabled={submitting}
              className="h-12 w-full rounded-bb-button text-base font-bold"
            >
              {createJobLabel(submitting)}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-11 w-full text-base font-medium text-bb-gray-500"
              onClick={handleClose}
            >
              Cancel
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
