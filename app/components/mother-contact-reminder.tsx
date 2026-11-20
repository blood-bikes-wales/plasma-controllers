import { PhoneCall } from "lucide-react";
import { useId, useState } from "react";

import { FieldError } from "~/components/field-error";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { ApiError } from "~/lib/api-client";
import {
  fromDateTimeLocalValue,
  jobErrorMessage,
  toDateTimeLocalValue,
} from "~/lib/jobs";
import { apiFieldErrors } from "~/lib/validation";

/**
 * The prominent "Call the mother to arrange collection" card on a milk job that
 * has no time yet. The milk bank phones the controller with the mother's
 * details; the controller creates the job, then rings her and records the time
 * here. It says so in words and with an icon, never by colour alone.
 *
 * `children` is the mother's name and tap-to-call numbers. `onSave` receives the
 * chosen time as an ISO timestamp and rejects when the API refuses it.
 */
export function MotherContactReminder({
  children,
  onSave,
}: {
  children?: React.ReactNode;
  onSave: (scheduledCollectionAt: string) => Promise<void>;
}) {
  const id = useId();
  const fieldId = `${id}-collection-time`;
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    if (value.trim() === "") {
      setError("Enter the collection date and time");
      return;
    }

    const iso = fromDateTimeLocalValue(value);
    if (!iso) {
      setError("Enter a valid collection date and time");
      return;
    }

    // A milk collection is always in the future. The API checks this too.
    if (new Date(iso).getTime() <= Date.now()) {
      setError("Choose a collection time in the future");
      return;
    }

    setSaving(true);
    try {
      await onSave(iso);
    } catch (caught: unknown) {
      const apiErrors =
        caught instanceof ApiError && caught.status === 422
          ? apiFieldErrors(caught.body)
          : {};
      setError(
        apiErrors.scheduledCollectionAt ??
          jobErrorMessage(caught, "Could not save the collection time."),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-label="Arrange collection">
      <Card className="rounded-bb-card border-2 border-bb-warning bg-bb-warning-light py-0 shadow-none dark:bg-bb-warning/20">
        <CardContent className="space-y-4 p-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-bb-gray-900 dark:text-bb-gray-100">
            <PhoneCall
              className="size-5 shrink-0 text-bb-warning dark:text-amber-300"
              aria-hidden="true"
            />
            Call the mother to arrange collection
          </h2>

          {children}

          <form className="space-y-3" onSubmit={handleSubmit} noValidate>
            <div className="space-y-2">
              <Label
                htmlFor={fieldId}
                className="text-bb-gray-700 dark:text-bb-gray-300"
              >
                Collection date and time
              </Label>
              <Input
                id={fieldId}
                type="datetime-local"
                value={value}
                min={toDateTimeLocalValue(new Date().toISOString())}
                onChange={(event) => {
                  setValue(event.target.value);
                  setError(undefined);
                }}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${fieldId}-error` : undefined}
                className="h-11 bg-bb-white text-base dark:bg-input/30"
              />
              <div id={`${fieldId}-error`}>
                <FieldError message={error} />
              </div>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save collection time"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
