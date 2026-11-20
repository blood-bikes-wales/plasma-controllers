import { ArrowLeft, Phone } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { z } from "zod";
import { BereavementBadge } from "~/components/bereavement-badge";
import { EstimatedTime } from "~/components/estimated-time";
import { FieldError } from "~/components/field-error";
import { JobLegsPanel } from "~/components/job-legs-panel";
import { JobTypeLabel } from "~/components/job-type-label";
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
  cancelJob,
  combineDayAndTime,
  type DeliverJobPayload,
  type DeliveryJob,
  defaultDateTimeLocalValue,
  defaultTimeValue,
  displayJobReference,
  fetchJobById,
  formatJobCreatedAt,
  formatJobDay,
  fromDateTimeLocalValue,
  getJobDate,
  isRelayJob,
  type JobDeliveryRecord,
  type JobMother,
  jobErrorMessage,
  performJobAction,
  relayJob,
  waitingForLegMessage,
} from "~/lib/jobs";
import { addressWithPostcode } from "~/lib/postcode";
import { type ActiveShift, fetchActiveShifts } from "~/lib/shifts";
import { cn } from "~/lib/utils";
import { fieldErrors } from "~/lib/validation";

import type { Route } from "./+types/jobs.$jobId";

const allocateSchema = z.object({
  shiftId: z.string().min(1, "Select a rider on an active shift"),
});

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

