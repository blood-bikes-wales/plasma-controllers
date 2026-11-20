import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { FieldError } from "~/components/field-error";
import { PlaceLocationField } from "~/components/place-location-field";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  combineDayAndTime,
  type PlaceLocation,
  type RelayJobPayload,
  type RelayRendezvousPoint,
} from "~/lib/jobs";
import type { PlacesLookup } from "~/lib/places";

const placeLocationSchema: z.ZodType<PlaceLocation> = z.object({
  placeId: z.string().min(1),
  address: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
});

const arrivalTimeSchema = z
  .string()
  .trim()
  .min(1, "Enter an arrival time")
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid time");

const relayFormSchema = z.object({
  rendezvousPoints: z
    .array(
      z.object({
        place: placeLocationSchema.nullable(),
        arrivalTime: arrivalTimeSchema,
      }),
    )
    .min(1, "Add at least one rendezvous point")
    .superRefine((points, ctx) => {
      points.forEach((point, index) => {
        if (point.place !== null) {
          return;
        }

        ctx.addIssue({
          code: "custom",
          path: [index, "place"],
          message: "Choose a rendezvous point from the place search",
        });
      });
    }),
});

type RendezvousField = {
  id: string;
  value: PlaceLocation | null;
  arrivalTime: string;
};

function createRendezvousField(
  value: PlaceLocation | null = null,
): RendezvousField {
  return {
    id: crypto.randomUUID(),
    value,
    arrivalTime: "",
  };
}

type RelayJobFormProps = {
  /** The parent job's day; arrival times are combined with its calendar day. */
  jobDate?: string | null;
  isSubmitting: boolean;
  onSubmit: (payload: RelayJobPayload) => Promise<void>;
  placesLookup?: PlacesLookup;
};

export function RelayJobForm({
  jobDate = null,
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

  function updatePoint(
    id: string,
    patch: Partial<Pick<RendezvousField, "value" | "arrivalTime">>,
    errorKey: "rendezvous" | "arrival",
  ) {
    setPoints((current) =>
      current.map((point) =>
        point.id === id ? { ...point, ...patch } : point,
      ),
    );
    const index = points.findIndex((point) => point.id === id);
    if (index === -1) {
      return;
    }

    setFieldErrorsMap((current) => {
      const next = { ...current };
      delete next[`${errorKey}-${index}`];
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
      rendezvousPoints: points.map((point) => ({
        place: point.value,
        arrivalTime: point.arrivalTime,
      })),
    });
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const index = issue.path[1];
        if (typeof index !== "number") {
          continue;
        }

        const key =
          issue.path[2] === "arrivalTime"
            ? `arrival-${index}`
            : `rendezvous-${index}`;
        if (key in nextErrors) {
          continue;
        }

        nextErrors[key] = issue.message;
      }

      // Only the list-level issue (e.g. no points) is a form error; per-row
      // issues are shown on their own field.
      const listIssue = parsed.error.issues.find(
        (issue) => issue.path.length === 1,
      );
      setFieldErrorsMap(nextErrors);
      setFormError(listIssue?.message ?? null);
      return;
    }

    // The job's day is always present from the API; fall back to today so the
    // form still submits if it is ever missing.
    const day = jobDate ?? new Date().toISOString();
    const rendezvousPoints: RelayRendezvousPoint[] = [];
    const timeErrors: Record<string, string> = {};
    parsed.data.rendezvousPoints.forEach((point, index) => {
      const arrivesAt = combineDayAndTime(day, point.arrivalTime);
      if (point.place === null || arrivesAt === undefined) {
        timeErrors[`arrival-${index}`] = "Enter a valid time";
        return;
      }

      rendezvousPoints.push({ ...point.place, arrivesAt });
    });
    if (Object.keys(timeErrors).length > 0) {
      setFieldErrorsMap(timeErrors);
      return;
    }

    setFieldErrorsMap({});
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
            onChange={(value) => updatePoint(point.id, { value }, "rendezvous")}
            error={fieldErrorsMap[`rendezvous-${index}`]}
            lookup={placesLookup}
          />
          <div className="space-y-2">
            <Label
              htmlFor={`arrival-${point.id}`}
              className="text-bb-gray-700 dark:text-bb-gray-300"
            >
              {`Arrival time at rendezvous ${index + 1}`}
            </Label>
            <Input
              id={`arrival-${point.id}`}
              type="time"
              value={point.arrivalTime}
              onChange={(event) =>
                updatePoint(
                  point.id,
                  { arrivalTime: event.target.value },
                  "arrival",
                )
              }
              aria-invalid={!!fieldErrorsMap[`arrival-${index}`]}
              className="h-11 text-base dark:bg-input/30"
            />
            <FieldError message={fieldErrorsMap[`arrival-${index}`]} />
          </div>
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
