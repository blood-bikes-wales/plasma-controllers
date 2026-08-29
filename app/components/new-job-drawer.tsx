import { useEffect, useState } from "react";
import { z } from "zod";

import { FieldError } from "~/components/field-error";
import { PlaceLocationField } from "~/components/place-location-field";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { ApiError } from "~/lib/api-client";
import {
  type CreateJobPayload,
  createDeliveryJob,
  type DeliveryJob,
  jobErrorMessage,
  type PlaceLocation,
  SERVICE_AREAS,
} from "~/lib/jobs";
import type { PlacesLookup } from "~/lib/places";
import { recordUsedLocations } from "~/lib/saved-locations";
import { apiFieldErrors, fieldErrors } from "~/lib/validation";

const placeLocationSchema: z.ZodType<PlaceLocation> = z.object({
  placeId: z.string().min(1),
  address: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
});

const newJobFormSchema = z.object({
  senderName: z.string().trim().min(1, "Enter the caller's name"),
  senderPhone: z.string().trim().min(1, "Enter a contact number"),
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
  contents: z.string().trim().min(1, "Describe the item or contents"),
  serviceAreas: z.array(z.string()).min(1, "Choose at least one service area"),
});

type NewJobFormState = z.input<typeof newJobFormSchema>;

const EMPTY_FORM: NewJobFormState = {
  senderName: "",
  senderPhone: "",
  senderOrganisation: "",
  collection: null,
  delivery: null,
  contents: "",
  serviceAreas: [],
};

type NewJobDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (job: DeliveryJob) => void;
  placesLookup?: PlacesLookup;
  createJob?: (payload: CreateJobPayload) => Promise<DeliveryJob>;
};

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-bb-card border-0 bg-bb-white py-0 shadow-none ring-1 ring-bb-gray-200 dark:bg-card dark:ring-bb-gray-700">
      <CardContent className="space-y-4 pt-5">
        <h2 className="text-base font-bold text-bb-gray-900 dark:text-bb-gray-100">
          {title}
        </h2>
        {children}
      </CardContent>
    </Card>
  );
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

  return {
    sender,
    collection: form.collection,
    delivery: form.delivery,
    contents: form.contents,
    serviceAreas: form.serviceAreas,
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
}: NewJobDrawerProps) {
  const [form, setForm] = useState<NewJobFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setErrors({});
      setFormError(undefined);
      setSubmitting(false);
    }
  }, [open]);

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

  function toggleServiceArea(area: string) {
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
        <SheetHeader className="shrink-0 border-b border-bb-gray-100 px-5 py-4 text-left dark:border-bb-gray-700">
          <SheetTitle className="text-xl font-extrabold text-bb-gray-900 dark:text-bb-gray-100">
            New Job
          </SheetTitle>
          <SheetDescription>
            Capture the sender and locations while speaking with the hospital.
            The job is saved when you create it.
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            void handleCreate();
          }}
        >
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
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
                onChange={(next) => updateField("collection", next)}
                error={errors.collection}
                lookup={placesLookup}
              />
            </FormSection>

            <FormSection title="Delivery">
              <PlaceLocationField
                id="delivery-location"
                label="Delivery location"
                value={form.delivery}
                onChange={(next) => updateField("delivery", next)}
                error={errors.delivery}
                lookup={placesLookup}
              />
            </FormSection>

            <FormSection title="Contents">
              <div className="space-y-2">
                <Label
                  htmlFor="contents"
                  className="text-bb-gray-700 dark:text-bb-gray-300"
                >
                  Item or contents description
                </Label>
                <Input
                  id="contents"
                  value={form.contents}
                  onChange={(event) =>
                    updateField("contents", event.target.value)
                  }
                  aria-invalid={!!errors.contents}
                  className="h-11 text-base dark:bg-input/30"
                  placeholder="e.g. Blood samples, medical notes"
                />
                <FieldError message={errors.contents} />
              </div>
            </FormSection>

            <FormSection title="Service areas">
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-bb-gray-700 dark:text-bb-gray-300">
                  Areas this job covers
                </legend>
                {SERVICE_AREAS.map((area) => (
                  <label
                    key={area.value}
                    className="flex min-h-11 items-center gap-3 rounded-xl px-1 text-base font-medium text-bb-gray-900 dark:text-bb-gray-100"
                  >
                    <input
                      type="checkbox"
                      className="size-5 shrink-0 rounded border-bb-gray-300 accent-bb-cta"
                      checked={form.serviceAreas.includes(area.value)}
                      onChange={() => toggleServiceArea(area.value)}
                    />
                    {area.label}
                  </label>
                ))}
              </fieldset>
              <FieldError message={errors.serviceAreas} />
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