function AllocateJobForm({
  shifts,
  isSubmitting,
  onSubmit,
}: {
  shifts: ActiveShift[];
  isSubmitting: boolean;
  onSubmit: (shiftId: string) => Promise<void>;
}) {
  const [shiftId, setShiftId] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldError(null);

    const parsed = allocateSchema.safeParse({ shiftId: shiftId ?? "" });
    const errors = fieldErrors(parsed);
    if (!parsed.success) {
      setFieldError(errors.shiftId ?? "Select a rider on an active shift");
      return;
    }

    await onSubmit(parsed.data.shiftId);
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <SearchableSelectField
        id="allocate-shift"
        label="Active shift rider"
        value={shiftId}
        onChange={(value) => {
          setShiftId(value);
          setFieldError(null);
        }}
        options={shifts.map((shift) => ({
          value: shift.id,
          label: shift.bikeRegistration
            ? `${shift.riderName} · ${shift.bikeRegistration}`
            : shift.riderName,
        }))}
        placeholder="Search or select a rider on duty…"
        error={fieldError ?? undefined}
        emptyMessage="No riders are currently on an active shift."
      />
      <Button type="submit" disabled={isSubmitting || shifts.length === 0}>
        Allocate rider
      </Button>
    </form>
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

function CollectJobForm({
  jobDate,
  isSubmitting,
  onSubmit,
}: {
  jobDate: string | null;
  isSubmitting: boolean;
  onSubmit: (payload: {
    contentsConfirmed: boolean;
    receiptNumber: string;
    collectedAt: string;
  }) => Promise<void>;
}) {
  const [contentsConfirmed, setContentsConfirmed] = useState<string | null>(
    null,
  );
  const [receiptNumber, setReceiptNumber] = useState("");
  const [collectedAt, setCollectedAt] = useState(() =>
    defaultRecordedAt(jobDate),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    const parsed = collectSchema.safeParse({
      contentsConfirmed: contentsConfirmed ?? "",
      receiptNumber,
      collectedAt,
    });

    const nextErrors = fieldErrors(parsed);
    if (!parsed.success) {
      setErrors(nextErrors);
      return;
    }

    const collectedIso = recordedAtToIso(jobDate, parsed.data.collectedAt);
    if (!collectedIso) {
      setErrors({ collectedAt: "Enter a valid collection time" });
      return;
    }

    await onSubmit({
      contentsConfirmed: parsed.data.contentsConfirmed === "yes",
      receiptNumber: parsed.data.receiptNumber,
      collectedAt: collectedIso,
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <SearchableSelectField
        id="contents-confirmed"
        label="Contents confirmed"
        value={contentsConfirmed}
        onChange={setContentsConfirmed}
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
          value={receiptNumber}
          onChange={(event) => setReceiptNumber(event.target.value)}
        />
        <FieldError message={errors.receiptNumber} />
      </div>

      <RecordedAtField
        id="collected-at"
        label="Collection time"
        jobDate={jobDate}
        value={collectedAt}
        onChange={setCollectedAt}
        error={errors.collectedAt}
      />

      <Button type="submit" disabled={isSubmitting}>
        Record collection
      </Button>
    </form>
  );
}

/** `recipient` is null when nobody received the delivery. */
function deliveryRecordText(record: JobDeliveryRecord) {
  if (record.noRecipient) {
    return "Delivered, no recipient";
  }

  return record.recipient ? `Delivered to ${record.recipient}` : "Delivered";
}

function DeliverJobForm({
  jobDate,
  isSubmitting,
  onSubmit,
}: {
  jobDate: string | null;
  isSubmitting: boolean;
  onSubmit: (payload: DeliverJobPayload) => Promise<void>;
}) {
  const [recipient, setRecipient] = useState("");
  const [noRecipient, setNoRecipient] = useState(false);
  const [deliveredAt, setDeliveredAt] = useState(() =>
    defaultRecordedAt(jobDate),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    const parsed = deliverSchema.safeParse({
      recipient,
      noRecipient,
      deliveredAt,
    });
    const nextErrors = fieldErrors(parsed);
    if (!parsed.success) {
      setErrors(nextErrors);
      return;
    }

    const deliveredIso = recordedAtToIso(jobDate, parsed.data.deliveredAt);
    if (!deliveredIso) {
      setErrors({ deliveredAt: "Enter a valid delivery time" });
      return;
    }

    await onSubmit(
      parsed.data.noRecipient
        ? { noRecipient: true, deliveredAt: deliveredIso }
        : {
            recipient: parsed.data.recipient,
            noRecipient: false,
            deliveredAt: deliveredIso,
          },
    );
  }

  function handleNoRecipientChange(checked: boolean) {
    setNoRecipient(checked);
    if (checked) {
      setRecipient("");
      setErrors(({ recipient: _cleared, ...rest }) => rest);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="recipient">Recipient</Label>
        <Input
          id="recipient"
          value={recipient}
          disabled={noRecipient}
          onChange={(event) => setRecipient(event.target.value)}
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
            checked={noRecipient}
            onChange={(event) => handleNoRecipientChange(event.target.checked)}
          />
          No person or recipient
        </label>
      </div>

      <RecordedAtField
        id="delivered-at"
        label="Delivery time"
        jobDate={jobDate}
        value={deliveredAt}
        onChange={setDeliveredAt}
        error={errors.deliveredAt}
      />

      <Button type="submit" disabled={isSubmitting}>
        Record delivery
      </Button>
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
  const waitingForLeg = waitingForLegMessage(job);
  const reference = displayJobReference(job);
  const createdLabel = formatJobCreatedAt(job.createdAt);
  // Normal jobs are collected and delivered on one fixed day, so only the time
  // is editable. Relay jobs (parent or leg) keep the date-and-time picker.
  const fixedJobDate = isRelayJob(job) ? null : getJobDate(job);

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
          {job.mother ? <MotherContact mother={job.mother} /> : null}
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
            <p className="text-sm text-bb-gray-600 dark:text-bb-gray-300">
              Collected · job {job.collectionRecord.receiptNumber}
            </p>
          ) : null}
          {job.deliveryRecord ? (
            <p className="text-sm text-bb-gray-600 dark:text-bb-gray-300">
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
          aria-label="Allocate job"
          className="rounded-bb-card bg-bb-white p-5 ring-1 ring-bb-gray-200 dark:bg-card dark:ring-bb-gray-700"
        >
          <h2 className="mb-4 text-lg font-bold text-bb-gray-900 dark:text-bb-gray-100">
            Allocate rider
          </h2>
          <AllocateJobForm
            shifts={shifts}
            isSubmitting={isSubmitting}
            onSubmit={(shiftId) =>
              runAction(() => performJobAction(job.id, "allocate", { shiftId }))
            }
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
            jobDate={fixedJobDate}
            isSubmitting={isSubmitting}
            onSubmit={(payload) =>
              runAction(() => performJobAction(job.id, "collect", payload))
            }
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
            jobDate={fixedJobDate}
            isSubmitting={isSubmitting}
            onSubmit={(payload) =>
              runAction(() => performJobAction(job.id, "deliver", payload))
            }
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
