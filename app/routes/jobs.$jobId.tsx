import { ArrowLeft, CalendarCheck, Phone } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { z } from "zod";
import { AllocateJobForm } from "~/components/allocate-job-form";
import { BereavementBadge } from "~/components/bereavement-badge";
import { EstimatedTime } from "~/components/estimated-time";
import { FieldError } from "~/components/field-error";
import { JobLegsPanel } from "~/components/job-legs-panel";
import { JobTypeLabel } from "~/components/job-type-label";
import { MotherContactReminder } from "~/components/mother-contact-reminder";
import { RelayJobForm } from "~/components/relay-job-form";
import { SearchableSelectField } from "~/components/searchable-select-field";
import { Badge } from "~/components/ui/badge";
import { Button, buttonVariants } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { useAuth } from "~/lib/auth";
import { canManageJobs } from "~/lib/capabilities";
import {
  allowedActionsForJob,
  type CollectJobPayload,
  cancelJob,
  collectionRecordText,
  combineDayAndTime,
  type DeliverJobPayload,
  type DeliveryJob,
  defaultDateTimeLocalValue,
  defaultTimeValue,
  deliveryRecordText,
  displayJobReference,
  fetchJobById,
  formatJobCreatedAt,
  formatJobDay,
  formatScheduledCollection,
  fromDateTimeLocalValue,
  getJobDate,
  isRelayJob,
  isStaleJobError,
  type JobMother,
  jobErrorMessage,
  needsMotherContact,
  performJobAction,
  relayJob,
  scheduleJobCollection,
  upcomingCollectionAt,
  waitingForLegMessage,
} from "~/lib/jobs";
import { addressWithPostcode } from "~/lib/postcode";
import { type ActiveShift, fetchActiveShifts } from "~/lib/shifts";
import { useCommitOnComplete } from "~/lib/use-commit-on-complete";
import { useCommitTriggers, type Validation } from "~/lib/use-commit-triggers";
import { cn } from "~/lib/utils";
import { fieldErrors } from "~/lib/validation";

import type { Route } from "./+types/jobs.$jobId";

const collectSchema = z.object({
  contentsConfirmed: z.enum(["yes", "no"], {
    message: "Confirm whether the contents match the job",
  }),
  receiptNumber: z.string().trim().min(1, "Enter a job number"),
  collectedAt: z.string().trim().min(1, "Enter a collection time"),
});

const deliverSchema = z
  .object({
    recipient: z.string().trim(),
    noRecipient: z.boolean(),
    deliveredAt: z.string().trim().min(1, "Enter a delivery time"),
  })
  .superRefine((value, ctx) => {
    // The recipient is only required when someone did receive the delivery.
    if (!value.noRecipient && value.recipient.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["recipient"],
        message: "Enter the recipient",
      });
    }
  });

function statusBadgeClass(status: string) {
  switch (status) {
    case "New":
      return "border-bb-status-pending-border bg-bb-white text-bb-gray-700 dark:bg-bb-gray-700 dark:text-bb-gray-100";
    case "Allocated":
    case "Collected":
      return "border-bb-status-active-border bg-bb-status-active-bg text-bb-status-active-text dark:bg-bb-navy-light/30 dark:text-blue-200";
    case "Delivered":
      return "bg-bb-success-light text-bb-success dark:bg-bb-success/20 dark:text-green-300";
    case "Cancelled":
      return "bg-bb-error-light text-bb-error dark:bg-bb-error/20 dark:text-red-300";
    default:
      return "border-bb-gray-200 bg-bb-white text-bb-gray-700 dark:bg-bb-gray-700 dark:text-bb-gray-100";
  }
}

/** A `tel:` target without the spaces, brackets and hyphens people type. */
function telHref(phone: string): string {
  return `tel:${phone.replace(/[\s()-]/g, "")}`;
}

/**
 * The mother's name with each number as a tap-to-call link. Only rendered when
 * the API sent it, which it does for roles that can create jobs.
 */
