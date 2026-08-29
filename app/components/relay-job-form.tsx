import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { FieldError } from "~/components/field-error";
import { PlaceLocationField } from "~/components/place-location-field";
import { Button } from "~/components/ui/button";
import type { PlaceLocation, RelayJobPayload } from "~/lib/jobs";
import type { PlacesLookup } from "~/lib/places";
import { fieldErrors } from "~/lib/validation";

const placeLocationSchema: z.ZodType<PlaceLocation> = z.object({
  placeId: z.string().min(1),
  address: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
});

const relayFormSchema = z.object({
  rendezvousPoints: z
    .array(placeLocationSchema.nullable())
    .min(1, "Add at least one rendezvous point")
    .superRefine((points, ctx) => {
      points.forEach((point, index) => {
        if (point !== null) {
          return;
        }

        ctx.addIssue({
          code: "custom",
          path: [index],
          message: "Choose a rendezvous point from the place search",
        });
      });
    }),
});

type RendezvousField = {
  id: string;
  value: PlaceLocation | null;
};

function createRendezvousField(
  value: PlaceLocation | null = null,
): RendezvousField {
  return {
    id: crypto.randomUUID(),
    value,
  };
}

type RelayJobFormProps = {
  isSubmitting: boolean;
  onSubmit: (payload: RelayJobPayload) => Promise<void>;
  placesLookup?: PlacesLookup;
};

export function RelayJobForm({
  isSubmitting,
  onSubmit,
  placesLookup,
}: RelayJobFormProps) {
  const [points, setPoints] = useState<RendezvousField[]>([
    createRendezvousField(),
  ]);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrorsMap, setFieldErrorsMap] = useState<Record<string, string>>(
    {},
  );

  function updatePoint(id: string, value: PlaceLocation | null) {
    setPoints((current) =>
      current.map((point) => (point.id === id ? { ...point, value } : point)),
    );
    const index = points.findIndex((point) => point.id === id);
    if (index === -1) {
      return;
    }

    setFieldErrorsMap((current) => {
      const next = { ...current };
      delete next[`rendezvous-${index}`];
      return next;
    });
  }

  function addPoint() {
    setPoints((current) => [...current, createRendezvousField()]);
  }

  function removePoint(id: string) {
    setPoints((current) => {
      if (current.length === 1) {
        return current;
      }

      return current.filter((point) => point.id !== id);
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = relayFormSchema.safeParse({
      rendezvousPoints: points.map((point) => point.value),
    });
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const index = issue.path[1];
        if (typeof index !== "number") {
          continue;
        }

        const key = `rendezvous-${index}`;
        if (key in nextErrors) {
          continue;
        }

        nextErrors[key] = issue.message;
      }

      const generic = fieldErrors(parsed);
      setFieldErrorsMap(nextErrors);
      setFormError(generic.rendezvousPoints ?? null);
      return;
    }

    const rendezvousPoints = parsed.data.rendezvousPoints.filter(
      (point): point is PlaceLocation => point !== null,
    );

    await onSubmit({ rendezvousPoints });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <p className="text-sm text-bb-gray-600 dark:text-bb-gray-300">
        Split this route into legs by adding one or more handoff locations
        between collection and final delivery.
      </p>

      {points.map((point, index) => (
        <div key={point.id} className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-bb-gray-900 dark:text-bb-gray-100">
              Rendezvous {index + 1}
            </p>
            {points.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-bb-error"
                onClick={() => removePoint(point.id)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Remove
              </Button>
            ) : null}
          </div>
          <PlaceLocationField
            id={`rendezvous-${point.id}`}
            label={`Rendezvous point ${index + 1}`}
            value={point.value}
            onChange={(value) => updatePoint(point.id, value)}
            error={fieldErrorsMap[`rendezvous-${index}`]}
            lookup={placesLookup}
          />
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        className="gap-2"
        onClick={addPoint}
      >
        <Plus className="size-4" aria-hidden="true" />
        Add rendezvous point
      </Button>

      <FieldError message={formError} />

      <Button type="submit" disabled={isSubmitting}>
        Convert to relay
      </Button>
    </form>
  );
}
