import { useEffect, useState } from "react";
import type { z } from "zod";

import { FieldError } from "~/components/field-error";
import { Button } from "~/components/ui/button";
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
  type CreateBikePayload,
  createBike,
  createBikeFormSchema,
  type FleetBike,
  type UpdateBikePayload,
  updateBike,
  updateBikeFormSchema,
} from "~/lib/bikes";
import { SERVICE_AREAS } from "~/lib/jobs";
import { apiFieldErrors, fieldErrors } from "~/lib/validation";

type BikeFormMode = "create" | "edit";

type BikeFormDrawerProps = {
  mode: BikeFormMode;
  open: boolean;
  bike?: FleetBike | null;
  onOpenChange: (open: boolean) => void;
  onSaved?: (bike: FleetBike) => void;
  createBikeFn?: (payload: CreateBikePayload) => Promise<FleetBike>;
  updateBikeFn?: (
    bikeId: string,
    payload: UpdateBikePayload,
  ) => Promise<FleetBike>;
};

type CreateFormState = z.input<typeof createBikeFormSchema>;
type UpdateFormState = z.input<typeof updateBikeFormSchema>;

const EMPTY_CREATE_FORM: CreateFormState = {
  registration: "",
  area: "South",
  lastRecordedMileage: "",
  purchasedAt: "",
};

function emptyEditForm(bike: FleetBike | null | undefined): UpdateFormState {
  if (!bike) {
    return {
      registration: "",
      area: "South",
      purchasedAt: "",
    };
  }

  return {
    registration: bike.registration,
    area: bike.area as "South" | "North",
    purchasedAt: bike.purchasedAt ?? "",
  };
}

function drawerTitle(mode: BikeFormMode) {
  if (mode === "create") {
    return "Add bike";
  }

  return "Edit bike";
}

function submitLabel(mode: BikeFormMode, submitting: boolean) {
  if (submitting) {
    return mode === "create" ? "Adding bike…" : "Saving changes…";
  }

  if (mode === "create") {
    return "Add bike";
  }

  return "Save changes";
}

