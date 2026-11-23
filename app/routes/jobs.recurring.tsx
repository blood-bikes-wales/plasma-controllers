import { ArrowLeft, Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

import { FieldError } from "~/components/field-error";
import { PlaceLocationField } from "~/components/place-location-field";
import { SearchableSelectField } from "~/components/searchable-select-field";
import { Badge } from "~/components/ui/badge";
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
import { useAuth } from "~/lib/auth";
import { canCreateJobs } from "~/lib/capabilities";
import {
  fetchJobContents,
  type JobContentOption,
  selectableJobContents,
} from "~/lib/job-contents";
import {
  type CreateJobRecurrencePayload,
  createJobRecurrence,
  fetchJobRecurrences,
  formatRecurrenceSchedule,
  type JobRecurrence,
  jobRecurrenceErrorMessage,
  pauseJobRecurrence,
  resumeJobRecurrence,
  stopJobRecurrence,
} from "~/lib/job-recurrences";
import type { PlaceLocation } from "~/lib/jobs";
import {
  fetchServiceAreas,
  type ServiceAreaOption,
  serviceAreaLabel,
} from "~/lib/service-areas";
import { isUkPhoneNumber, UK_PHONE_MESSAGE } from "~/lib/validation";

import type { Route } from "./+types/jobs.recurring";

const WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
];

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Recurring jobs — Plasma Controller" }];
}

type CreateForm = {
  senderName: string;
  senderPhone: string;
  senderOrganisation: string;
  collection: PlaceLocation | null;
  delivery: PlaceLocation | null;
  contents: string;
  serviceAreas: string[];
  frequency: "daily" | "weekly";
  byWeekday: number[];
  timeOfDay: string;
  startsOn: string;
  endsOn: string;
  horizonDays: string;
};

const EMPTY_FORM: CreateForm = {
  senderName: "",
  senderPhone: "",
  senderOrganisation: "",
  collection: null,
  delivery: null,
  contents: "",
  serviceAreas: [],
  frequency: "weekly",
  byWeekday: [1, 3, 5],
  timeOfDay: "09:00",
  startsOn: "",
  endsOn: "",
  horizonDays: "14",
};