function MotherContact({ mother }: { mother: JobMother }) {
  const phones = [mother.phone, mother.secondaryPhone].filter(
    (phone): phone is string => typeof phone === "string" && phone !== "",
  );

  return (
    <section
      aria-label="Mother's contact"
      className="space-y-2 text-sm text-bb-gray-600 dark:text-bb-gray-300"
    >
      <p>
        <span className="font-medium text-bb-gray-900 dark:text-bb-gray-100">
          Mother:
        </span>{" "}
        {mother.name}
      </p>
      <div className="flex flex-wrap gap-2">
        {phones.map((phone, index) => (
          <a
            key={phone}
            href={telHref(phone)}
            aria-label={`Call ${mother.name}${index > 0 ? " on second number" : ""}: ${phone}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "h-9 gap-1.5 px-3",
            )}
          >
            <Phone className="size-4" aria-hidden="true" />
            {phone}
          </a>
        ))}
      </div>
    </section>
  );
}

/** "Collection arranged for Sat 29 Aug, 14:30", with an icon, once a time is set. */
function ArrangedCollection({ scheduledAt }: { scheduledAt: string }) {
  const label = formatScheduledCollection(scheduledAt);
  if (!label) {
    return null;
  }

  return (
    <p
      role="status"
      className="flex items-center gap-2 rounded-bb-card bg-bb-white px-4 py-3 text-base font-semibold text-bb-gray-900 ring-1 ring-bb-gray-200 dark:bg-card dark:text-bb-gray-100 dark:ring-bb-gray-700"
    >
      <CalendarCheck className="size-5 shrink-0" aria-hidden="true" />
      Collection arranged for {label}
    </p>
  );
}

function JobRouteSummary({ job }: { job: DeliveryJob }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center pt-1.5" aria-hidden="true">
        <span className="size-2.5 shrink-0 rounded-full bg-bb-navy dark:bg-bb-navy-light" />
        <span className="my-0.5 w-px flex-1 bg-bb-gray-300 dark:bg-bb-gray-500" />
        <span className="size-2.5 shrink-0 rounded-full border-2 border-bb-navy bg-bb-white dark:border-bb-navy-light dark:bg-bb-gray-700" />
      </div>
      <div className="min-w-0 space-y-3">
        <div>
          <p className="text-sm font-medium text-bb-gray-900 dark:text-bb-gray-100">
            {addressWithPostcode(
              job.collection.address,
              job.collection.postcode,
            )}
          </p>
          <EstimatedTime
            label="Estimated collection"
            estimatedAt={job.estimatedCollectionAt}
          />
          {job.collection.notes ? (
            <p className="text-sm text-bb-gray-600 dark:text-bb-gray-300">
              {job.collection.notes}
            </p>
          ) : null}
        </div>
        <div>
          <p className="text-sm font-medium text-bb-gray-900 dark:text-bb-gray-100">
            {addressWithPostcode(job.delivery.address, job.delivery.postcode)}
          </p>
          <EstimatedTime
            label="Estimated delivery"
            estimatedAt={job.estimatedDeliveryAt}
          />
          {job.delivery.notes ? (
            <p className="text-sm text-bb-gray-600 dark:text-bb-gray-300">
              {job.delivery.notes}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Time of a collection/delivery. With a `jobDate` (normal job) only the time is
 * editable and the day is fixed; without one (relay jobs) the controller picks
 * both the date and the time.
 */
function RecordedAtField({
  id,
  label,
  jobDate,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  jobDate: string | null;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const dayLabel = formatJobDay(jobDate);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={jobDate ? "time" : "datetime-local"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={jobDate && dayLabel ? `${id}-day` : undefined}
      />
      {jobDate && dayLabel ? (
        <p
          id={`${id}-day`}
          className="text-sm text-bb-gray-500 dark:text-bb-gray-400"
        >
          On {dayLabel} (the job's day)
        </p>
      ) : null}
      <FieldError message={error} />
    </div>
  );
}

/** Initial value for a RecordedAtField: now, as a time or a date-time. */
function defaultRecordedAt(jobDate: string | null) {
  return jobDate ? defaultTimeValue() : defaultDateTimeLocalValue();
}

/** ISO timestamp to send for a RecordedAtField value. */
function recordedAtToIso(jobDate: string | null, value: string) {
  return jobDate
    ? combineDayAndTime(jobDate, value)
    : fromDateTimeLocalValue(value);
}

type CollectValues = {
  contentsConfirmed: string | null;
  receiptNumber: string;
  collectedAt: string;
};

/** The existing collection rules, run on the form's values. */
function validateCollect(
  values: CollectValues,
  jobDate: string | null,
): Validation<CollectJobPayload> {
  const parsed = collectSchema.safeParse({
    contentsConfirmed: values.contentsConfirmed ?? "",
    receiptNumber: values.receiptNumber,
    collectedAt: values.collectedAt,
  });
  if (!parsed.success) {
    return { errors: fieldErrors(parsed) };
  }

  const collectedIso = recordedAtToIso(jobDate, parsed.data.collectedAt);
  if (!collectedIso) {
    return { errors: { collectedAt: "Enter a valid collection time" } };
  }

  return {
    payload: {
      contentsConfirmed: parsed.data.contentsConfirmed === "yes",
      receiptNumber: parsed.data.receiptNumber,
      collectedAt: collectedIso,
    },
  };
}

function withoutError(errors: Record<string, string>, field: string) {
  const { [field]: _removed, ...rest } = errors;
  return rest;
}

/**
 * What a record form says under its fields: when it saves (there is no
 * button), the always-rendered live region for "Saving…" (empty when idle,
 * never display:none, so screen readers have something to announce into) and
 * the failure, as a `role="alert"` paragraph that is announced when it appears.
 */
function RecordFormFooter({
  hintId,
  isCommitting,
  error,
}: {
  hintId: string;
  isCommitting: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-2">
      <p id={hintId} className="text-sm text-bb-gray-500 dark:text-bb-gray-400">
        Records when you press Enter or leave the form once everything is filled
        in. This cannot be undone.
      </p>
      <p
        role="status"
        className="min-h-5 text-sm font-medium text-bb-gray-600 dark:text-bb-gray-300"
      >
        {isCommitting ? "Saving…" : null}
      </p>
      {error ? (
        <p role="alert" className="text-sm font-medium text-bb-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Records the collection with no button: see `useCommitTriggers` for exactly
 * when. `onSubmit` must reject when the API refuses; the error then shows
 * under the form, the values stay, and the next Enter (or leave after an edit)
 * tries again. The fieldset disables every field while the request runs.
 */
function CollectJobForm({
  jobDate,
  isSubmitting,
  onSubmit,
}: {
  jobDate: string | null;
  isSubmitting: boolean;
  onSubmit: (payload: CollectJobPayload) => Promise<void>;
}) {
  const hintId = useId();
  const [values, setValues] = useState<CollectValues>(() => ({
    contentsConfirmed: null,
    receiptNumber: "",
    collectedAt: defaultRecordedAt(jobDate),
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const committer = useCommitOnComplete<CollectJobPayload>({
    commit: onSubmit,
    errorMessage: (caught) =>
      jobErrorMessage(caught, "Unable to record this collection."),
  });
  const triggers = useCommitTriggers({
    values,
    validate: (current) => validateCollect(current, jobDate),
    committer,
    onValidation: setErrors,
  });

  function change(next: CollectValues, field: keyof CollectValues) {
    setErrors((current) => withoutError(current, field));
    setValues(next);
  }

  return (
    <form
      noValidate
      className="space-y-4"
      aria-describedby={hintId}
      onSubmit={(event) => event.preventDefault()}
      {...triggers.formProps}
    >
      <fieldset
        disabled={committer.isCommitting || isSubmitting}
        className="m-0 min-w-0 space-y-4 border-0 p-0"
      >
        <SearchableSelectField
          id="contents-confirmed"
          label="Contents confirmed"
          value={values.contentsConfirmed}
          onChange={(next) => {
            const nextValues = { ...values, contentsConfirmed: next };
            change(nextValues, "contentsConfirmed");
            triggers.commitAfterGesture(nextValues);
          }}
          options={[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ]}
          placeholder="Select yes or no…"
          error={errors.contentsConfirmed}
        />

        <div className="space-y-2">
          <Label htmlFor="job-number">Job number</Label>
          <Input
            id="job-number"
            value={values.receiptNumber}
            onChange={(event) =>
              change(
                { ...values, receiptNumber: event.target.value },
                "receiptNumber",
              )
            }
          />
          <FieldError message={errors.receiptNumber} />
        </div>

        <RecordedAtField
          id="collected-at"
          label="Collection time"
          jobDate={jobDate}
          value={values.collectedAt}
          onChange={(next) =>
            change({ ...values, collectedAt: next }, "collectedAt")
          }
          error={errors.collectedAt}
        />
      </fieldset>

      <RecordFormFooter
        hintId={hintId}
        isCommitting={committer.isCommitting}
        error={committer.error}
      />
    </form>
  );
}

type DeliverValues = {
  recipient: string;
  noRecipient: boolean;
  deliveredAt: string;
};

/** The existing delivery rules, run on the form's values. */
function validateDeliver(
  values: DeliverValues,
  jobDate: string | null,
): Validation<DeliverJobPayload> {
  const parsed = deliverSchema.safeParse(values);
  if (!parsed.success) {
    return { errors: fieldErrors(parsed) };
  }

  const deliveredIso = recordedAtToIso(jobDate, parsed.data.deliveredAt);
  if (!deliveredIso) {
    return { errors: { deliveredAt: "Enter a valid delivery time" } };
  }

  return {
    payload: parsed.data.noRecipient
      ? { noRecipient: true, deliveredAt: deliveredIso }
      : {
          recipient: parsed.data.recipient,
          noRecipient: false,
          deliveredAt: deliveredIso,
        },
  };
}

/** Records the delivery with no button, like `CollectJobForm`. */
function DeliverJobForm({
  jobDate,
  isSubmitting,
  onSubmit,
}: {
  jobDate: string | null;
  isSubmitting: boolean;
  onSubmit: (payload: DeliverJobPayload) => Promise<void>;
}) {
  const hintId = useId();
  const [values, setValues] = useState<DeliverValues>(() => ({
    recipient: "",
    noRecipient: false,
    deliveredAt: defaultRecordedAt(jobDate),
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const committer = useCommitOnComplete<DeliverJobPayload>({
    commit: onSubmit,
    errorMessage: (caught) =>
      jobErrorMessage(caught, "Unable to record this delivery."),
  });
  const triggers = useCommitTriggers({
    values,
    validate: (current) => validateDeliver(current, jobDate),
    committer,
    onValidation: setErrors,
  });

  function change(next: DeliverValues, field: keyof DeliverValues) {
    setErrors((current) => withoutError(current, field));
    setValues(next);
  }

  function handleNoRecipientChange(checked: boolean) {
    // Ticking the box says nobody received it, so a typed recipient goes.
    const nextValues = {
      ...values,
      noRecipient: checked,
      recipient: checked ? "" : values.recipient,
    };
    change(nextValues, "noRecipient");
    if (checked) {
      setErrors((current) => withoutError(current, "recipient"));
    }
    triggers.commitAfterGesture(nextValues);
  }

  return (
    <form
      noValidate
      className="space-y-4"
      aria-describedby={hintId}
      onSubmit={(event) => event.preventDefault()}
      {...triggers.formProps}
    >
      <fieldset
        disabled={committer.isCommitting || isSubmitting}
        className="m-0 min-w-0 space-y-4 border-0 p-0"
      >
        <div className="space-y-2">
          <Label htmlFor="recipient">Recipient</Label>
          <Input
            id="recipient"
            value={values.recipient}
            disabled={values.noRecipient}
            onChange={(event) =>
              change({ ...values, recipient: event.target.value }, "recipient")
            }
          />
          <FieldError message={errors.recipient} />
          <label
            htmlFor="no-recipient"
            className="flex min-h-11 items-center gap-3 rounded-xl px-1 text-base font-medium text-bb-gray-900 dark:text-bb-gray-100"
          >
            <input
              id="no-recipient"
              type="checkbox"
              className="size-5 shrink-0 rounded border-bb-gray-300 accent-bb-cta"
              checked={values.noRecipient}
              onChange={(event) =>
                handleNoRecipientChange(event.target.checked)
              }
            />
            No person or recipient
          </label>
        </div>

        <RecordedAtField
          id="delivered-at"
          label="Delivery time"
          jobDate={jobDate}
          value={values.deliveredAt}
          onChange={(next) =>
            change({ ...values, deliveredAt: next }, "deliveredAt")
          }
          error={errors.deliveredAt}
        />
      </fieldset>

      <RecordFormFooter
        hintId={hintId}
        isCommitting={committer.isCommitting}
        error={committer.error}
      />
    </form>
  );
}

function CancelJobForm({
  isSubmitting,
  onSubmit,
}: {
  isSubmitting: boolean;
  onSubmit: (reason?: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = reason.trim();
    await onSubmit(trimmed.length > 0 ? trimmed : undefined);
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="cancel-reason">Reason (optional)</Label>
        <Textarea
          id="cancel-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
        />
      </div>
      <Button type="submit" variant="destructive" disabled={isSubmitting}>
        Cancel job
      </Button>
    </form>
  );
}

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `Job ${params.jobId} — Plasma Controller` }];
}

export default function JobDetailPage() {
  const { jobId = "" } = useParams();
  const { status, activeRole } = useAuth();
  const canManage = canManageJobs(activeRole);

  const [job, setJob] = useState<DeliveryJob | null>(null);
  const [shifts, setShifts] = useState<ActiveShift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // The job the page is on now, so a slow request for a job the user has left
  // cannot overwrite the one on screen.
  const currentJobIdRef = useRef(jobId);
  currentJobIdRef.current = jobId;

  const load = useCallback(async () => {
    const [nextJob, nextShifts] = await Promise.all([
      fetchJobById(jobId),
      fetchActiveShifts(),
    ]);
    setJob(nextJob);
    setShifts(nextShifts);
  }, [jobId]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    void load()
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(jobErrorMessage(caught, "Unable to load job."));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [load, status]);

  async function runAction(action: () => Promise<DeliveryJob>) {
    setActionError(null);
    setIsSubmitting(true);
    try {
      const updated = await action();
      setJob(updated);
    } catch (caught: unknown) {
      setActionError(jobErrorMessage(caught, "Unable to update this job."));
    } finally {
      setIsSubmitting(false);
    }
  }

  /** Re-read who is on shift (keeping the old list if that fails), so a rider who has since logged off is not offered again. */
  async function refreshShifts() {
    try {
      setShifts(await fetchActiveShifts());
    } catch {
      // Keep the list we have.
    }
  }

  /**
   * The API said our copy of the job is stale (someone else allocated or
   * collected it, or it is gone): read it again once. Never retries the action,
   * so it cannot loop. If the job can no longer be allocated the field below
   * disappears, so say why at page level instead. A failed read changes nothing.
   * `action` is the one that failed: the job is "still fine" if it allows it.
   */
  async function reloadJob(
    requestedJobId: string,
    message: string,
    action: "allocate" | "collect" | "deliver",
  ) {
    try {
      const fresh = await fetchJobById(requestedJobId);
      if (currentJobIdRef.current !== requestedJobId) {
        return;
      }

      setJob(fresh);
      if (
        message &&
        (!fresh || !allowedActionsForJob(fresh).includes(action))
      ) {
        setActionError(message);
      }
    } catch {
      // Keep what is on screen.
    }
  }

  /** Unlike runAction, rejects on failure: the allocate field shows the error itself. */
  async function allocateRider(shiftId: string) {
    if (!job) {
      return;
    }

    const requestedJobId = job.id;
    setActionError(null);
    setIsSubmitting(true);
    try {
      const updated = await performJobAction(requestedJobId, "allocate", {
        shiftId,
      });
      if (currentJobIdRef.current === requestedJobId) {
        setJob(updated);
      }
    } catch (caught: unknown) {
      void refreshShifts();
      if (isStaleJobError(caught)) {
        void reloadJob(requestedJobId, jobErrorMessage(caught, ""), "allocate");
      }
      throw caught;
    } finally {
      setIsSubmitting(false);
    }

    void refreshShifts();
  }

  /**
   * Records a collection or delivery. Like allocateRider it rejects on failure
   * (the form shows the error under itself and keeps its values) and, when the
   * API says the page's copy of the job is stale, reads the job once. It never
   * retries the action.
   */
  async function recordJobAction(
    action: "collect" | "deliver",
    payload: CollectJobPayload | DeliverJobPayload,
  ) {
    if (!job) {
      return;
    }

    const requestedJobId = job.id;
    setActionError(null);
    setIsSubmitting(true);
    try {
      const updated = await performJobAction(requestedJobId, action, payload);
      if (currentJobIdRef.current === requestedJobId) {
        setJob(updated);
      }
    } catch (caught: unknown) {
      if (isStaleJobError(caught)) {
        void reloadJob(requestedJobId, jobErrorMessage(caught, ""), action);
      }
      throw caught;
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <p className="py-12 text-center text-base text-bb-gray-500 dark:text-bb-gray-400">
        Loading job…
      </p>
    );
  }

  if (error) {
    return (
      <p
        role="alert"
        className="py-12 text-center text-base font-medium text-bb-error"
      >
        {error}
      </p>
    );
  }

  if (!job) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 text-center">
        <p className="text-base text-bb-gray-500 dark:text-bb-gray-400">
          Job not found.
        </p>
        <Button render={<Link to="/jobs" />} nativeButton={false}>
          Back to jobs
        </Button>
      </div>
    );
  }

  const allowed = allowedActionsForJob(job);
  // Allocate stays allowed on an Allocated job (until it is collected), so the
  // same form changes the rider. An API that does not allow it shows nothing.
  const allocateHeading =
    job.status === "Allocated" ? "Change rider" : "Allocate rider";
  const waitingForLeg = waitingForLegMessage(job);
  const reference = displayJobReference(job);
  const createdLabel = formatJobCreatedAt(job.createdAt);
  // Normal jobs are collected and delivered on one fixed day, so only the time
  // is editable. Relay jobs (parent or leg) keep the date-and-time picker.
  const fixedJobDate = isRelayJob(job) ? null : getJobDate(job);
  // The reminder is a controller's job: only roles that can manage jobs get it,
  // and the API only sends the flag to them.
  const showMotherReminder = canManage && needsMotherContact(job);
  // Only an upcoming collection reads as "arranged"; later statuses say nothing.
  const arrangedAt = upcomingCollectionAt(job);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          to="/jobs"
          className="inline-flex items-center gap-2 text-sm font-semibold text-bb-cta hover:underline dark:text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to jobs
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-mono text-[28px] font-extrabold text-bb-gray-900 dark:text-bb-gray-100">
            {reference}
          </h1>
          {createdLabel ? (
            <p className="mt-1 text-sm text-bb-gray-500 dark:text-bb-gray-400">
              Created {createdLabel}
            </p>
          ) : null}
        </div>
        <Badge className={cn("shrink-0", statusBadgeClass(job.status))}>
          {job.status}
        </Badge>
      </header>

      {showMotherReminder ? (
        <MotherContactReminder
          onSave={async (scheduledCollectionAt) => {
            setJob(await scheduleJobCollection(job.id, scheduledCollectionAt));
          }}
        >
          {job.mother ? <MotherContact mother={job.mother} /> : null}
        </MotherContactReminder>
      ) : arrangedAt ? (
        <ArrangedCollection scheduledAt={arrangedAt} />
      ) : null}

      <Card className="rounded-bb-card border-0 bg-bb-white py-5 shadow-none ring-1 ring-bb-gray-200 dark:bg-card dark:ring-bb-gray-700">
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <JobTypeLabel job={job} />
            <BereavementBadge job={job} />
          </div>
          <JobRouteSummary job={job} />
          {waitingForLeg ? (
            <p className="text-sm font-medium text-bb-gray-700 dark:text-bb-gray-200">
              {waitingForLeg}
            </p>
          ) : null}
          {job.mother && !showMotherReminder ? (
            <MotherContact mother={job.mother} />
          ) : null}
          <div className="space-y-1 text-sm text-bb-gray-600 dark:text-bb-gray-300">
            <p>
              <span className="font-medium text-bb-gray-900 dark:text-bb-gray-100">
                Sender:
              </span>{" "}
              {job.sender.name}
              {job.sender.organisation ? ` · ${job.sender.organisation}` : ""}
            </p>
            <p>
              <span className="font-medium text-bb-gray-900 dark:text-bb-gray-100">
                Contents:
              </span>{" "}
              {job.contents}
            </p>
          </div>
          {job.allocatedRider ? (
            <p className="text-sm text-bb-gray-600 dark:text-bb-gray-300">
              <span className="font-medium text-bb-gray-900 dark:text-bb-gray-100">
                Allocated rider:
              </span>{" "}
              {job.allocatedRider.name}
            </p>
          ) : null}
          {job.collectionRecord ? (
            <p
              role="status"
              className="text-sm text-bb-gray-600 dark:text-bb-gray-300"
            >
              {collectionRecordText(job.collectionRecord)}
            </p>
          ) : null}
          {job.deliveryRecord ? (
            <p
              role="status"
              className="text-sm text-bb-gray-600 dark:text-bb-gray-300"
            >
              {deliveryRecordText(job.deliveryRecord)}
            </p>
          ) : null}
          {job.cancellation?.reason ? (
            <p className="text-sm text-bb-error">
              Cancelled: {job.cancellation.reason}
            </p>
          ) : null}
          {job.isRelay && job.legs && job.legs.length > 0 ? (
            <JobLegsPanel legs={job.legs} defaultExpanded />
          ) : null}
        </CardContent>
      </Card>

      {actionError ? (
        <p role="alert" className="text-sm font-medium text-bb-error">
          {actionError}
        </p>
      ) : null}

      {canManage && allowed.includes("relay") ? (
        <section
          aria-label="Convert to relay"
          className="rounded-bb-card bg-bb-white p-5 ring-1 ring-bb-gray-200 dark:bg-card dark:ring-bb-gray-700"
        >
          <h2 className="mb-4 text-lg font-bold text-bb-gray-900 dark:text-bb-gray-100">
            Convert to relay
          </h2>
          <RelayJobForm
            jobDate={getJobDate(job)}
            isSubmitting={isSubmitting}
            onSubmit={(payload) => runAction(() => relayJob(job.id, payload))}
          />
        </section>
      ) : null}

      {canManage && allowed.includes("allocate") ? (
        <section
          aria-label={allocateHeading}
          className="rounded-bb-card bg-bb-white p-5 ring-1 ring-bb-gray-200 dark:bg-card dark:ring-bb-gray-700"
        >
          <h2 className="mb-4 text-lg font-bold text-bb-gray-900 dark:text-bb-gray-100">
            {allocateHeading}
          </h2>
          <AllocateJobForm
            shifts={shifts}
            currentShiftId={job.allocatedRider?.shiftId ?? null}
            currentRiderName={job.allocatedRider?.name ?? null}
            isSubmitting={isSubmitting}
            onSubmit={allocateRider}
          />
        </section>
      ) : null}

      {canManage && allowed.includes("collect") ? (
        <section
          aria-label="Record collection"
          className="rounded-bb-card bg-bb-white p-5 ring-1 ring-bb-gray-200 dark:bg-card dark:ring-bb-gray-700"
        >
          <h2 className="mb-4 text-lg font-bold text-bb-gray-900 dark:text-bb-gray-100">
            Record collection
          </h2>
          <CollectJobForm
            key={job.id}
            jobDate={fixedJobDate}
            isSubmitting={isSubmitting}
            onSubmit={(payload) => recordJobAction("collect", payload)}
          />
        </section>
      ) : null}

      {canManage && allowed.includes("deliver") ? (
        <section
          aria-label="Record delivery"
          className="rounded-bb-card bg-bb-white p-5 ring-1 ring-bb-gray-200 dark:bg-card dark:ring-bb-gray-700"
        >
          <h2 className="mb-4 text-lg font-bold text-bb-gray-900 dark:text-bb-gray-100">
            Record delivery
          </h2>
          <DeliverJobForm
            key={job.id}
            jobDate={fixedJobDate}
            isSubmitting={isSubmitting}
            onSubmit={(payload) => recordJobAction("deliver", payload)}
          />
        </section>
      ) : null}

      {canManage && allowed.includes("cancel") ? (
        <section
          aria-label="Cancel job"
          className="rounded-bb-card bg-bb-white p-5 ring-1 ring-bb-gray-200 dark:bg-card dark:ring-bb-gray-700"
        >
          <h2 className="mb-4 text-lg font-bold text-bb-gray-900 dark:text-bb-gray-100">
            Cancel job
          </h2>
          <CancelJobForm
            isSubmitting={isSubmitting}
            onSubmit={(reason) =>
              runAction(() => cancelJob(job.id, { reason }))
            }
          />
        </section>
      ) : null}
    </div>
  );
}