export function BikeFormDrawer({
  mode,
  open,
  bike,
  onOpenChange,
  onSaved,
  createBikeFn = createBike,
  updateBikeFn = updateBike,
}: BikeFormDrawerProps) {
  const [createForm, setCreateForm] =
    useState<CreateFormState>(EMPTY_CREATE_FORM);
  const [editForm, setEditForm] = useState<UpdateFormState>(
    emptyEditForm(bike),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setErrors({});
    setFormError(null);
    setCreateForm(EMPTY_CREATE_FORM);
    setEditForm(emptyEditForm(bike));
  }, [bike, open]);

  function handleClose() {
    onOpenChange(false);
  }

  function updateCreateField<K extends keyof CreateFormState>(
    key: K,
    value: CreateFormState[K],
  ) {
    setCreateForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function updateEditField<K extends keyof UpdateFormState>(
    key: K,
    value: UpdateFormState[K],
  ) {
    setEditForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (mode === "create") {
      const result = createBikeFormSchema.safeParse(createForm);
      const nextErrors = fieldErrors(result);
      if (!result.success) {
        setErrors(nextErrors);
        return;
      }

      setSubmitting(true);
      try {
        const saved = await createBikeFn({
          registration: result.data.registration,
          area: result.data.area,
          lastRecordedMileage: result.data.lastRecordedMileage,
          purchasedAt: result.data.purchasedAt?.trim() || undefined,
        });
        onSaved?.(saved);
        handleClose();
      } catch (caught: unknown) {
        if (caught instanceof ApiError && caught.status === 422) {
          setErrors(apiFieldErrors(caught.body));
          return;
        }

        setFormError(
          caught instanceof Error ? caught.message : "Unable to add bike.",
        );
      } finally {
        setSubmitting(false);
      }

      return;
    }

    if (!bike) {
      return;
    }

    const result = updateBikeFormSchema.safeParse(editForm);
    const nextErrors = fieldErrors(result);
    if (!result.success) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    try {
      const saved = await updateBikeFn(bike.id, {
        registration: result.data.registration,
        area: result.data.area,
        purchasedAt: result.data.purchasedAt?.trim() || undefined,
      });
      onSaved?.(saved);
      handleClose();
    } catch (caught: unknown) {
      if (caught instanceof ApiError && caught.status === 422) {
        setErrors(apiFieldErrors(caught.body));
        return;
      }

      setFormError(
        caught instanceof Error ? caught.message : "Unable to save bike.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[92dvh] flex-col gap-0 rounded-t-2xl border-b-0 px-0 pb-0"
      >
        <SheetHeader className="shrink-0 border-b border-bb-gray-100 px-5 py-4 text-left dark:border-bb-gray-700">
          <SheetTitle className="text-xl font-extrabold text-bb-gray-900 dark:text-bb-gray-100">
            {drawerTitle(mode)}
          </SheetTitle>
          <SheetDescription className="text-sm text-bb-gray-500 dark:text-bb-gray-400">
            {mode === "create"
              ? "Register a new motorbike for your area."
              : "Update registration, area, or purchase date."}
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
        >
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            <div className="space-y-2">
              <Label htmlFor="bike-registration">Registration</Label>
              <Input
                id="bike-registration"
                value={
                  mode === "create"
                    ? createForm.registration
                    : editForm.registration
                }
                onChange={(event) => {
                  if (mode === "create") {
                    updateCreateField("registration", event.target.value);
                    return;
                  }

                  updateEditField("registration", event.target.value);
                }}
                aria-invalid={!!errors.registration}
                className="h-11 font-mono text-base uppercase"
                placeholder="e.g. CF12 ABC"
              />
              <FieldError message={errors.registration} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bike-area">Area</Label>
              <select
                id="bike-area"
                className="h-11 w-full rounded-md border border-bb-gray-300 bg-bb-white px-3 text-base dark:border-bb-gray-600 dark:bg-input/30"
                value={mode === "create" ? createForm.area : editForm.area}
                onChange={(event) => {
                  const value = event.target.value as "South" | "North";
                  if (mode === "create") {
                    updateCreateField("area", value);
                    return;
                  }

                  updateEditField("area", value);
                }}
                aria-invalid={!!errors.area}
              >
                {SERVICE_AREAS.map((area) => (
                  <option key={area.value} value={area.value}>
                    {area.label}
                  </option>
                ))}
              </select>
              <FieldError message={errors.area} />
            </div>

            {mode === "create" ? (
              <div className="space-y-2">
                <Label htmlFor="bike-mileage">Starting mileage</Label>
                <Input
                  id="bike-mileage"
                  inputMode="numeric"
                  value={createForm.lastRecordedMileage}
                  onChange={(event) =>
                    updateCreateField("lastRecordedMileage", event.target.value)
                  }
                  aria-invalid={!!errors.lastRecordedMileage}
                  className="h-11 text-base"
                  placeholder="e.g. 12000"
                />
                <FieldError message={errors.lastRecordedMileage} />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="bike-purchased-at">
                Purchase date{" "}
                <span className="font-normal text-bb-gray-500">(optional)</span>
              </Label>
              <Input
                id="bike-purchased-at"
                type="date"
                value={
                  mode === "create"
                    ? (createForm.purchasedAt ?? "")
                    : (editForm.purchasedAt ?? "")
                }
                onChange={(event) => {
                  if (mode === "create") {
                    updateCreateField("purchasedAt", event.target.value);
                    return;
                  }

                  updateEditField("purchasedAt", event.target.value);
                }}
                aria-invalid={!!errors.purchasedAt}
                className="h-11 text-base"
              />
              <FieldError message={errors.purchasedAt} />
            </div>

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
              {submitLabel(mode, submitting)}
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