export default function JobsRecurringPage() {
  const navigate = useNavigate();
  const { status, activeRole } = useAuth();
  const canManage = canCreateJobs(activeRole);

  const [series, setSeries] = useState<JobRecurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [contents, setContents] = useState<JobContentOption[]>([]);
  const [serviceAreas, setServiceAreas] = useState<ServiceAreaOption[]>([]);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [nextSeries, nextContents, nextAreas] = await Promise.all([
      fetchJobRecurrences(),
      fetchJobContents(),
      fetchServiceAreas(),
    ]);
    setSeries(nextSeries);
    setContents(selectableJobContents(nextContents));
    setServiceAreas(nextAreas);
  }, []);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }
    if (!canManage) {
      navigate("/jobs", { replace: true });
      return;
    }

    let cancelled = false;
    setLoading(true);
    void load()
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(
            jobRecurrenceErrorMessage(caught, "Unable to load recurring jobs."),
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canManage, load, navigate, status]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setFormErrors({});
    setFormError(null);

    const nextErrors: Record<string, string> = {};
    if (form.senderName.trim() === "") {
      nextErrors.senderName = "Enter the caller's name";
    }
    if (form.senderPhone.trim() === "") {
      nextErrors.senderPhone = "Enter a contact number";
    }
    if (
      form.senderPhone.trim() !== "" &&
      !isUkPhoneNumber(form.senderPhone.trim())
    ) {
      nextErrors.senderPhone = UK_PHONE_MESSAGE;
    }
    if (!form.collection) {
      nextErrors.collection = "Choose a collection location";
    }
    if (!form.delivery) {
      nextErrors.delivery = "Choose a delivery location";
    }
    if (form.contents.trim() === "") {
      nextErrors.contents = "Choose the contents";
    }
    if (form.serviceAreas.length === 0) {
      nextErrors.serviceAreas = "Choose at least one service area";
    }
    if (form.timeOfDay.trim() === "") {
      nextErrors.timeOfDay = "Enter a collection time";
    }
    if (form.startsOn.trim() === "") {
      nextErrors.startsOn = "Enter a start date";
    }
    if (form.frequency === "weekly" && form.byWeekday.length === 0) {
      nextErrors.byWeekday = "Choose at least one weekday";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      return;
    }

    const { collection, delivery } = form;
    if (!collection || !delivery) {
      return;
    }

    const payload: CreateJobRecurrencePayload = {
      jobType: "standard",
      sender: {
        name: form.senderName.trim(),
        phone: form.senderPhone.trim(),
        organisation: form.senderOrganisation.trim() || undefined,
      },
      collection,
      delivery,
      contents: form.contents,
      serviceAreas: form.serviceAreas,
      timezone: "Europe/London",
      timeOfDay: form.timeOfDay,
      frequency: form.frequency,
      byWeekday: form.frequency === "weekly" ? form.byWeekday : undefined,
      startsOn: form.startsOn,
      endsOn: form.endsOn.trim() === "" ? null : form.endsOn,
      horizonDays: Number(form.horizonDays) || 14,
    };

    setSaving(true);
    try {
      await createJobRecurrence(payload);
      setDrawerOpen(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (caught: unknown) {
      setFormError(
        jobRecurrenceErrorMessage(caught, "Could not create the series."),
      );
    } finally {
      setSaving(false);
    }
  }

  async function runSeriesAction(
    id: string,
    action: "pause" | "resume" | "stop",
  ) {
    setActionBusyId(id);
    setError(null);
    try {
      if (action === "pause") {
        await pauseJobRecurrence(id);
      }
      if (action === "resume") {
        await resumeJobRecurrence(id);
      }
      if (action === "stop") {
        await stopJobRecurrence(id);
      }
      await load();
    } catch (caught: unknown) {
      setError(
        jobRecurrenceErrorMessage(caught, "Could not update the series."),
      );
    } finally {
      setActionBusyId(null);
    }
  }

  function toggleWeekday(day: number) {
    setForm((prev) => {
      if (prev.byWeekday.includes(day)) {
        return {
          ...prev,
          byWeekday: prev.byWeekday.filter((value) => value !== day),
        };
      }
      return { ...prev, byWeekday: [...prev.byWeekday, day].sort() };
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          to="/jobs"
          className="inline-flex items-center gap-2 text-sm font-semibold text-bb-cta hover:underline dark:text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to jobs
        </Link>
      </div>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[28px] font-extrabold text-bb-gray-900 dark:text-bb-gray-100">
            Recurring jobs
          </h1>
          <p className="mt-1 text-sm text-bb-gray-500 dark:text-bb-gray-400">
            Templates that create upcoming jobs for the next fortnight.
          </p>
        </div>
        <Button
          type="button"
          className="h-11 gap-2 rounded-bb-button px-5 text-base font-bold sm:h-12"
          onClick={() => {
            setForm({
              ...EMPTY_FORM,
              startsOn: new Date().toISOString().slice(0, 10),
            });
            setFormErrors({});
            setFormError(null);
            setDrawerOpen(true);
          }}
        >
          <Plus aria-hidden="true" />
          New series
        </Button>
      </header>

      {loading ? (
        <p className="py-12 text-center text-bb-gray-500">Loading…</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-base font-medium text-bb-error">
          {error}
        </p>
      ) : null}

      {!loading && !error && series.length === 0 ? (
        <p className="py-12 text-center text-bb-gray-500">
          No recurring series yet.
        </p>
      ) : null}

      <ul className="space-y-4">
        {series.map((entry) => (
          <li key={entry.id}>
            <Card className="rounded-bb-card border-0 bg-bb-white py-0 shadow-none ring-1 ring-bb-gray-200 dark:bg-card dark:ring-bb-gray-700">
              <CardContent className="space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-bold text-bb-gray-900 dark:text-bb-gray-100">
                      {entry.contents}
                    </p>
                    <p className="text-sm text-bb-gray-600 dark:text-bb-gray-300">
                      {formatRecurrenceSchedule(entry)}
                    </p>
                    <p className="mt-1 text-sm text-bb-gray-500">
                      {entry.collection.address} → {entry.delivery.address}
                    </p>
                  </div>
                  <Badge
                    className={
                      entry.isActive
                        ? "bg-bb-success-light text-bb-success"
                        : "bg-bb-gray-100 text-bb-gray-700"
                    }
                  >
                    {entry.isActive ? "Active" : "Paused"}
                  </Badge>
                </div>

                {entry.occurrences && entry.occurrences.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-bb-gray-500">
                      Upcoming occurrences
                    </p>
                    <ul className="space-y-1 text-sm text-bb-gray-700 dark:text-bb-gray-300">
                      {entry.occurrences.slice(0, 5).map((occurrence) => (
                        <li key={occurrence.id}>
                          <Link
                            to={`/jobs/${occurrence.id}`}
                            className="font-medium text-bb-cta hover:underline dark:text-primary"
                          >
                            {occurrence.reference}
                          </Link>
                          {occurrence.occurrenceDate
                            ? ` · ${occurrence.occurrenceDate}`
                            : ""}
                          {` · ${occurrence.status}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2 pt-1">
                  {entry.isActive ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-bb-button px-3 text-sm font-semibold"
                      disabled={actionBusyId === entry.id}
                      onClick={() => void runSeriesAction(entry.id, "pause")}
                    >
                      Pause
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 gap-1 rounded-bb-button px-3 text-sm font-semibold"
                      disabled={actionBusyId === entry.id}
                      onClick={() => void runSeriesAction(entry.id, "resume")}
                    >
                      <RefreshCw className="size-3.5" aria-hidden="true" />
                      Resume
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-bb-button px-3 text-sm font-semibold text-bb-error"
                    disabled={actionBusyId === entry.id}
                    onClick={() => void runSeriesAction(entry.id, "stop")}
                  >
                    Stop series
                  </Button>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>New recurring series</SheetTitle>
            <SheetDescription>
              Creates upcoming jobs for the chosen days within the horizon.
            </SheetDescription>
          </SheetHeader>

          <form className="mt-4 space-y-4" onSubmit={handleCreate} noValidate>
            <div className="space-y-2">
              <Label htmlFor="rec-sender-name">Caller name</Label>
              <Input
                id="rec-sender-name"
                value={form.senderName}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    senderName: event.target.value,
                  }))
                }
                className="h-11"
              />
              <FieldError message={formErrors.senderName} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rec-sender-phone">Contact number</Label>
              <Input
                id="rec-sender-phone"
                value={form.senderPhone}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    senderPhone: event.target.value,
                  }))
                }
                className="h-11"
              />
              <FieldError message={formErrors.senderPhone} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rec-org">Organisation (optional)</Label>
              <Input
                id="rec-org"
                value={form.senderOrganisation}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    senderOrganisation: event.target.value,
                  }))
                }
                className="h-11"
              />
            </div>

            <PlaceLocationField
              id="rec-collection"
              label="Collection location"
              value={form.collection}
              onChange={(next) =>
                setForm((prev) => ({ ...prev, collection: next }))
              }
              error={formErrors.collection}
            />
            <PlaceLocationField
              id="rec-delivery"
              label="Delivery location"
              value={form.delivery}
              onChange={(next) =>
                setForm((prev) => ({ ...prev, delivery: next }))
              }
              error={formErrors.delivery}
            />

            <SearchableSelectField
              id="rec-contents"
              label="Contents"
              value={form.contents || null}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, contents: value ?? "" }))
              }
              options={contents.map((entry) => ({
                value: entry.name,
                label: entry.name,
              }))}
              placeholder="Search or select the contents…"
              error={formErrors.contents}
            />

            <div className="space-y-2">
              <Label>Service areas</Label>
              <div className="flex flex-wrap gap-2">
                {serviceAreas.map((area) => {
                  const checked = form.serviceAreas.includes(area.code);
                  return (
                    <button
                      key={area.code}
                      type="button"
                      className={
                        checked
                          ? "rounded-full bg-bb-cta px-3 py-1.5 text-sm font-semibold text-white"
                          : "rounded-full bg-bb-white px-3 py-1.5 text-sm font-semibold text-bb-gray-700 ring-1 ring-bb-gray-200"
                      }
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          serviceAreas: checked
                            ? prev.serviceAreas.filter(
                                (code) => code !== area.code,
                              )
                            : [...prev.serviceAreas, area.code],
                        }))
                      }
                    >
                      {serviceAreaLabel(area)}
                    </button>
                  );
                })}
              </div>
              <FieldError message={formErrors.serviceAreas} />
            </div>

            <div className="space-y-2">
              <Label>Frequency</Label>
              <div className="flex gap-2">
                {(["daily", "weekly"] as const).map((frequency) => (
                  <button
                    key={frequency}
                    type="button"
                    className={
                      form.frequency === frequency
                        ? "rounded-full bg-bb-cta px-3 py-1.5 text-sm font-semibold text-white capitalize"
                        : "rounded-full bg-bb-white px-3 py-1.5 text-sm font-semibold text-bb-gray-700 ring-1 ring-bb-gray-200 capitalize"
                    }
                    onClick={() => setForm((prev) => ({ ...prev, frequency }))}
                  >
                    {frequency}
                  </button>
                ))}
              </div>
            </div>

            {form.frequency === "weekly" ? (
              <div className="space-y-2">
                <Label>Weekdays</Label>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((day) => {
                    const checked = form.byWeekday.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        className={
                          checked
                            ? "rounded-full bg-bb-navy px-3 py-1.5 text-sm font-semibold text-white"
                            : "rounded-full bg-bb-white px-3 py-1.5 text-sm font-semibold text-bb-gray-700 ring-1 ring-bb-gray-200"
                        }
                        onClick={() => toggleWeekday(day.value)}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
                <FieldError message={formErrors.byWeekday} />
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rec-time">Collection time</Label>
                <Input
                  id="rec-time"
                  type="time"
                  value={form.timeOfDay}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      timeOfDay: event.target.value,
                    }))
                  }
                  className="h-11"
                />
                <FieldError message={formErrors.timeOfDay} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rec-horizon">Horizon (days)</Label>
                <Input
                  id="rec-horizon"
                  type="number"
                  min={1}
                  max={90}
                  value={form.horizonDays}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      horizonDays: event.target.value,
                    }))
                  }
                  className="h-11"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rec-starts">Starts on</Label>
                <Input
                  id="rec-starts"
                  type="date"
                  value={form.startsOn}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      startsOn: event.target.value,
                    }))
                  }
                  className="h-11"
                />
                <FieldError message={formErrors.startsOn} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rec-ends">Ends on (optional)</Label>
                <Input
                  id="rec-ends"
                  type="date"
                  value={form.endsOn}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      endsOn: event.target.value,
                    }))
                  }
                  className="h-11"
                />
              </div>
            </div>

            {formError ? (
              <p role="alert" className="text-sm font-medium text-bb-error">
                {formError}
              </p>
            ) : null}

            <SheetFooter>
              <Button
                type="submit"
                disabled={saving}
                className="h-11 rounded-bb-button font-bold"
              >
                {saving ? "Creating…" : "Create series"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
